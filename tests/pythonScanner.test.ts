import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createLogger } from "@kawngraph/shared";
import type { KawnEdge, KawnNode } from "@kawngraph/shared";
import { ScannerRegistry, toInputs } from "@kawngraph/scanner-sdk";
import { builtinScannerPlugins, scanPython, type PyScanContext } from "@kawngraph/scanners";
import { scanRepo } from "@kawngraph/core";
import { mkTmp } from "./helpers";

/**
 * Python scanner (W3) coverage. The scanner is built on the mature
 * `@lezer/python` structural grammar — never regex — so these tests pin the
 * behaviour that matters for the graph: only top-level functions/classes become
 * nodes; calls attribute to their enclosing top-level scope; imports resolve
 * honestly against the known file set (absolute, relative, package `__init__`);
 * FastAPI/Flask routes mirror the Next.js route model; and malformed/unicode
 * input degrades gracefully without throwing.
 */

const NO_RESOLVE: PyScanContext = { resolveModule: () => null };

const hasEdge = (edges: KawnEdge[], type: string, from: string, to: string): boolean =>
  edges.some((e) => e.type === type && e.from === from && e.to === to);
const node = (nodes: KawnNode[], id: string): KawnNode | undefined => nodes.find((n) => n.id === id);
const externalImports = (n: KawnNode | undefined): string[] =>
  (n?.metadata?.["externalImports"] as string[] | undefined) ?? [];

// --- Single-file behaviour via scanPython directly ---------------------------

test("only top-level functions/classes become nodes (methods + nested are not)", () => {
  const src = [
    "import os",
    "",
    "",
    "def top_func():",
    "    return 1",
    "",
    "",
    "async def async_func():",
    "    return 2",
    "",
    "",
    "def _private():",
    "    return 3",
    "",
    "",
    "class Widget:",
    "    def method(self):",
    "        def nested():",
    "            return 4",
    "        return nested()",
    "",
  ].join("\n");
  const r = scanPython("mod.py", src, NO_RESOLVE);

  // top-level symbols are present
  assert.ok(node(r.nodes, "function:mod.py#top_func"), "top_func is a node");
  assert.ok(node(r.nodes, "function:mod.py#async_func"), "async_func is a node");
  assert.ok(node(r.nodes, "function:mod.py#_private"), "_private is a node");
  assert.ok(node(r.nodes, "class:mod.py#Widget"), "Widget is a node");
  // methods and nested functions are NOT separate nodes (mirrors the TS scanner)
  assert.ok(!node(r.nodes, "function:mod.py#method"), "methods are not nodes");
  assert.ok(!node(r.nodes, "function:mod.py#nested"), "nested functions are not nodes");

  // …but a class's direct methods are kept as evidence-rich metadata on the class
  const widgetMethods = node(r.nodes, "class:mod.py#Widget")?.metadata?.["methods"] as
    | { name: string; line: number; async: boolean }[]
    | undefined;
  assert.deepEqual(
    widgetMethods?.map((m) => m.name),
    ["method"],
    "only the class's own method is captured (the nested function is not)",
  );
  assert.equal(widgetMethods?.[0]?.line, 17, "method carries its own source line as evidence");
  assert.equal(widgetMethods?.[0]?.async, false);

  // metadata: async flag + export heuristic (leading underscore = not exported)
  assert.equal(node(r.nodes, "function:mod.py#async_func")?.metadata?.["async"], true);
  assert.equal(node(r.nodes, "function:mod.py#top_func")?.metadata?.["async"], false);
  assert.equal(node(r.nodes, "function:mod.py#top_func")?.metadata?.["exported"], true);
  assert.equal(node(r.nodes, "function:mod.py#_private")?.metadata?.["exported"], false);

  // each symbol has a defines edge from the file
  for (const id of [
    "function:mod.py#top_func",
    "function:mod.py#async_func",
    "function:mod.py#_private",
    "class:mod.py#Widget",
  ]) {
    assert.ok(hasEdge(r.edges, "defines", "file:mod.py", id), `defines ${id}`);
  }

  // unresolved stdlib import is recorded as external, never invented as an edge
  assert.deepEqual(externalImports(node(r.nodes, "file:mod.py")), ["os"]);
  assert.ok(!r.edges.some((e) => e.type === "imports"), "no invented import edge");
});

test("calls attribute to the enclosing top-level scope; attribute calls are skipped", () => {
  const src = [
    "def helper():",
    "    return 1",
    "",
    "",
    "def main():",
    "    return helper()",
    "",
    "",
    "class Service:",
    "    def run(self):",
    "        helper()",
    "        self.configure()",
    "",
  ].join("\n");
  const r = scanPython("calls.py", src, NO_RESOLVE);

  // module-level call resolves to a same-file symbol
  assert.ok(hasEdge(r.edges, "calls", "function:calls.py#main", "function:calls.py#helper"));
  // a call inside a method attributes to the enclosing top-level CLASS (a real node)
  assert.ok(hasEdge(r.edges, "calls", "class:calls.py#Service", "function:calls.py#helper"));
  // `self.configure()` is an attribute call → never an edge (avoids false positives)
  assert.ok(
    !r.edges.some((e) => e.type === "calls" && e.to.endsWith("#configure")),
    "attribute calls are skipped",
  );
  assert.ok(r.edges.every((e) => !!e.evidence?.sourcePath), "every edge keeps evidence");
});

test("FastAPI/APIRouter decorators produce route nodes + defines + references", () => {
  const src = [
    "from fastapi import FastAPI, APIRouter",
    "",
    "app = FastAPI()",
    "router = APIRouter()",
    "",
    "",
    '@app.get("/items")',
    "def list_items():",
    "    return []",
    "",
    "",
    '@router.post("/items")',
    "def create_item():",
    "    return {}",
    "",
  ].join("\n");
  const r = scanPython("api.py", src, NO_RESOLVE);

  const get = r.nodes.find((n) => n.type === "route" && n.metadata?.["method"] === "GET");
  const post = r.nodes.find((n) => n.type === "route" && n.metadata?.["method"] === "POST");
  assert.ok(get && get.metadata?.["url"] === "/items", "GET /items route node");
  assert.ok(post && post.metadata?.["url"] === "/items", "POST /items route node");
  assert.equal(get!.label, "GET /items");

  assert.ok(hasEdge(r.edges, "defines", "file:api.py", get!.id), "file defines GET route");
  assert.ok(hasEdge(r.edges, "defines", "file:api.py", post!.id), "file defines POST route");
  assert.ok(hasEdge(r.edges, "references", get!.id, "function:api.py#list_items"));
  assert.ok(hasEdge(r.edges, "references", post!.id, "function:api.py#create_item"));
  // handlers are also plain function nodes
  assert.ok(node(r.nodes, "function:api.py#list_items"));
  assert.ok(node(r.nodes, "function:api.py#create_item"));
  // FastAPI()/APIRouter() constructors must not become call edges
  assert.ok(!r.edges.some((e) => e.type === "calls"), "no spurious call edges from constructors");
});

test("Flask @app.route(methods=[...]) expands to one route per verb; default GET", () => {
  const src = [
    "from flask import Flask",
    "",
    "app = Flask(__name__)",
    "",
    "",
    '@app.route("/users", methods=["GET", "POST"])',
    "def users():",
    '    return ""',
    "",
    "",
    '@app.route("/health")',
    "def health():",
    '    return "ok"',
    "",
  ].join("\n");
  const r = scanPython("flask_app.py", src, NO_RESOLVE);

  const routes = r.nodes.filter((n) => n.type === "route");
  const sig = (n: KawnNode) => `${n.metadata?.["method"]} ${n.metadata?.["url"]}`;
  const sigs = routes.map(sig).sort();
  assert.deepEqual(sigs, ["GET /health", "GET /users", "POST /users"]);

  const usersGet = routes.find((n) => sig(n) === "GET /users")!;
  const usersPost = routes.find((n) => sig(n) === "POST /users")!;
  assert.ok(hasEdge(r.edges, "references", usersGet.id, "function:flask_app.py#users"));
  assert.ok(hasEdge(r.edges, "references", usersPost.id, "function:flask_app.py#users"));
});

test("malformed Python degrades without throwing (error-tolerant parse)", () => {
  const src = ["def broken(:", "    return", "", "class", "", "def ok():", "    return 1", ""].join("\n");
  let r: ReturnType<typeof scanPython> | undefined;
  assert.doesNotThrow(() => {
    r = scanPython("broken.py", src, NO_RESOLVE);
  });
  // the file node always exists; recovery may still capture the well-formed def
  assert.ok(node(r!.nodes, "file:broken.py"), "file node survives a broken parse");
});

test("unicode identifiers are captured as symbols and call edges", () => {
  const src = ["def café():", "    return 1", "", "", "def main():", "    return café()", ""].join("\n");
  const r = scanPython("uni.py", src, NO_RESOLVE);
  assert.ok(
    r.nodes.some((n) => n.type === "function" && n.label === "café"),
    "unicode function name is captured",
  );
  assert.ok(hasEdge(r.edges, "calls", "function:uni.py#main", "function:uni.py#café"));
});

test("pytest-style test modules emit test-layer nodes; pytest stays external", () => {
  const src = [
    "import pytest",
    "",
    "",
    "def test_addition():",
    "    assert add(1, 2) == 3",
    "",
    "",
    "@pytest.fixture",
    "def client():",
    "    return object()",
    "",
  ].join("\n");
  const r = scanPython("tests/test_calc.py", src, NO_RESOLVE);

  // a test file lights up the `test` layer/type so the Context Pack can bucket it
  const testFn = node(r.nodes, "function:tests/test_calc.py#test_addition");
  assert.ok(testFn, "test fn is a node");
  assert.equal(testFn?.type, "test", "test-file symbol is typed `test`");
  assert.equal(testFn?.layer, "test", "test-file symbol lives in the `test` layer");
  assert.equal(testFn?.metadata?.["isTest"], true);
  assert.equal(testFn?.metadata?.["kind"], "function", "structural kind is preserved in metadata");

  // even non-`test_` helpers in a test file are test code (a fixture here)
  const fixture = node(r.nodes, "function:tests/test_calc.py#client");
  assert.equal(fixture?.type, "test");
  assert.deepEqual(fixture?.metadata?.["decorators"], ["pytest.fixture"], "decorator name captured");

  // the test file node itself is in the test layer
  assert.equal(node(r.nodes, "file:tests/test_calc.py")?.layer, "test");
  // pytest is third-party → recorded as external, never an invented edge
  assert.deepEqual(externalImports(node(r.nodes, "file:tests/test_calc.py")), ["pytest"]);
});

test("decorator names are captured as metadata (dotted + stacked)", () => {
  const src = [
    "from fastapi import FastAPI",
    "",
    "app = FastAPI()",
    "",
    "",
    '@app.get("/ping")',
    "@some_decorator",
    "def ping():",
    "    return 1",
    "",
  ].join("\n");
  const r = scanPython("api2.py", src, NO_RESOLVE);
  const ping = node(r.nodes, "function:api2.py#ping");
  assert.equal(ping?.type, "function", "non-test handler stays a function node");
  assert.deepEqual(ping?.metadata?.["decorators"], ["app.get", "some_decorator"]);
});

test("class methods are captured as metadata (name, async, decorators); order preserved", () => {
  const src = [
    "class Model:",
    "    @property",
    "    def name(self):",
    "        return self._n",
    "    async def save(self):",
    "        return 1",
    "    def _private(self):",
    "        return 2",
    "",
  ].join("\n");
  const r = scanPython("models.py", src, NO_RESOLVE);
  const methods = node(r.nodes, "class:models.py#Model")?.metadata?.["methods"] as
    | { name: string; async: boolean; decorators?: string[]; isTest?: boolean }[]
    | undefined;
  assert.deepEqual(
    methods?.map((m) => ({ name: m.name, async: m.async, decorators: m.decorators })),
    [
      { name: "name", async: false, decorators: ["property"] },
      { name: "save", async: true, decorators: undefined },
      { name: "_private", async: false, decorators: undefined },
    ],
  );
});

test("unittest TestCase under a test path: class typed `test`, test_* methods flagged", () => {
  const src = [
    "import unittest",
    "",
    "",
    "class TestWidget(unittest.TestCase):",
    "    def setUp(self):",
    "        self.w = 1",
    "    def test_value(self):",
    "        assert self.w == 1",
    "    def helper(self):",
    "        return 2",
    "",
  ].join("\n");
  const r = scanPython("tests/test_widget.py", src, NO_RESOLVE);
  const cls = node(r.nodes, "class:tests/test_widget.py#TestWidget");
  assert.equal(cls?.type, "test", "a class in a test file is typed `test`");
  assert.equal(cls?.layer, "test");
  assert.equal(cls?.metadata?.["kind"], "class");
  const methods = cls?.metadata?.["methods"] as { name: string; isTest?: boolean }[] | undefined;
  assert.deepEqual(methods?.map((m) => m.name), ["setUp", "test_value", "helper"]);
  assert.equal(methods?.find((m) => m.name === "test_value")?.isTest, true);
  assert.equal(methods?.find((m) => m.name === "setUp")?.isTest, undefined);
  assert.deepEqual(externalImports(node(r.nodes, "file:tests/test_widget.py")), ["unittest"]);
});

test("module docstring is captured on the file node", () => {
  const src = ['"""Top-level module summary."""', "import os", "", "def f():", "    return 1", ""].join("\n");
  const r = scanPython("docmod.py", src, NO_RESOLVE);
  assert.equal(node(r.nodes, "file:docmod.py")?.metadata?.["docstring"], "Top-level module summary.");
  assert.deepEqual(externalImports(node(r.nodes, "file:docmod.py")), ["os"]);
});

test("error-tolerant parse still captures a clean decorated def before broken code", () => {
  const src = ['@app.route("/ok")', "def good():", "    return 1", "", "def broken(:", "    pass", ""].join("\n");
  let r: ReturnType<typeof scanPython> | undefined;
  assert.doesNotThrow(() => {
    r = scanPython("partial.py", src, NO_RESOLVE);
  });
  const good = node(r!.nodes, "function:partial.py#good");
  assert.ok(good, "the well-formed def survives a later syntax error");
  assert.deepEqual(good?.metadata?.["decorators"], ["app.route"]);
});

test("scanPython is deterministic across runs", () => {
  const src = ["def a():\n    return b()", "", "def b():\n    return 1", ""].join("\n");
  const fp = () => JSON.stringify(scanPython("d.py", src, NO_RESOLVE));
  assert.equal(fp(), fp());
});

// --- Cross-file resolution via the registry (honest, knownFiles-backed) -------

async function runReg(files: Record<string, string>) {
  const reg = new ScannerRegistry();
  for (const p of builtinScannerPlugins()) assert.equal(reg.register(p), true, "register plugin");
  return reg.scan(toInputs(files));
}

test("imports resolve across files: absolute, relative, and external", async () => {
  const { nodes, edges } = await runReg({
    "package.json": JSON.stringify({ name: "pyapp", version: "1.0.0" }),
    "app/main.py": [
      "from app.services import load_user",
      "from .helpers import format_name",
      "import os",
      "",
      "def run():",
      "    return format_name(load_user())",
      "",
    ].join("\n"),
    "app/services.py": "def load_user():\n    return {}\n",
    "app/helpers.py": "def format_name(x):\n    return x\n",
  });

  assert.ok(hasEdge(edges, "imports", "file:app/main.py", "file:app/services.py"), "absolute import");
  assert.ok(hasEdge(edges, "imports", "file:app/main.py", "file:app/helpers.py"), "relative import");
  assert.deepEqual(externalImports(node(nodes, "file:app/main.py")), ["os"], "stdlib stays external");
});

test("cross-file calls link to the imported symbol with linked confidence", async () => {
  const { edges } = await runReg({
    "package.json": JSON.stringify({ name: "pyapp", version: "1.0.0" }),
    "app/main.py": "from app.services import load_user\n\ndef run():\n    return load_user()\n",
    "app/services.py": "def load_user():\n    return {}\n",
  });
  const call = edges.find(
    (e) => e.type === "calls" && e.from === "function:app/main.py#run" && e.to === "function:app/services.py#load_user",
  );
  assert.ok(call, "run() calls the imported load_user across files");
  assert.equal(call!.confidence, "linked", "cross-file call is linked, not extracted");
});

test("a test module keeps its test layer AND still participates in the call graph", async () => {
  const { nodes, edges } = await runReg({
    "package.json": JSON.stringify({ name: "pyapp", version: "1.0.0" }),
    "app/calc.py": "def add(a, b):\n    return a + b\n",
    "tests/test_calc.py": [
      "from app.calc import add",
      "",
      "",
      "def test_add():",
      "    assert add(1, 2) == 3",
      "",
    ].join("\n"),
  });

  // through the full registry the test symbol is still typed/layered as a test…
  const testFn = node(nodes, "function:tests/test_calc.py#test_add");
  assert.equal(testFn?.type, "test", "registry-scanned test symbol is typed `test`");
  assert.equal(testFn?.layer, "test", "…and lives in the `test` layer");
  assert.equal(node(nodes, "file:tests/test_calc.py")?.layer, "test", "the test file node is test-layered");

  // …yet it is NOT cut off from the graph: the import resolves and the call links
  assert.ok(hasEdge(edges, "imports", "file:tests/test_calc.py", "file:app/calc.py"), "test imports source");
  const call = edges.find(
    (e) =>
      e.type === "calls" &&
      e.from === "function:tests/test_calc.py#test_add" &&
      e.to === "function:app/calc.py#add",
  );
  assert.ok(call, "the test calls the imported add() across files");
  assert.equal(call!.confidence, "linked", "a test→source call is linked, not extracted");
});

test("package __init__.py and `from . import submodule` resolve", async () => {
  const { edges } = await runReg({
    "package.json": JSON.stringify({ name: "pyapp", version: "1.0.0" }),
    "pkg/__init__.py": "",
    "pkg/models.py": "def Model():\n    return 1\n",
    "pkg/api.py": ["from . import models", "from pkg import models as m2", ""].join("\n"),
  });
  // `from . import models` -> sibling submodule file
  assert.ok(hasEdge(edges, "imports", "file:pkg/api.py", "file:pkg/models.py"), "from . import submodule");
  // `from pkg import ...` -> the package's __init__.py
  assert.ok(hasEdge(edges, "imports", "file:pkg/api.py", "file:pkg/__init__.py"), "package __init__ import");
});

// --- Full filesystem integration via scanRepo --------------------------------

const quiet = createLogger("error");
let root: string;

const FILES: Record<string, string> = {
  "package.json": JSON.stringify({ name: "pyrepo", version: "1.0.0" }),
  "src/app.py": "from .lib import compute\n\n\ndef handler():\n    return compute()\n",
  "src/lib.py": "def compute():\n    return 41\n",
  // .pyi stubs are ambient types, never source — must not produce nodes
  "src/lib.pyi": "def compute() -> int: ...\n",
  // a path with spaces must be handled verbatim
  "weird space/mod space.py": "def spaced():\n    return 1\n",
};

before(() => {
  root = mkTmp("kawn-python-");
  for (const [rel, content] of Object.entries(FILES)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test("scanRepo: reads .py, links a relative import + cross-file call, handles spaces", async () => {
  const g = await scanRepo({ root, logger: quiet });
  assert.ok(g.nodes.find((n) => n.id === "function:src/app.py#handler"), "handler node");
  assert.ok(g.nodes.find((n) => n.id === "function:src/lib.py#compute"), "compute node");
  assert.ok(hasEdge(g.edges, "imports", "file:src/app.py", "file:src/lib.py"), "relative import edge");
  assert.ok(hasEdge(g.edges, "calls", "function:src/app.py#handler", "function:src/lib.py#compute"), "linked call");
  // spaces in the path are preserved verbatim
  assert.ok(g.nodes.find((n) => n.id === "function:weird space/mod space.py#spaced"), "spaced node");
});

test("scanRepo: .pyi stub files are ignored (ambient types, not source)", async () => {
  const g = await scanRepo({ root, logger: quiet });
  assert.equal(
    g.nodes.filter((n) => n.sourcePath.endsWith(".pyi")).length,
    0,
    ".pyi files must never produce nodes",
  );
});

test("scanRepo: Python files get package membership, edges keep evidence, graph is pruned", async () => {
  const g = await scanRepo({ root, logger: quiet });
  // the package plugin attaches file membership to the nearest package
  assert.ok(hasEdge(g.edges, "belongs_to", "file:src/app.py", "package:pyrepo"), "file belongs to package");
  // every edge endpoint resolves to a node (no dangling cross-file edges)
  const ids = new Set(g.nodes.map((n) => n.id));
  for (const e of g.edges) {
    assert.ok(ids.has(e.from), `edge from ${e.from} resolves`);
    assert.ok(ids.has(e.to), `edge to ${e.to} resolves`);
  }
  assert.equal(g.edges.filter((e) => !e.evidence?.sourcePath).length, 0, "every edge keeps evidence");
});

test("scanRepo over a Python tree is deterministic", async () => {
  const a = await scanRepo({ root, logger: quiet });
  const b = await scanRepo({ root, logger: quiet });
  assert.equal(JSON.stringify(a.nodes), JSON.stringify(b.nodes));
  assert.equal(JSON.stringify(a.edges), JSON.stringify(b.edges));
});
