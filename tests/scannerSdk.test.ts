import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ScannerRegistry,
  defineScannerPlugin,
  validatePlugin,
  validateContribution,
  isApiCompatible,
  majorOf,
  mergeCapabilities,
  runPlugins,
  isDeterministic,
  makeScanFile,
  EMPTY_CONTRIBUTION,
  type ScannerPlugin,
  type ScanContribution,
  type ScannerCapabilities,
} from "@kawngraph/scanner-sdk";
import type { KawnNode, KawnEdge } from "@kawngraph/shared";

const fileNode = (rel: string): KawnNode => ({
  id: `file:${rel}`,
  type: "file",
  layer: "code",
  label: rel,
  sourcePath: rel,
});

const importEdge = (from: string, to: string, withEvidence = true): KawnEdge => ({
  id: `imports|${from}|${to}`,
  from,
  to,
  type: "imports",
  confidence: "extracted",
  evidence: withEvidence ? { sourcePath: from.replace(/^file:/, "") } : undefined,
});

/** A toy TS plugin: one file node per file, plus an edge for the first relative import. */
function tsPlugin(over: Partial<ScannerPlugin> = {}): ScannerPlugin {
  return defineScannerPlugin({
    id: "test:ts",
    version: "1.0.0",
    apiVersion: "1",
    languages: ["typescript"],
    extensions: [".ts"],
    capabilities: { nodeTypes: ["file"], edgeTypes: ["imports"], emitsEvidence: true, resolvesImports: true },
    order: 1,
    detect: (f) => f.ext === ".ts",
    scan: (f, content, ctx) => {
      const nodes = [fileNode(f.relPath)];
      const edges: KawnEdge[] = [];
      const m = /from\s+["'](\.[^"']+)["']/.exec(content);
      if (m) {
        const target = ctx.resolveLocalImport(f.relPath, m[1]);
        if (target) edges.push(importEdge(`file:${f.relPath}`, `file:${target}`));
      }
      return { nodes, edges };
    },
    ...over,
  });
}

test("majorOf / isApiCompatible gate on the major version", () => {
  assert.equal(majorOf("1"), "1");
  assert.equal(majorOf("1.4.2"), "1");
  assert.equal(majorOf("v2"), "");
  assert.equal(isApiCompatible("1"), true);
  assert.equal(isApiCompatible("1.9"), true);
  assert.equal(isApiCompatible("2"), false);
  assert.equal(isApiCompatible(""), false);
});

test("mergeCapabilities unions node/edge types deterministically", () => {
  const merged = mergeCapabilities([
    { nodeTypes: ["file", "function"], edgeTypes: ["imports"], emitsEvidence: true },
    { nodeTypes: ["doc", "file"], edgeTypes: ["documents", "imports"], emitsEvidence: true },
  ]);
  assert.deepEqual(merged.nodeTypes, ["doc", "file", "function"]);
  assert.deepEqual(merged.edgeTypes, ["documents", "imports"]);
});

test("validatePlugin rejects missing scan and incompatible apiVersion", () => {
  const bad = { id: "x", version: "1", apiVersion: "1", languages: [], extensions: [], capabilities: { nodeTypes: [], edgeTypes: [], emitsEvidence: false }, detect: () => false } as unknown as ScannerPlugin;
  const v1 = validatePlugin(bad);
  assert.equal(v1.ok, false);
  assert.ok(v1.diagnostics.some((d) => d.code === "no_scan"));

  const incompatible = tsPlugin({ apiVersion: "2" });
  const v2 = validatePlugin(incompatible);
  assert.equal(v2.ok, false);
  assert.ok(v2.diagnostics.some((d) => d.code === "api_incompatible"));
});

test("registry registers valid plugins and rejects incompatible/duplicate ones", () => {
  const reg = new ScannerRegistry();
  assert.equal(reg.register(tsPlugin()), true);
  // duplicate id
  assert.equal(reg.register(tsPlugin()), false);
  // incompatible api
  assert.equal(reg.register(tsPlugin({ id: "test:ts2", apiVersion: "999" })), false);
  assert.equal(reg.list().length, 1);
  const diags = reg.registryDiagnostics();
  assert.ok(diags.some((d) => d.code === "dup_plugin"));
  assert.ok(diags.some((d) => d.code === "api_incompatible"));
});

test("detect assigns each file to the first plugin in order (no double scan)", async () => {
  const first = tsPlugin({ id: "a", order: 1, scan: (f) => ({ nodes: [{ ...fileNode(f.relPath), label: "A" }], edges: [] }) });
  const second = tsPlugin({ id: "b", order: 2, scan: (f) => ({ nodes: [{ ...fileNode(f.relPath), label: "B" }], edges: [] }) });
  const res = await runPlugins([second, first], { "x.ts": "" });
  assert.equal(res.nodes.length, 1);
  assert.equal(res.nodes[0].label, "A"); // order:1 wins despite registration order
});

test("scan resolves relative imports through the registry context", async () => {
  const res = await runPlugins(tsPlugin(), {
    "src/a.ts": "import x from './b';",
    "src/b.ts": "export const x = 1;",
  });
  const ids = res.nodes.map((n) => n.id).sort();
  assert.deepEqual(ids, ["file:src/a.ts", "file:src/b.ts"]);
  assert.ok(res.edges.some((e) => e.id === "imports|file:src/a.ts|file:src/b.ts"));
});

test("scan output is deterministic across runs", async () => {
  const files = { "src/a.ts": "import x from './b';", "src/b.ts": "", "src/c.ts": "import y from './a';" };
  assert.equal(await isDeterministic(tsPlugin(), files), true);
});

test("failure isolation: a throwing scan becomes a diagnostic, others still run", async () => {
  const boom = tsPlugin({
    id: "boom",
    order: 1,
    detect: (f) => f.relPath === "bad.ts",
    scan: () => {
      throw new Error("kaboom");
    },
  });
  const good = tsPlugin({ id: "good", order: 2 });
  const res = await runPlugins([boom, good], { "bad.ts": "x", "ok.ts": "y" });
  // good still produced the ok.ts node
  assert.ok(res.nodes.some((n) => n.id === "file:ok.ts"));
  // bad.ts produced nothing but did not crash the run
  assert.ok(!res.nodes.some((n) => n.id === "file:bad.ts"));
  assert.ok(res.diagnostics.some((d) => d.code === "scan_threw" && d.sourcePath === "bad.ts"));
});

test("evidence is warned-but-kept; missing evidence never drops the edge", async () => {
  const noEvidence = tsPlugin({
    id: "noev",
    scan: (f) => ({ nodes: [fileNode(f.relPath)], edges: [importEdge(`file:${f.relPath}`, "file:other.ts", false)] }),
  });
  const res = await runPlugins(noEvidence, { "a.ts": "" });
  assert.ok(res.edges.some((e) => e.id === "imports|file:a.ts|file:other.ts"));
  assert.ok(res.diagnostics.some((d) => d.code === "missing_evidence"));
});

test("bounded file size: oversized files are skipped with a diagnostic", async () => {
  const big = "x".repeat(5000);
  const res = await runPlugins(tsPlugin(), { "big.ts": big, "small.ts": "ok" }, { maxFileBytes: 1000 });
  assert.ok(res.nodes.some((n) => n.id === "file:small.ts"));
  assert.ok(!res.nodes.some((n) => n.id === "file:big.ts"));
  assert.ok(res.diagnostics.some((d) => d.code === "file_too_large" && d.sourcePath === "big.ts"));
});

test("finalize runs after scan with the complete node set (cross-file edges)", async () => {
  const linker = defineScannerPlugin({
    id: "linker",
    version: "1.0.0",
    apiVersion: "1",
    languages: [],
    extensions: [],
    capabilities: { nodeTypes: [], edgeTypes: ["references"], emitsEvidence: true, crossFile: true },
    order: 9,
    detect: () => false,
    scan: () => EMPTY_CONTRIBUTION,
    finalize: (ctx) => {
      const files = ctx.allNodes.filter((n) => n.type === "file").map((n) => n.id).sort();
      const edges: KawnEdge[] =
        files.length >= 2
          ? [{ id: `references|${files[0]}|${files[1]}`, from: files[0], to: files[1], type: "references", confidence: "linked", evidence: { sourcePath: "x" } }]
          : [];
      return { nodes: [], edges };
    },
  });
  const res = await runPlugins([tsPlugin(), linker], { "a.ts": "", "b.ts": "" });
  assert.ok(res.edges.some((e) => e.type === "references" && e.from === "file:a.ts" && e.to === "file:b.ts"));
});

test("validateContribution dedups nodes and drops empty-id edges", () => {
  const contrib: ScanContribution = {
    nodes: [fileNode("a.ts"), fileNode("a.ts")],
    edges: [
      importEdge("file:a.ts", "file:b.ts"),
      { id: "", from: "", to: "", type: "imports", confidence: "extracted" },
    ],
  };
  const { contribution, diagnostics } = validateContribution(contrib, "test");
  assert.equal(contribution.nodes.length, 1);
  assert.equal(contribution.edges.length, 1);
  assert.ok(diagnostics.some((d) => d.code === "dup_node"));
  assert.ok(diagnostics.some((d) => d.code === "empty_edge"));
});

test("no auto-loading: an empty registry claims nothing", async () => {
  const reg = new ScannerRegistry();
  const res = await reg.scan([{ file: makeScanFile("a.ts", "x"), content: "x" }]);
  assert.equal(res.nodes.length, 0);
  assert.equal(reg.list().length, 0);
});

// --- hardening: validation never throws, capability enforcement, stricter plugin checks ---

test("validateContribution never throws on malformed contributions", () => {
  // a null / non-object contribution yields an empty contribution + diagnostic
  const a = validateContribution(null as unknown as ScanContribution, "p");
  assert.deepEqual(a.contribution, { nodes: [], edges: [] });
  assert.ok(a.diagnostics.some((d) => d.code === "malformed_contribution"));
  const b = validateContribution("nope" as unknown as ScanContribution, "p");
  assert.ok(b.diagnostics.some((d) => d.code === "malformed_contribution"));

  // non-array nodes/edges are treated as empty, each with a diagnostic
  const c = validateContribution({ nodes: "x", edges: 5 } as unknown as ScanContribution, "p");
  assert.equal(c.contribution.nodes.length, 0);
  assert.equal(c.contribution.edges.length, 0);
  assert.ok(c.diagnostics.some((d) => d.code === "malformed_nodes"));
  assert.ok(c.diagnostics.some((d) => d.code === "malformed_edges"));

  // non-object entries inside the arrays are dropped; valid ones survive
  const d = validateContribution(
    { nodes: [null, 1, fileNode("a.ts")], edges: ["bad", { id: "", from: "", to: "" }] } as unknown as ScanContribution,
    "p",
  );
  assert.equal(d.contribution.nodes.length, 1);
  assert.equal(d.contribution.nodes[0].id, "file:a.ts");
  assert.equal(d.contribution.edges.length, 0);
  assert.ok(d.diagnostics.filter((x) => x.code === "empty_node_id").length >= 2);
  assert.ok(d.diagnostics.some((x) => x.code === "empty_edge"));
});

test("capability enforcement warns on undeclared types but keeps the data", () => {
  const fnNode: KawnNode = { id: "function:a.ts#f", type: "function", layer: "code", label: "f", sourcePath: "a.ts" };
  const callEdge: KawnEdge = {
    id: "calls|x|y", from: "x", to: "y", type: "calls", confidence: "extracted", evidence: { sourcePath: "a.ts" },
  };
  const caps: ScannerCapabilities = { nodeTypes: ["file"], edgeTypes: ["imports"], emitsEvidence: true };
  const { contribution, diagnostics } = validateContribution(
    { nodes: [fileNode("a.ts"), fnNode], edges: [importEdge("file:a.ts", "file:b.ts"), callEdge] },
    "p",
    caps,
  );
  // nothing dropped — the declaration is a contract, not a filter
  assert.equal(contribution.nodes.length, 2);
  assert.equal(contribution.edges.length, 2);
  // exactly the undeclared ones are surfaced
  assert.equal(diagnostics.filter((d) => d.code === "node_type_undeclared").length, 1);
  assert.equal(diagnostics.filter((d) => d.code === "edge_type_undeclared").length, 1);
  assert.ok(diagnostics.some((d) => d.code === "node_type_undeclared" && d.message.includes("function")));
  assert.ok(diagnostics.some((d) => d.code === "edge_type_undeclared" && d.message.includes("calls")));
});

test("registry isolates a plugin that returns a malformed (null) contribution", async () => {
  // Before hardening this threw (TypeError on null.nodes) OUTSIDE the per-file
  // try/catch and aborted the whole scan. It must now be isolated to one file.
  const nuller = tsPlugin({
    id: "nuller",
    order: 1,
    detect: (f) => f.relPath === "bad.ts",
    scan: () => null as unknown as ScanContribution,
  });
  const good = tsPlugin({ id: "good", order: 2 });
  const res = await runPlugins([nuller, good], { "bad.ts": "x", "ok.ts": "y" });
  assert.ok(res.nodes.some((n) => n.id === "file:ok.ts"), "the good plugin still ran");
  assert.ok(!res.nodes.some((n) => n.id === "file:bad.ts"));
  assert.ok(res.diagnostics.some((d) => d.code === "malformed_contribution"));
});

test("registry surfaces undeclared output types through capability enforcement", async () => {
  // declares only "file" nodes, but its scan also emits a "function" node
  const sneaky = tsPlugin({
    id: "sneaky",
    capabilities: { nodeTypes: ["file"], edgeTypes: ["imports"], emitsEvidence: true, resolvesImports: true },
    scan: (f) => ({
      nodes: [
        fileNode(f.relPath),
        { id: `function:${f.relPath}#g`, type: "function", layer: "code", label: "g", sourcePath: f.relPath },
      ],
      edges: [],
    }),
  });
  const res = await runPlugins(sneaky, { "a.ts": "" });
  assert.ok(res.nodes.some((n) => n.id === "function:a.ts#g"), "undeclared node is KEPT, not dropped");
  assert.ok(res.diagnostics.some((d) => d.code === "node_type_undeclared"));
});

test("validatePlugin rejects bad capabilities, non-finite order, and a non-function finalize", () => {
  const badCaps = validatePlugin(
    tsPlugin({ capabilities: { nodeTypes: "no", edgeTypes: [] } as unknown as ScannerCapabilities }),
  );
  assert.equal(badCaps.ok, false);
  assert.ok(badCaps.diagnostics.some((d) => d.code === "bad_capabilities"));

  const badOrder = validatePlugin(tsPlugin({ order: Number.NaN }));
  assert.equal(badOrder.ok, false);
  assert.ok(badOrder.diagnostics.some((d) => d.code === "bad_order"));

  const badFinalize = validatePlugin(tsPlugin({ finalize: 123 as unknown as ScannerPlugin["finalize"] }));
  assert.equal(badFinalize.ok, false);
  assert.ok(badFinalize.diagnostics.some((d) => d.code === "bad_finalize"));
});

test("registry refuses to register a plugin with non-finite order", () => {
  const reg = new ScannerRegistry();
  assert.equal(reg.register(tsPlugin({ order: Number.POSITIVE_INFINITY })), false);
  assert.ok(reg.registryDiagnostics().some((d) => d.code === "bad_order"));
});
