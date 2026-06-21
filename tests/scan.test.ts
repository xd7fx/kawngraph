import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createLogger } from "@kawngraph/shared";
import { scanRepo, affected, affectedFiles } from "@kawngraph/core";
import { mkTmp } from "./helpers";

const quiet = createLogger("error");
let root: string;

before(() => {
  root = mkTmp("kawn-scan-");
  const w = (rel: string, content: string) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  };
  w("package.json", JSON.stringify({ name: "fixture-pkg", version: "0.0.0" }));
  w("src/b.ts", `export function bar(): number { return 1; }\n`);
  w("src/a.ts", `import { bar } from "./b";\nexport function foo(): number { return bar(); }\n`);
  // a *.test.ts file must light up the test layer/type yet stay wired into the graph
  w("src/a.test.ts", `import { bar } from "./b";\nexport function testBar(): void { bar(); }\n`);
  w("db/schema.sql", `create table widgets (\n  id integer primary key,\n  name text\n);\n`);
  w("docs/guide.md", `# Guide\n\nThe [foo helper](src/a.ts) calls bar.\n\nIt persists into the \`widgets\` table.\n`);
  // These live under default-ignored directories and must never be scanned.
  w("node_modules/dep/index.ts", `export const SHOULD_NOT_APPEAR = 42;\n`);
  w("dist/built.ts", `export const ALSO_IGNORED = 1;\n`);
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test("scan finds code symbols and resolves a relative import edge", async () => {
  const g = await scanRepo({ root, logger: quiet });
  assert.ok(g.nodes.find((n) => n.id === "function:src/a.ts#foo"), "foo should be a node");
  assert.ok(g.nodes.find((n) => n.id === "function:src/b.ts#bar"), "bar should be a node");
  const imp = g.edges.find((e) => e.type === "imports" && e.from === "file:src/a.ts" && e.to === "file:src/b.ts");
  assert.ok(imp, "a.ts imports b.ts should be an edge");
});

test("SQL is never excluded by default", async () => {
  const g = await scanRepo({ root, logger: quiet });
  const table = g.nodes.find((n) => n.type === "table" && n.label === "widgets");
  assert.ok(table, "widgets table must be in the graph");
});

test("default-ignored directories (node_modules, dist) are not scanned", async () => {
  const g = await scanRepo({ root, logger: quiet });
  const leaked = g.nodes.filter((n) => /(^|\/)(node_modules|dist)\//.test(n.sourcePath));
  assert.equal(leaked.length, 0, `ignored dirs leaked: ${leaked.map((n) => n.sourcePath).join(", ")}`);
});

test("every edge carries evidence", async () => {
  const g = await scanRepo({ root, logger: quiet });
  const noEvidence = g.edges.filter((e) => !e.evidence || !e.evidence.sourcePath);
  assert.equal(noEvidence.length, 0, "every edge must keep its evidence");
});

test("two scans of an unchanged tree are identical (deterministic + stable IDs)", async () => {
  const a = await scanRepo({ root, logger: quiet });
  const b = await scanRepo({ root, logger: quiet });
  const strip = (g: Awaited<ReturnType<typeof scanRepo>>) =>
    JSON.stringify({ nodes: g.nodes, edges: g.edges, stats: g.stats });
  assert.equal(strip(a), strip(b));
});

test("docs link to code with evidence (documents/explains/mentions)", async () => {
  const g = await scanRepo({ root, logger: quiet });
  const docEdges = g.edges.filter((e) => ["documents", "explains", "mentions"].includes(e.type));
  assert.ok(docEdges.length > 0, "the guide should link to code");
  assert.ok(docEdges.every((e) => e.evidence?.sourcePath), "doc links keep evidence");
});

test("a *.test.ts file lights up the test layer/type AND stays in the graph (TS↔Python parity)", async () => {
  const g = await scanRepo({ root, logger: quiet });
  // the test file node is test-layered
  assert.equal(g.nodes.find((n) => n.id === "file:src/a.test.ts")?.layer, "test", "a .test.ts file is test-layered");
  // its top-level symbol is typed `test` in the `test` layer, structural kind preserved
  const sym = g.nodes.find((n) => n.id === "function:src/a.test.ts#testBar");
  assert.equal(sym?.type, "test", "a symbol in a .test.ts file is typed `test`");
  assert.equal(sym?.layer, "test", "…and lives in the test layer");
  assert.equal(sym?.metadata?.["kind"], "function", "structural kind preserved in metadata");
  assert.equal(sym?.metadata?.["isTest"], true);
  // …but a test is NOT cut off from the graph: its import + call still resolve
  assert.ok(
    g.edges.some((e) => e.type === "imports" && e.from === "file:src/a.test.ts" && e.to === "file:src/b.ts"),
    "test file imports source",
  );
  assert.ok(
    g.edges.some(
      (e) => e.type === "calls" && e.from === "function:src/a.test.ts#testBar" && e.to === "function:src/b.ts#bar",
    ),
    "test calls source symbol across files",
  );
});

test("affected (reverse impact) finds callers of bar", async () => {
  const g = await scanRepo({ root, logger: quiet });
  const res = affected(g, "bar");
  assert.ok(res.matched.length >= 1, "bar should match a node");
  assert.ok(
    res.affected.some((a) => a.node.id === "function:src/a.ts#foo"),
    "foo calls bar, so foo is affected",
  );
  assert.ok(affectedFiles(res).includes("src/a.ts"));
});
