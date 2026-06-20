import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { AtharNode, AtharEdge, edgeId } from "@athar/shared";
import { makeGraph, mkTmp, writeGraphFile, rpcRoundtrip, RpcResult } from "./helpers";

// ---- a small, valid graph the server can serve ----------------------------

function fixtureGraph() {
  const nodes: AtharNode[] = [
    { id: "file:route.ts", type: "file", layer: "code", label: "route.ts", sourcePath: "app/oauth/route.ts" },
    { id: "function:route.ts#GET", type: "function", layer: "code", label: "GET", sourcePath: "app/oauth/route.ts", lineStart: 3, lineEnd: 9 },
    { id: "function:store.ts#saveStoreTokens", type: "function", layer: "code", label: "saveStoreTokens", sourcePath: "src/store.ts", lineStart: 2, lineEnd: 6 },
    { id: "table:store_tokens", type: "table", layer: "data", label: "store_tokens", sourcePath: "db/0001.sql", lineStart: 10, lineEnd: 16 },
    { id: "doc:oauth.md", type: "doc", layer: "docs", label: "OAuth Flow", sourcePath: "docs/oauth.md" },
  ];
  const e = (t: AtharEdge["type"], from: string, to: string): AtharEdge => ({
    id: edgeId(t, from, to), from, to, type: t, confidence: "linked", evidence: { sourcePath: "x", lineStart: 1 },
  });
  const edges: AtharEdge[] = [
    e("defines", "file:route.ts", "function:route.ts#GET"),
    e("calls", "function:route.ts#GET", "function:store.ts#saveStoreTokens"),
    e("writes_table", "function:store.ts#saveStoreTokens", "table:store_tokens"),
    e("documents", "doc:oauth.md", "file:route.ts"),
  ];
  return makeGraph(nodes, edges);
}

let validRoot: string;
let missingRoot: string;
let malformedRoot: string;
let graphFile: string;
let res: RpcResult;

const TOOL_NAMES = ["athar_context", "athar_query", "athar_affected", "athar_changes"];

before(async () => {
  validRoot = mkTmp("athar-mcp-valid-");
  missingRoot = mkTmp("athar-mcp-missing-"); // intentionally no .athar/graph.json
  malformedRoot = mkTmp("athar-mcp-bad-");
  graphFile = writeGraphFile(validRoot, fixtureGraph());
  fs.mkdirSync(path.join(malformedRoot, ".athar"), { recursive: true });
  fs.writeFileSync(path.join(malformedRoot, ".athar", "graph.json"), "{ this is not json", "utf8");

  // One server rooted at the valid graph; missing/malformed exercised via per-call `root`.
  res = await rpcRoundtrip(
    ["--root", validRoot],
    [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } },
      { jsonrpc: "2.0", method: "notifications/initialized" }, // notification: must stay silent
      { jsonrpc: "2.0", id: 2, method: "ping" },
      { jsonrpc: "2.0", id: 3, method: "tools/list" },
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "athar_context", arguments: { task: "fix the oauth callback that writes store tokens" } } },
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "athar_query", arguments: { query: "store_tokens", mode: "code" } } },
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "athar_affected", arguments: { symbol: "saveStoreTokens" } } },
      { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "athar_context", arguments: {} } }, // missing required `task`
      { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "does_not_exist", arguments: {} } }, // unknown tool
      { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "athar_query", arguments: { query: "x", root: missingRoot } } }, // missing graph
      { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "athar_query", arguments: { query: "x", root: malformedRoot } } }, // malformed graph
      { jsonrpc: "2.0", id: 11, method: "this/method/does/not/exist" }, // unknown method WITH id
      { jsonrpc: "2.0", id: 12, method: "tools/call", params: { name: "athar_changes", arguments: {} } }, // valid graph, but not a git repo
      "{ this is not valid json", // malformed transport line → parse error
    ],
  );
});

after(() => {
  for (const d of [validRoot, missingRoot, malformedRoot]) fs.rmSync(d, { recursive: true, force: true });
});

test("initialize returns serverInfo and echoes the protocol version", () => {
  const r = res.byId.get(1);
  assert.ok(r, "no response to initialize");
  assert.equal(r.result.serverInfo.name, "athar");
  assert.equal(r.result.protocolVersion, "2024-11-05");
  assert.ok(r.result.capabilities && r.result.capabilities.tools, "advertises tools capability");
});

test("the initialized notification produces no response (notifications stay silent)", () => {
  // Every emitted message must carry an id; a silent notification adds none.
  assert.ok(res.messages.every((m) => "id" in m || "error" in m), "no spurious notification echo");
});

test("ping returns an empty result", () => {
  assert.deepEqual(res.byId.get(2).result, {});
});

test("tools/list advertises exactly the four tools with input schemas", () => {
  const tools = res.byId.get(3).result.tools as Array<{ name: string; inputSchema: any }>;
  assert.equal(tools.length, 4);
  assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOL_NAMES].sort());
  for (const t of tools) assert.equal(t.inputSchema.type, "object", `${t.name} has an object input schema`);
});

test("athar_context returns a formatted, deterministic Context Pack", () => {
  const r = res.byId.get(4).result;
  assert.ok(!r.isError, "context call should succeed");
  const text = r.content[0].text as string;
  assert.match(text, /Context pack/);
  assert.match(text, /MUST READ/);
  assert.match(text, /TABLES/);
});

test("athar_query returns ranked, mode-scoped hits with no doc leakage in code mode", () => {
  const r = res.byId.get(5).result;
  assert.ok(!r.isError);
  const text = r.content[0].text as string;
  assert.match(text, /store_tokens/);
  assert.doesNotMatch(text, /\[doc\]|\[section\]/, "code mode must not leak docs");
});

test("athar_affected reports reverse impact", () => {
  const r = res.byId.get(6).result;
  assert.ok(!r.isError);
  const text = r.content[0].text as string;
  assert.match(text, /matched|Affected|Nothing depends/);
});

test("athar_changes degrades gracefully when the graph root is not a git repo", () => {
  const r = res.byId.get(12).result;
  // The graph is valid, so this is NOT a hard error — it is an in-band message
  // explaining there is no git work tree to diff (read-only, local git only).
  const text = r.content[0].text as string;
  assert.match(text, /Cannot read changes|not inside a git repository/);
});

test("missing required argument is an in-band tool error, not a crash", () => {
  const r = res.byId.get(7).result;
  assert.equal(r.isError, true);
  assert.match(r.content[0].text as string, /task/);
});

test("unknown tool is reported as an in-band error", () => {
  const r = res.byId.get(8).result;
  assert.equal(r.isError, true);
  assert.match(r.content[0].text as string, /Unknown tool/);
});

test("a missing graph yields a helpful 'run athar scan' error", () => {
  const r = res.byId.get(9).result;
  assert.equal(r.isError, true);
  assert.match(r.content[0].text as string, /scan/);
});

test("a malformed graph fails gracefully in-band", () => {
  const r = res.byId.get(10).result;
  assert.equal(r.isError, true);
});

test("an unknown method WITH an id returns JSON-RPC error -32601", () => {
  const r = res.byId.get(11);
  assert.ok(r.error, "expected an error object");
  assert.equal(r.error.code, -32601);
});

test("a malformed transport line returns a -32700 parse error", () => {
  const parseErr = res.messages.find((m) => m.error && m.error.code === -32700);
  assert.ok(parseErr, "expected a parse-error response");
  assert.equal(parseErr.id, null);
});

test("the server shuts down cleanly after stdin closes", () => {
  assert.equal(res.exitCode, 0);
});

test("serving is READ-ONLY: the graph file is never modified and no graph is created", () => {
  const after = fs.statSync(graphFile);
  // The file still parses to the same graph we wrote (untouched by serving).
  const parsed = JSON.parse(fs.readFileSync(graphFile, "utf8"));
  assert.equal(parsed.stats.nodes, 5);
  assert.ok(after.size > 0);
  // The server must NOT have built a graph in the missing-root dir.
  assert.equal(fs.existsSync(path.join(missingRoot, ".athar", "graph.json")), false, "server must never scan/create a graph");
});
