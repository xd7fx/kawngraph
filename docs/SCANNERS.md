# Scanners

KawnGraph learns a language or file format through a **scanner plugin**. Every
plugin implements one small contract — `detect → scan → finalize` — and the
registry orchestrates them deterministically, isolates their failures, and
validates their output against what they declared they can emit.

The contract lives in [`packages/scanner-sdk`](../packages/scanner-sdk); the
five built-in plugins (TS/JS, Python, SQL, `package.json`, Markdown) live in
[`packages/scanners`](../packages/scanners). This page mirrors the
[README scanner table](../README.md#supported-scanners--layers) and adds the
exact per-language extraction detail — including what each scanner does **not**
(yet) do. For the node/edge/layer vocabulary it produces, see
[GRAPH_MODEL.md](GRAPH_MODEL.md).

---

## The plugin contract

A plugin is one object (see `ScannerPlugin` in
[`packages/scanner-sdk/src/plugin.ts`](../packages/scanner-sdk/src/plugin.ts)).
The three lifecycle methods:

| Phase | Method | Runs | Sees |
| ----- | ------ | ---- | ---- |
| **detect** | `detect(file)` | once per file | a `ScanFile` (`relPath`, `ext`, `size`) — must be pure & cheap; the **first** plugin (in order) that returns `true` owns the file |
| **scan** | `scan(file, content, ctx)` | once per owned file | the file content + a read-only `ScanContext` (resolve local imports, match workspace packages). Returns nodes + evidence-backed edges. May be `async`. |
| **finalize** | `finalize(ctx)` *(optional)* | once, after every file is scanned | the **complete** node/edge set plus this plugin's own scan contributions — used to resolve cross-file edges (docs→code, package membership) |

Each plugin also declares static metadata: a stable `id` (e.g. `builtin:code`),
its `apiVersion` (the SDK contract version it targets), `languages`,
`extensions`, an optional `order`, and its `capabilities`.

`defineScannerPlugin(plugin)` is an identity helper for editor autocomplete — it
does **not** register the plugin. Registration is always explicit (see below).

### Capabilities are a contract, validated against output

A plugin states up front what it can emit (`ScannerCapabilities` in
[`capabilities.ts`](../packages/scanner-sdk/src/capabilities.ts)):

- `nodeTypes` / `edgeTypes` — the node and edge types it may produce
- `emitsEvidence` — true if every edge it emits carries `Evidence`
- `resolvesImports` — true if its files form the import-target set (only such
  files are valid targets when the registry resolves relative specifiers)
- `crossFile` — true if it contributes cross-file edges in `finalize()`

After each `scan()`/`finalize()`, the registry runs `validateContribution`
([`validation.ts`](../packages/scanner-sdk/src/validation.ts)) against these
declarations. A node or edge whose `type` was **not** declared is **warned, not
dropped** — the declaration is the contract, but honestly surfacing real graph
data the plugin merely forgot to declare beats silently losing it. An edge
without evidence is likewise warned. The merged set of all registered plugins'
capabilities can build the Studio legend instead of hard-coding it.

---

## Registry guarantees

`ScannerRegistry`
([`registry.ts`](../packages/scanner-sdk/src/registry.ts)) runs the three phases
in order and guarantees:

- **Deterministic order.** Plugins run sorted by `order` (default `100`, lower
  first), then by `id`. The built-ins use `package(0) → code(1) → python(1) →
  sql(2) → docs(3)`, so package nodes exist before code resolves bare workspace
  imports, and docs link last against the full graph. A non-finite `order`
  (`NaN`/`Infinity`) is rejected at registration because it would make the sort
  non-deterministic.
- **Per-file failure isolation.** A `detect`, `scan`, or `finalize` that throws
  becomes a diagnostic and **never aborts the run** — every other file and
  plugin still completes. Contribution validation runs *outside* the per-file
  `try/catch` and never throws for any input (a `null`/non-object contribution
  yields an empty contribution plus a diagnostic).
- **Bounded file sizes.** Files larger than `maxFileBytes` (default **2 MiB**)
  are skipped with a `file_too_large` diagnostic before any plugin sees them.
- **Explicit registration — no auto-loading.** There is no plugin discovery; a
  host calls `register(plugin)` for each plugin itself. A dependency can never
  silently inject a scanner into someone's graph. Duplicate ids and plugins
  built against an incompatible **major** `apiVersion` are rejected with a
  diagnostic (and not added).
- **Read-only context.** Plugins receive file content; they never read the
  filesystem and never reach the network. Identical input ⇒ identical output.

A plugin test harness ([`testing.ts`](../packages/scanner-sdk/src/testing.ts))
drives plugins over in-memory files and includes an `isDeterministic()` helper
that asserts identical output across two independent runs.

---

## Built-in scanners

`builtinScannerPlugins()`
([`packages/scanners/src/plugins`](../packages/scanners/src/plugins)) returns
fresh instances of all five built-ins in their natural order. The table below is
what each one actually extracts today.

### TypeScript / JavaScript — `builtin:code`

Parses with the **TypeScript compiler API** (real AST, not regex). Owns
`.ts/.tsx/.js/.jsx/.mjs/.cjs`; declares `resolvesImports`.

| Extracts | Detail |
| -------- | ------ |
| `file` node | one per file (`test` layer if the path matches a test convention) |
| `function` / `class` (`defines`) | **top-level only**, including `const x = () => {}` / function-expression forms; `exported` flag in metadata |
| `imports` edge | `import …` and re-exports (`export { a } from "./x"`); resolves relative specifiers to a known file or a workspace package, else recorded as an external import on the file's metadata |
| `calls` edge | call expressions with a **simple identifier callee**, attributed to the enclosing function/class (or the file at module scope), resolved to same-file symbols or named imports |
| `route` node + `defines`/`references` | **Next.js App Router** `route.{ts,tsx,js,jsx}` handlers (`GET/POST/…`); `[param] → :param`, `[...slug] → :slug*`, route groups stripped |
| `test` nodes | top-level symbols in a test file become `test`-type nodes in the `test` layer |

**Does NOT (yet):** claim ambient declarations (`.d.ts` are intentionally
skipped); emit methods or nested functions as separate nodes (a method rides on
its class — see omissions below); resolve property calls (`obj.method()`) — these
are skipped to avoid false edges; resolve non-relative, non-workspace imports
(recorded as external).

### Python — `builtin:python`

Parses with **`@lezer/python`** (a real structural parser — see the rationale
below). Owns `.py`.

| Extracts | Detail |
| -------- | ------ |
| `file` node | one per file; module docstring kept in metadata |
| `function` / `class` (`defines`) | **module-level** `def` / `async def` / `class`; `exported` (heuristic: name not `_`-prefixed), `async`, and decorator names in metadata |
| methods (metadata) | a class carries its direct methods as `metadata.methods` (name + line + async + decorators) — **not** as separate nodes |
| `imports` edge | `from …` and `import …` resolved against the known file set (relative imports from the file's package, absolute from the repo root; `a/b/c` → `a/b/c.py` or `a/b/c/__init__.py`); unresolved imports recorded as external |
| `calls` edge | identifier-callee calls resolved to same-file symbols or imported names |
| `route` node + `defines`/`references` | **FastAPI / APIRouter** (`@app.get("/x")`, `@router.post(...)`) and **Flask** (`@app.route("/x", methods=[…])`) decorators on top-level handlers |
| `test` nodes | top-level symbols in a test file become `test`-type nodes in the `test` layer |

**Does NOT (yet):** claim `.pyi` stub files (the Python analogue of `.d.ts`);
emit methods or nested functions as separate nodes; resolve dynamic/conditional
imports or imports that don't map to a scanned file (recorded as external).

### SQL — `builtin:sql`

A focused, pure per-file scanner (no cross-file pass). Owns `.sql`.

| Extracts | Detail |
| -------- | ------ |
| `migration` node | one per `.sql` file (`data` layer) |
| `table` node + `defines` | `CREATE TABLE [IF NOT EXISTS] …` (schema-qualified names normalized; leading `public.` stripped) |
| `references` edge (table → table) | foreign-key `REFERENCES …`, attributed to the nearest preceding `CREATE TABLE` / `ALTER TABLE` |

**Does NOT (yet):** extract columns/types, indexes, views, or constraints beyond
foreign keys; understand stored procedures or dialect-specific DDL. (The README
table lists "columns" aspirationally; the current scanner emits table and
foreign-key relationships only.)

### package.json — `builtin:package`

Owns files named `package.json`; declares `crossFile`. Runs first (`order: 0`)
so package nodes exist before code resolves bare workspace imports.

| Extracts | Detail |
| -------- | ------ |
| `package` node (`config` layer) | one per manifest with a `name`; keeps `version`, `dir`, and the union of `dependencies` + `devDependencies` + `peerDependencies` |
| `belongs_to` edge (finalize) | every `file`/`migration` node → its nearest enclosing package (by directory) |
| `depends_on` edge (finalize) | package → package, but **only** for dependencies that are themselves workspace packages |

**Does NOT (yet):** model external (non-workspace) dependencies as nodes; parse
other manifest formats (`pyproject.toml`, `Cargo.toml`, …); resolve version
ranges. A manifest with invalid JSON or no `name` yields no node.

### Markdown / MDX — `builtin:docs`

Owns `.md` / `.mdx`; declares `crossFile`. Two passes: structure in `scan`,
code links in `finalize` (against the complete graph).

| Extracts | Detail |
| -------- | ------ |
| `doc` node (`docs` layer) | one per file (title from frontmatter/first H1); heading count + frontmatter in metadata |
| `section` node + `belongs_to` | one per heading, with a de-duplicated slug |
| `documents` edge (doc → file) | a Markdown link that resolves to a known file node |
| `explains` edge (section → route/symbol/table) | a **heading** that names a code entity |
| `mentions` edge (doc → route/file/symbol/table) | a body reference not already captured as `explains`/`documents` |

All doc→code links are deterministic and evidence-backed — **no LLM**.
Distinctive tokens (file paths, route URLs) match anywhere; plain identifiers
match as whole words and, unless "code-like," only inside code spans/fences, to
keep false positives low. HTTP-method-named route handlers are not linked as
standalone symbols (so a doc saying "GET" doesn't link every handler).

**Does NOT (yet):** follow links to external URLs or anchors; build a
table-of-contents graph beyond `section belongs_to doc`; do any semantic /
embedding-based matching.

---

## Two deliberate omissions (both code scanners)

1. **No method or nested-function nodes.** A method is recorded as metadata on
   its class, never as its own node. This keeps the graph at a consistent,
   navigable altitude (files and top-level symbols) and keeps node ids stable.
2. **No ambient declarations.** `.d.ts` (TS) and `.pyi` (Python) are never
   claimed — they describe types, not source behaviour, and would create
   phantom definitions that no runtime path exercises.

---

## Why `@lezer/python`, not tree-sitter

The Python scanner needs a **real parser** (regex can't see scope, decorators,
or import structure reliably). Among real parsers, `@lezer/python` fits the
scanner contract better than tree-sitter here:

- **Pure JS.** No native bindings and no WASM to load, so there's nothing to
  compile or ship per platform — it just works under Node everywhere,
  **including Windows**, which native tree-sitter builds make fragile.
- **Error-tolerant.** Malformed input yields a *partial* tree with error markers
  instead of throwing. A broken file degrades to whatever could be parsed rather
  than failing the file — reinforcing the registry's failure-isolation guarantee.
- **Synchronous.** It parses without an async init step, fitting the scanner's
  deterministic synchronous `scan()` path with no event-loop coordination.
- **Deterministic & reproducible.** Same input ⇒ same tree ⇒ same graph, run to
  run and machine to machine.

The trade-off is accepted knowingly: for the top-level structure KawnGraph
extracts (functions, classes, imports, decorators/routes, docstrings),
`@lezer/python` is accurate, and the cross-platform reproducibility it buys is
worth more here than any deeper analysis a heavier toolchain might offer.

---

## Writing your own scanner

Implement `ScannerPlugin`, declare honest `capabilities`, and register it
explicitly on a `ScannerRegistry` — there is no auto-loading, by design. Use the
test harness ([`testing.ts`](../packages/scanner-sdk/src/testing.ts)) and its
`isDeterministic()` helper to prove your plugin is deterministic before wiring it
in. Keep `scan()` pure (no filesystem, no network), attach `Evidence`
(`sourcePath` + line range + snippet) to every edge, and resolve only to nodes
that exist — record anything you can't resolve as an `UnresolvedRef` rather than
inventing an edge.

See also: [GRAPH_MODEL.md](GRAPH_MODEL.md) ·
[ARCHITECTURE.md](../ARCHITECTURE.md) · [README](../README.md).
