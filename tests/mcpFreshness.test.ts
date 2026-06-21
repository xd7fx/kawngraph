import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { KawnNode, KawnEdge, edgeId, GRAPH_SCHEMA_VERSION } from "@kawngraph/shared";
import { makeGraph, mkTmp, writeGraphFile, rpcRoundtrip, RpcResult } from "./helpers";

// A tiny valid graph. We deliberately write graph.json WITHOUT a manifest, so
// graphFreshness() classifies it "possibly-stale" — a deterministic, git-free
// way to exercise the read-only freshness banner.
function fixtureGraph() {
  const nodes: KawnNode[] = [
    { id: "file:a.ts", type: "file", layer: "code", label: "a.ts", sourcePath: "src/a.ts" },
    { id: "function:a.ts#run", type: "function", layer: "code", label: "run", sourcePath: "src/a.ts", lineStart: 1, lineEnd: 3 },
  ];
  const edges: KawnEdge[] = [
    { id: edgeId("defines", "file:a.ts", "function:a.ts#run"), from: "file:a.ts", to: "function:a.ts#run", type: "defines", confidence: "linked", evidence: { sourcePath: "src/a.ts", lineStart: 1 } },
  ];
  return makeGraph(nodes, edges);
}

let validRoot: string;
let missingRoot: string;
let res: RpcResult;

before(async () => {
  validRoot = mkTmp("kawn-fresh-valid-");
  missingRoot = mkTmp("kawn-fresh-missing-");
  writeGraphFile(validRoot, fixtureGraph()); // graph present, no manifest → possibly-stale

  res = await rpcRoundtrip(
    ["--root", validRoot],
    [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "kawn_context", arguments: { task: "trace run" } } },
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "kawn_context", arguments: { task: "x", root: missingRoot } } },
    ],
  );
});

after(() => {
  for (const d of [validRoot, missingRoot]) fs.rmSync(d, { recursive: true, force: true });
});

test("initialize advertises server-level instructions within the 2KB budget", () => {
  const r = res.byId.get(1).result;
  assert.equal(typeof r.instructions, "string", "instructions must be a string");
  assert.ok(r.instructions.length > 0);
  assert.ok(Buffer.byteLength(r.instructions, "utf8") <= 2048, "instructions must stay under ~2KB");
  assert.match(r.instructions, /kawn_context/, "tells the agent to call kawn_context");
  assert.match(r.instructions, /READ-ONLY/, "states the read-only contract");
  assert.match(r.instructions, /kawn update/, "points to the one safe refresh command");
});

test("tool descriptions are sharpened and flag the read-only contract", () => {
  const tools = res.byId.get(2).result.tools as Array<{ name: string; description: string }>;
  for (const t of tools) {
    assert.match(t.description, /Read-only\.?$/, `${t.name} description ends by stating it is read-only`);
  }
  const ctx = tools.find((t) => t.name === "kawn_context")!;
  assert.match(ctx.description, /FIRST/, "kawn_context tells the agent to call it first");
});

test("a possibly-stale graph (no manifest) prepends a freshness note, still serving the pack", () => {
  const r = res.byId.get(3).result;
  assert.ok(!r.isError, "the call still succeeds — read-only never blocks on staleness");
  const text = r.content[0].text as string;
  assert.match(text, /^\[kawn\] note:/, "a low-severity freshness note is prepended");
  assert.match(text, /kawn update/, "the note points to the refresh command");
  assert.match(text, /Context pack/, "the actual pack is still returned below the note");
});

test("an error response (missing graph) carries no freshness banner", () => {
  const r = res.byId.get(4).result;
  assert.equal(r.isError, true);
  const text = r.content[0].text as string;
  assert.doesNotMatch(text, /\[kawn\] note:|STALE GRAPH/, "no banner on the error path");
  assert.match(text, /scan/, "instead it tells the user to scan");
});

test("serving never writes a manifest or mutates the graph (read-only)", () => {
  // The server must not have created a manifest just by being queried.
  assert.equal(fs.existsSync(`${validRoot}/.kawn/manifest.json`), false, "no manifest written by serving");
  assert.equal(fs.existsSync(`${missingRoot}/.kawn/graph.json`), false, "no graph built for the missing root");
});

// Write a manifest whose schema version does not match the one this build
// supports — the deterministic way to force graphFreshness() to classify the
// graph "incompatible" (the check runs before any git/hash comparison).
function writeIncompatibleManifest(root: string, graph: ReturnType<typeof fixtureGraph>) {
  const manifest = {
    schemaVersion: GRAPH_SCHEMA_VERSION + 1, // future, unsupported shape
    kawnVersion: "9.9.9",
    scannedAt: "2026-01-01T00:00:00.000Z",
    root,
    rootFingerprint: "deadbeefdeadbeef",
    gitHead: null,
    trackedFileCount: graph.nodes.filter((n) => n.type === "file").length,
    nodes: graph.stats.nodes,
    edges: graph.stats.edges,
    graphHash: "0".repeat(64),
  };
  fs.writeFileSync(path.join(root, ".kawn", "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
}

test("an INCOMPATIBLE graph is refused by every tool — structured error, no results, no writes", async () => {
  const incompatRoot = mkTmp("kawn-fresh-incompat-");
  try {
    const graph = fixtureGraph();
    writeGraphFile(incompatRoot, graph);
    writeIncompatibleManifest(incompatRoot, graph);

    const r = await rpcRoundtrip(
      ["--root", incompatRoot],
      [
        { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } },
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "kawn_context", arguments: { task: "trace run" } } },
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "kawn_query", arguments: { query: "run" } } },
        { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "kawn_affected", arguments: { symbol: "run" } } },
      ],
    );

    for (const [id, tool] of [
      [2, "kawn_context"],
      [3, "kawn_query"],
      [4, "kawn_affected"],
    ] as const) {
      const result = r.byId.get(id).result;
      assert.equal(result.isError, true, `${tool} must refuse an incompatible graph`);
      const text = result.content[0].text as string;
      assert.match(text, /INCOMPATIBLE GRAPH/, `${tool} states the graph is incompatible`);
      assert.match(text, /kawn update/, `${tool} points to the remediation command`);
      assert.match(text, /refusing to serve/i, `${tool} makes the refusal explicit`);
      // The structured, machine-parseable companion.
      assert.equal(result.structuredContent.status, "incompatible", `${tool} carries a structured status`);
      assert.equal(result.structuredContent.error, "incompatible_graph");
      assert.equal(result.structuredContent.remediation, "kawn update");
      // Crucially: NO real results leak out of the refusal.
      assert.doesNotMatch(text, /Context pack|hit\(s\)|Affected \(|Files to re-check/, `${tool} leaks no results`);
    }

    // Refusing must remain read-only: nothing rebuilt, the manifest untouched.
    const manifestRaw = fs.readFileSync(path.join(incompatRoot, ".kawn", "manifest.json"), "utf8");
    assert.match(manifestRaw, new RegExp(`"schemaVersion":\\s*${GRAPH_SCHEMA_VERSION + 1}`), "manifest left as-is");
  } finally {
    fs.rmSync(incompatRoot, { recursive: true, force: true });
  }
});
