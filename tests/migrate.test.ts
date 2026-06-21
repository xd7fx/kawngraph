import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { GRAPH_SCHEMA_VERSION } from "@kawngraph/shared";
import {
  detectLegacyData,
  migrateLegacyData,
  computeGraphHash,
} from "@kawngraph/core";
import { mkTmp } from "./helpers";

/** A tiny but structurally-valid graph.json body. */
const GRAPH_BODY = JSON.stringify(
  {
    kawnVersion: "0.1.0",
    generatedAt: "2026-01-01T00:00:00.000Z",
    root: ".",
    stats: { nodes: 1, edges: 0, byLayer: { code: 1 }, byType: { file: 1 }, byEdgeType: {} },
    nodes: [{ id: "file:src/a.ts", type: "file", layer: "code", label: "a.ts", sourcePath: "src/a.ts" }],
    edges: [],
  },
  null,
  2,
);

interface LegacyOpts {
  schemaVersion?: number;
  withManifest?: boolean;
  withReport?: boolean;
  withConfig?: boolean;
  /** legacy manifest/config use the pre-rebrand `atharVersion` key */
  versionKey?: "atharVersion" | "kawnVersion";
}

/** Materialize a legacy `.athar/` directory and return its graphHash. */
function seedLegacy(root: string, opts: LegacyOpts = {}): string {
  const {
    schemaVersion = GRAPH_SCHEMA_VERSION,
    withManifest = true,
    withReport = true,
    withConfig = true,
    versionKey = "atharVersion",
  } = opts;
  const dir = path.join(root, ".athar");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "graph.json"), GRAPH_BODY, "utf8");
  const graphHash = computeGraphHash(GRAPH_BODY);
  if (withReport) fs.writeFileSync(path.join(dir, "report.md"), "# KawnGraph report\n", "utf8");
  if (withConfig) {
    fs.writeFileSync(
      path.join(dir, "config.json"),
      JSON.stringify({ [versionKey]: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" }, null, 2) + "\n",
      "utf8",
    );
  }
  if (withManifest) {
    const manifest: Record<string, unknown> = {
      schemaVersion,
      [versionKey]: "0.1.0",
      scannedAt: "2026-01-01T00:00:00.000Z",
      root,
      rootFingerprint: "deadbeefdeadbeef",
      gitHead: null,
      trackedFileCount: 1,
      nodes: 1,
      edges: 0,
      graphHash,
    };
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  }
  return graphHash;
}

test("no legacy dir → nothing to migrate, writes nothing", async () => {
  const root = mkTmp("kawn-migrate-none-");
  try {
    const det = await detectLegacyData(root);
    assert.equal(det.present, false);

    const res = await migrateLegacyData(root, { dryRun: false });
    assert.equal(res.status, "no-legacy");
    assert.equal(res.items.length, 0);
    assert.equal(fs.existsSync(path.join(root, ".kawn")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("dry-run plans the copy but writes no files", async () => {
  const root = mkTmp("kawn-migrate-dry-");
  try {
    seedLegacy(root);
    const res = await migrateLegacyData(root, { dryRun: true });
    assert.equal(res.status, "planned");
    // graph.json, report.md, config.json, manifest.json
    assert.equal(res.items.filter((i) => i.kind === "data").length, 4);
    assert.equal(res.recommendRescan, false);
    // dry-run must not create the canonical dir
    assert.equal(fs.existsSync(path.join(root, ".kawn")), false);
    // legacy preserved
    assert.equal(fs.existsSync(path.join(root, ".athar", "graph.json")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("apply copies graph verbatim, never deletes legacy, fixes the version key", async () => {
  const root = mkTmp("kawn-migrate-apply-");
  try {
    const graphHash = seedLegacy(root);
    const res = await migrateLegacyData(root, { dryRun: false });
    assert.equal(res.status, "migrated");

    // graph.json copied byte-for-byte → hash still matches the manifest
    const copied = fs.readFileSync(path.join(root, ".kawn", "graph.json"), "utf8");
    assert.equal(copied, GRAPH_BODY);
    assert.equal(computeGraphHash(copied), graphHash);

    // manifest: graphHash preserved, version key normalized to kawnVersion
    const manifest = JSON.parse(fs.readFileSync(path.join(root, ".kawn", "manifest.json"), "utf8"));
    assert.equal(manifest.graphHash, graphHash);
    assert.equal(manifest.schemaVersion, GRAPH_SCHEMA_VERSION);
    assert.equal(manifest.kawnVersion, "0.1.0");
    assert.ok(!("atharVersion" in manifest), "legacy atharVersion key should be renamed");

    // config likewise normalized
    const config = JSON.parse(fs.readFileSync(path.join(root, ".kawn", "config.json"), "utf8"));
    assert.equal(config.kawnVersion, "0.1.0");
    assert.ok(!("atharVersion" in config));

    // legacy dir is NEVER deleted automatically
    assert.equal(fs.existsSync(path.join(root, ".athar", "graph.json")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("refuses to overwrite an existing non-empty .kawn/", async () => {
  const root = mkTmp("kawn-migrate-conflict-");
  try {
    seedLegacy(root);
    // a pre-existing canonical dir with content
    const kdir = path.join(root, ".kawn");
    fs.mkdirSync(kdir, { recursive: true });
    fs.writeFileSync(path.join(kdir, "graph.json"), '{"keep":true}', "utf8");

    const res = await migrateLegacyData(root, { dryRun: false });
    assert.equal(res.status, "conflict");
    assert.equal(res.targetExisted, true);
    // existing content untouched
    assert.equal(fs.readFileSync(path.join(kdir, "graph.json"), "utf8"), '{"keep":true}');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("incompatible legacy schema still migrates but recommends a re-scan", async () => {
  const root = mkTmp("kawn-migrate-incompat-");
  try {
    seedLegacy(root, { schemaVersion: GRAPH_SCHEMA_VERSION + 999 });
    const det = await detectLegacyData(root);
    assert.equal(det.compatible, false);

    const res = await migrateLegacyData(root, { dryRun: false });
    assert.equal(res.status, "migrated");
    assert.equal(res.recommendRescan, true);
    assert.equal(fs.existsSync(path.join(root, ".kawn", "graph.json")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("migrates a root .atharignore only when .kawnignore is absent", async () => {
  const root = mkTmp("kawn-migrate-ignore-");
  try {
    seedLegacy(root);
    fs.writeFileSync(path.join(root, ".atharignore"), "fixtures\n", "utf8");

    const res = await migrateLegacyData(root, { dryRun: false });
    assert.equal(res.status, "migrated");
    assert.ok(res.items.some((i) => i.kind === "ignore"), "ignore file should be planned");
    assert.equal(fs.readFileSync(path.join(root, ".kawnignore"), "utf8"), "fixtures\n");
    // legacy ignore preserved
    assert.equal(fs.existsSync(path.join(root, ".atharignore")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("does not clobber an existing .kawnignore", async () => {
  const root = mkTmp("kawn-migrate-ignore2-");
  try {
    seedLegacy(root);
    fs.writeFileSync(path.join(root, ".atharignore"), "from-legacy\n", "utf8");
    fs.writeFileSync(path.join(root, ".kawnignore"), "already-here\n", "utf8");

    const res = await migrateLegacyData(root, { dryRun: false });
    assert.ok(!res.items.some((i) => i.kind === "ignore"), "must not plan an ignore overwrite");
    assert.equal(fs.readFileSync(path.join(root, ".kawnignore"), "utf8"), "already-here\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("handles a project path with spaces and Unicode", async () => {
  const base = mkTmp("kawn-migrate-uni-");
  const root = path.join(base, "مشروع مع مسافة");
  try {
    fs.mkdirSync(root, { recursive: true });
    const graphHash = seedLegacy(root);
    const res = await migrateLegacyData(root, { dryRun: false });
    assert.equal(res.status, "migrated");
    const copied = fs.readFileSync(path.join(root, ".kawn", "graph.json"), "utf8");
    assert.equal(computeGraphHash(copied), graphHash);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
