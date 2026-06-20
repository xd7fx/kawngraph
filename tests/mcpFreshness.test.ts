import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { AtharNode, AtharEdge, edgeId } from "@athar/shared";
import { makeGraph, mkTmp, writeGraphFile, rpcRoundtrip, RpcResult } from "./helpers";

// A tiny valid graph. We deliberately write graph.json WITHOUT a manifest, so
// graphFreshness() classifies it "possibly-stale" — a deterministic, git-free
// way to exercise the read-only freshness banner.
function fixtureGraph() {
  const nodes: AtharNode[] = [
    { id: "file:a.ts", type: "file", layer: "code", label: "a.ts", sourcePath: "src/a.ts" },
    { id: "function:a.ts#run", type: "function", layer: "code", label: "run", sourcePath: "src/a.ts", lineStart: 1, lineEnd: 3 },
  ];
  const edges: AtharEdge[] = [
    { id: edgeId("defines", "file:a.ts", "function:a.ts#run"), from: "file:a.ts", to: "function:a.ts#run", type: "defines", confidence: "linked", evidence: { sourcePath: "src/a.ts", lineStart: 1 } },
  ];
  return makeGraph(nodes, edges);
}

let validRoot: string;
let missingRoot: string;
let res: RpcResult;

before(async () => {
  validRoot = mkTmp("athar-fresh-valid-");
  missingRoot = mkTmp("athar-fresh-missing-");
  writeGraphFile(validRoot, fixtureGraph()); // graph present, no manifest → possibly-stale

  res = await rpcRoundtrip(
    ["--root", validRoot],
    [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "athar_context", arguments: { task: "trace run" } } },
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "athar_context", arguments: { task: "x", root: missingRoot } } },
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
  assert.match(r.instructions, /athar_context/, "tells the agent to call athar_context");
  assert.match(r.instructions, /READ-ONLY/, "states the read-only contract");
  assert.match(r.instructions, /athar update/, "points to the one safe refresh command");
});

test("tool descriptions are sharpened and flag the read-only contract", () => {
  const tools = res.byId.get(2).result.tools as Array<{ name: string; description: string }>;
  for (const t of tools) {
    assert.match(t.description, /Read-only\.?$/, `${t.name} description ends by stating it is read-only`);
  }
  const ctx = tools.find((t) => t.name === "athar_context")!;
  assert.match(ctx.description, /FIRST/, "athar_context tells the agent to call it first");
});

test("a possibly-stale graph (no manifest) prepends a freshness note, still serving the pack", () => {
  const r = res.byId.get(3).result;
  assert.ok(!r.isError, "the call still succeeds — read-only never blocks on staleness");
  const text = r.content[0].text as string;
  assert.match(text, /^\[athar\] note:/, "a low-severity freshness note is prepended");
  assert.match(text, /athar update/, "the note points to the refresh command");
  assert.match(text, /Context pack/, "the actual pack is still returned below the note");
});

test("an error response (missing graph) carries no freshness banner", () => {
  const r = res.byId.get(4).result;
  assert.equal(r.isError, true);
  const text = r.content[0].text as string;
  assert.doesNotMatch(text, /\[athar\] note:|STALE GRAPH/, "no banner on the error path");
  assert.match(text, /scan/, "instead it tells the user to scan");
});

test("serving never writes a manifest or mutates the graph (read-only)", () => {
  // The server must not have created a manifest just by being queried.
  assert.equal(fs.existsSync(`${validRoot}/.athar/manifest.json`), false, "no manifest written by serving");
  assert.equal(fs.existsSync(`${missingRoot}/.athar/graph.json`), false, "no graph built for the missing root");
});
