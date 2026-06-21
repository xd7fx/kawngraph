import * as fs from "node:fs/promises";
import * as path from "node:path";
import { GRAPH_SCHEMA_VERSION } from "@kawngraph/shared";
import { kawnDir } from "./graphStore";

/**
 * Safe one-time migration of a pre-rebrand local data directory.
 *
 * Before the rebrand the CLI wrote its graph to `.athar/`; the canonical
 * location is now `.kawn/`. This module copies an existing `.athar/` into
 * `.kawn/` without ever:
 *   - deleting the legacy `.athar/` (the user removes it themselves once happy),
 *   - overwriting an existing non-empty `.kawn/` (a conflict is reported instead).
 *
 * The graph bytes are copied verbatim so the manifest's `graphHash` stays valid;
 * the manifest/config JSON only gets a cosmetic `atharVersion -> kawnVersion`
 * key rename so it reads cleanly under the new code. All filesystem work goes
 * through node:fs (no shell), so paths with spaces or Unicode are safe on
 * Windows, macOS, and Linux.
 */

export const LEGACY_DIR_NAME = ".athar";
export const LEGACY_IGNORE_NAME = ".atharignore";
export const CANONICAL_IGNORE_NAME = ".kawnignore";

/** Absolute path to the legacy `.athar/` directory for a repo root. */
export function legacyDir(root: string): string {
  return path.join(root, LEGACY_DIR_NAME);
}

async function statKind(p: string): Promise<"dir" | "file" | "none"> {
  try {
    const st = await fs.stat(p);
    return st.isDirectory() ? "dir" : st.isFile() ? "file" : "none";
  } catch {
    return "none";
  }
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((d) => d.isFile()).map((d) => d.name).sort();
  } catch {
    return [];
  }
}

export interface LegacyDetection {
  /** the legacy `.athar/` directory exists */
  present: boolean;
  /** absolute path to the legacy directory */
  path: string;
  /** file names found directly inside the legacy directory */
  files: string[];
  /** `schemaVersion` read from `.athar/manifest.json`, when present and valid */
  schemaVersion: number | null;
  /** a legacy `graph.json` exists */
  hasGraph: boolean;
  /** the legacy graph's schema matches the version this build supports */
  compatible: boolean;
}

/** Inspect a repo root for a legacy `.athar/` directory and classify it. Read-only. */
export async function detectLegacyData(root: string): Promise<LegacyDetection> {
  const absRoot = path.resolve(root);
  const dir = legacyDir(absRoot);
  if ((await statKind(dir)) !== "dir") {
    return { present: false, path: dir, files: [], schemaVersion: null, hasGraph: false, compatible: false };
  }
  const files = await listFiles(dir);
  const hasGraph = files.includes("graph.json");
  let schemaVersion: number | null = null;
  if (files.includes("manifest.json")) {
    try {
      const raw = await fs.readFile(path.join(dir, "manifest.json"), "utf8");
      const parsed = JSON.parse(raw) as { schemaVersion?: unknown };
      if (typeof parsed?.schemaVersion === "number") schemaVersion = parsed.schemaVersion;
    } catch {
      // unreadable/!JSON manifest — leave schemaVersion null (treated incompatible)
    }
  }
  const compatible = hasGraph && schemaVersion === GRAPH_SCHEMA_VERSION;
  return { present: true, path: dir, files, schemaVersion, hasGraph, compatible };
}

export type MigrateStatus = "no-legacy" | "conflict" | "planned" | "migrated";

export interface MigratePlanItem {
  /** absolute source path */
  from: string;
  /** absolute destination path */
  to: string;
  /** display name (basename) */
  rel: string;
  /** "data" = inside .athar/ ; "ignore" = root .atharignore */
  kind: "data" | "ignore";
}

export interface MigrateResult {
  status: MigrateStatus;
  legacy: LegacyDetection;
  /** absolute `.kawn/` directory */
  target: string;
  /** the files that were (or would be) copied */
  items: MigratePlanItem[];
  /** `.kawn/` already existed with content (the conflict guard) */
  targetExisted: boolean;
  /** a re-scan is recommended (legacy schema incompatible or no legacy graph) */
  recommendRescan: boolean;
  /** human-readable notes, safe to print */
  notes: string[];
}

export interface MigrateOptions {
  /** show the plan, write nothing */
  dryRun: boolean;
}

/**
 * Plan and (unless `dryRun`) perform the `.athar/` -> `.kawn/` migration.
 * Never deletes the legacy directory; never overwrites an existing `.kawn/`.
 */
export async function migrateLegacyData(root: string, opts: MigrateOptions): Promise<MigrateResult> {
  const absRoot = path.resolve(root);
  const legacy = await detectLegacyData(absRoot);
  const target = kawnDir(absRoot);
  const notes: string[] = [];

  if (!legacy.present) {
    return {
      status: "no-legacy",
      legacy,
      target,
      items: [],
      targetExisted: false,
      recommendRescan: false,
      notes: [`No legacy ${LEGACY_DIR_NAME}/ directory found — nothing to migrate.`],
    };
  }

  // Plan: every file inside .athar/ -> .kawn/, plus the root ignore file when
  // the legacy one exists and the canonical one does not.
  const items: MigratePlanItem[] = legacy.files.map((name) => ({
    from: path.join(legacy.path, name),
    to: path.join(target, name),
    rel: name,
    kind: "data" as const,
  }));

  const legacyIgnore = path.join(absRoot, LEGACY_IGNORE_NAME);
  const canonicalIgnore = path.join(absRoot, CANONICAL_IGNORE_NAME);
  if ((await statKind(legacyIgnore)) === "file" && (await statKind(canonicalIgnore)) === "none") {
    items.push({ from: legacyIgnore, to: canonicalIgnore, rel: CANONICAL_IGNORE_NAME, kind: "ignore" });
  }

  const recommendRescan = !legacy.compatible;
  if (recommendRescan) {
    notes.push(
      legacy.hasGraph
        ? `Legacy graph schema ${legacy.schemaVersion ?? "unknown"} != supported v${GRAPH_SCHEMA_VERSION} — run \`kawn scan\` after migrating to rebuild.`
        : `Legacy ${LEGACY_DIR_NAME}/ has no graph.json — run \`kawn scan\` after migrating to build one.`,
    );
  }

  // Conflict guard: never overwrite an existing, non-empty .kawn/.
  const targetExisted = (await statKind(target)) === "dir" && (await listFiles(target)).length > 0;
  if (targetExisted) {
    notes.unshift(
      `A ${path.basename(target)}/ directory already exists at ${target} — refusing to overwrite. ` +
        `If it is current you are already migrated; remove the legacy ${LEGACY_DIR_NAME}/ yourself once verified. ` +
        `To re-migrate, move or delete ${path.basename(target)}/ first, or run \`kawn scan\` to build a fresh graph.`,
    );
    return { status: "conflict", legacy, target, items, targetExisted, recommendRescan, notes };
  }

  if (opts.dryRun) {
    notes.push("Dry run — no files were written.");
    notes.push(`Legacy ${LEGACY_DIR_NAME}/ would be preserved (it is never deleted automatically).`);
    return { status: "planned", legacy, target, items, targetExisted, recommendRescan, notes };
  }

  await fs.mkdir(target, { recursive: true });
  for (const item of items) {
    await copyDataFile(item.from, item.to, item.rel);
  }
  notes.push(`Migrated ${items.length} item(s) into ${target}.`);
  notes.push(`Legacy ${LEGACY_DIR_NAME}/ was preserved — remove it yourself once you have verified the migration.`);
  return { status: "migrated", legacy, target, items, targetExisted, recommendRescan, notes };
}

/**
 * Copy one file. For the small JSON sidecars (`manifest.json`, `config.json`)
 * we rename a legacy `atharVersion` key to `kawnVersion` so they read cleanly;
 * everything else (notably `graph.json`) is copied byte-for-byte so the
 * manifest's `graphHash` continues to match.
 */
async function copyDataFile(from: string, to: string, name: string): Promise<void> {
  if (name === "manifest.json" || name === "config.json") {
    try {
      const raw = await fs.readFile(from, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && "atharVersion" in parsed && !("kawnVersion" in parsed)) {
        parsed.kawnVersion = parsed.atharVersion;
        delete parsed.atharVersion;
        await fs.writeFile(to, JSON.stringify(parsed, null, 2) + "\n", "utf8");
        return;
      }
    } catch {
      // unreadable/!JSON — fall through to a verbatim copy
    }
  }
  await fs.copyFile(from, to);
}
