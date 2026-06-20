import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createLogger } from "@athar/shared";
import type { AtharEdge } from "@athar/shared";
import { ScannerRegistry, toInputs } from "@athar/scanner-sdk";
import { builtinScannerPlugins } from "@athar/scanners";
import { scanRepo } from "@athar/core";
import { mkTmp } from "./helpers";

/**
 * Built-in scanner migration coverage. The legacy per-kind scanners (TS/JS, SQL,
 * Markdown, package.json) now run as versioned plugins behind the ScannerRegistry.
 * These tests pin the cross-cutting behaviour that the migration must preserve:
 * the same node/edge types, the deterministic two-phase package + docs finalize,
 * nearest-package membership, workspace dependency edges, and determinism.
 */

// A multi-package fixture exercising EVERY built-in edge type in one graph:
// imports, defines, calls, references (sql FK), belongs_to, depends_on,
// documents, explains, mentions.
const FILES: Record<string, string> = {
  "package.json": JSON.stringify({ name: "@fix/root", version: "1.0.0" }),
  "packages/a/package.json": JSON.stringify({
    name: "@fix/a",
    version: "1.0.0",
    dependencies: { "@fix/b": "workspace:*" },
  }),
  "packages/b/package.json": JSON.stringify({ name: "@fix/b", version: "1.0.0" }),
  "packages/a/src/util.ts": "export function util(): number {\n  return 1;\n}\n",
  "packages/a/src/main.ts":
    'import { util } from "./util";\nexport function run(): number {\n  return util();\n}\n',
  "db/0001_init.sql":
    "create table orders (\n  id integer primary key\n);\n" +
    "create table line_items (\n  id integer primary key,\n  order_id integer references orders\n);\n",
  "docs/guide.md":
    "# Guide\n\n## run\n\nThe [run helper](packages/a/src/main.ts) calls util.\n\nIt reads the `orders` table.\n",
};

function runRegistry() {
  const reg = new ScannerRegistry();
  for (const p of builtinScannerPlugins()) assert.equal(reg.register(p), true, `register ${p.id}`);
  return reg.scan(toInputs(FILES));
}

const hasEdge = (edges: AtharEdge[], type: string, from: string, to: string) =>
  edges.some((e) => e.type === type && e.from === from && e.to === to);

test("built-in plugins register cleanly and own files by deterministic order", () => {
  assert.deepEqual(
    builtinScannerPlugins().map((p) => p.id),
    ["builtin:package", "builtin:code", "builtin:python", "builtin:sql", "builtin:docs"],
  );
  const reg = new ScannerRegistry();
  for (const p of builtinScannerPlugins()) assert.equal(reg.register(p), true);
  assert.deepEqual(
    reg.ordered().map((p) => p.id),
    ["builtin:package", "builtin:code", "builtin:python", "builtin:sql", "builtin:docs"],
  );
  assert.equal(reg.registryDiagnostics().length, 0);
});

test("scan phase emits every built-in node type", async () => {
  const res = await runRegistry();
  const ids = new Set(res.nodes.map((n) => n.id));
  // packages
  for (const id of ["package:@fix/root", "package:@fix/a", "package:@fix/b"]) assert.ok(ids.has(id), id);
  // code
  assert.ok(ids.has("file:packages/a/src/main.ts"));
  assert.ok(ids.has("file:packages/a/src/util.ts"));
  assert.ok(ids.has("function:packages/a/src/main.ts#run"));
  assert.ok(ids.has("function:packages/a/src/util.ts#util"));
  // sql + docs
  assert.ok(res.nodes.some((n) => n.type === "migration" && n.sourcePath === "db/0001_init.sql"));
  assert.ok(res.nodes.some((n) => n.type === "table" && n.label === "orders"));
  assert.ok(res.nodes.some((n) => n.type === "table" && n.label === "line_items"));
  assert.ok(res.nodes.some((n) => n.type === "doc" && n.sourcePath === "docs/guide.md"));
  assert.ok(res.nodes.some((n) => n.type === "section"));
});

test("scan phase emits same-file edges (imports, defines, calls, sql references)", async () => {
  const { edges } = await runRegistry();
  assert.ok(hasEdge(edges, "imports", "file:packages/a/src/main.ts", "file:packages/a/src/util.ts"));
  assert.ok(hasEdge(edges, "defines", "file:packages/a/src/main.ts", "function:packages/a/src/main.ts#run"));
  assert.ok(hasEdge(edges, "calls", "function:packages/a/src/main.ts#run", "function:packages/a/src/util.ts#util"));
  // SQL foreign key: line_items -> orders
  const orders = "table:orders";
  const lineItems = "table:line_items";
  assert.ok(hasEdge(edges, "references", lineItems, orders), "FK line_items -> orders");
  assert.ok(edges.every((e) => !!e.evidence?.sourcePath), "every scan edge keeps evidence");
});

test("finalize derives cross-file package edges (belongs_to nearest, depends_on workspace)", async () => {
  const { edges } = await runRegistry();
  // nearest-package membership: a/src files belong to @fix/a, NOT the root package
  assert.ok(hasEdge(edges, "belongs_to", "file:packages/a/src/main.ts", "package:@fix/a"));
  assert.ok(hasEdge(edges, "belongs_to", "file:packages/a/src/util.ts", "package:@fix/a"));
  assert.ok(
    !hasEdge(edges, "belongs_to", "file:packages/a/src/main.ts", "package:@fix/root"),
    "a/src/main.ts must not also belong to the root package",
  );
  // the migration has no nearer package than the root
  const mig = (await runRegistry()).nodes.find((n) => n.type === "migration");
  assert.ok(mig && hasEdge(edges, "belongs_to", mig.id, "package:@fix/root"));
  // workspace dependency edge
  assert.ok(hasEdge(edges, "depends_on", "package:@fix/a", "package:@fix/b"));
  assert.ok(
    !edges.some((e) => e.type === "depends_on" && e.to === "package:@fix/a"),
    "no phantom reverse dependency",
  );
});

test("finalize links docs to code (documents/explains/mentions) with evidence", async () => {
  const { edges } = await runRegistry();
  const docEdges = edges.filter((e) => ["documents", "explains", "mentions"].includes(e.type));
  assert.ok(docEdges.length > 0, "the guide should link to code");
  assert.ok(docEdges.every((e) => e.evidence?.sourcePath === "docs/guide.md"));
  // explicit markdown link resolves to the file node
  const doc = (await runRegistry()).nodes.find((n) => n.type === "doc");
  assert.ok(doc && hasEdge(edges, "documents", doc.id, "file:packages/a/src/main.ts"));
});

test("registry output is deterministic across runs", async () => {
  const fp = (r: Awaited<ReturnType<typeof runRegistry>>) =>
    JSON.stringify({
      nodes: r.nodes.map((n) => n.id).sort(),
      edges: r.edges.map((e) => e.id).sort(),
    });
  assert.equal(fp(await runRegistry()), fp(await runRegistry()));
});

// --- Integration: scanRepo now delegates to the registry over the real FS ---

const quiet = createLogger("error");
let root: string;

before(() => {
  root = mkTmp("athar-plugins-");
  for (const [rel, content] of Object.entries(FILES)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test("scanRepo integration: dedup/prune yields the workspace dependency + membership graph", async () => {
  const g = await scanRepo({ root, logger: quiet });
  assert.ok(g.edges.some((e) => e.type === "depends_on" && e.from === "package:@fix/a" && e.to === "package:@fix/b"));
  assert.ok(
    g.edges.some((e) => e.type === "belongs_to" && e.from === "file:packages/a/src/main.ts" && e.to === "package:@fix/a"),
  );
  // pruning: every edge endpoint exists as a node
  const nodeIds = new Set(g.nodes.map((n) => n.id));
  for (const e of g.edges) {
    assert.ok(nodeIds.has(e.from), `edge from ${e.from} must resolve to a node`);
    assert.ok(nodeIds.has(e.to), `edge to ${e.to} must resolve to a node`);
  }
});

test("scanRepo integration is deterministic and evidence-complete", async () => {
  const a = await scanRepo({ root, logger: quiet });
  const b = await scanRepo({ root, logger: quiet });
  assert.equal(JSON.stringify(a.nodes), JSON.stringify(b.nodes));
  assert.equal(JSON.stringify(a.edges), JSON.stringify(b.edges));
  assert.equal(a.edges.filter((e) => !e.evidence?.sourcePath).length, 0);
});
