# The KawnGraph Graph Model

> One project universe. Every coding agent.

KawnGraph represents a repository as a **directed graph** of typed **nodes** and
evidence-backed **edges**, organized into **layers**. The graph is built
deterministically by scanners, stored on disk under `.kawn/`, and served
read-only to agents (via the [MCP server](../README.md#mcp)) and to humans (via
[Studio](../README.md)). This document describes the on-disk model precisely so
you can read, diff, and reason about a graph without guessing.

The canonical types live in
[`packages/shared/src/types.ts`](../packages/shared/src/types.ts); the ID scheme
lives in [`packages/shared/src/ids.ts`](../packages/shared/src/ids.ts). When this
doc and the source disagree, the source wins — open a PR against this file.

---

## 1. Two guarantees

Everything in the model rests on two promises:

1. **Stable, content-addressable IDs.** Every node ID is derived from *what the
   node is* (its kind + path/name), never from line numbers or scan order. A
   function keeps the same ID when code above it shifts down, so the graph diffs
   cleanly across scans. See [§4](#4-node-ids-content-addressable).

2. **Evidence-backed edges.** A relationship carries an `Evidence` record — a
   source path, an optional line range, and a snippet — plus a `confidence` level
   saying *how* we know it. The model treats evidence as the norm: a mechanically
   derived edge that lacks it is flagged in validation, not silently trusted. See
   [§5](#5-edges) and [§6](#6-confidence).

---

## 2. Layers

A layer is a coarse classification of *what a node is about*. The `Layer` union
declares eight values; this release's scanners populate five and reserve three.

| Layer       | Status      | What lives here                                                        |
| ----------- | ----------- | --------------------------------------------------------------------- |
| `code`      | **live**    | Source files and the functions/classes/routes defined in them.        |
| `data`      | **live**    | SQL tables and migrations.                                            |
| `config`    | **live**    | `package.json` package manifests.                                    |
| `docs`      | **live**    | Markdown docs and their headings (sections).                         |
| `test`      | **live**    | Test files and the symbols inside them (bucketed away from `code`).   |
| `visual`    | *planned*   | Images/diagrams (e.g. architecture pictures).                        |
| `decision`  | *future*    | ADRs / decision records linked to the code they govern.             |
| `runtime`   | *future*    | Runtime/observability signals.                                       |

Tests are deliberately split into their own layer (and node type) so a Context
Pack can bucket them separately and `--mode tests` can scope to them. Test
classification is **path-only and language-agnostic** — see
[`packages/shared/src/tests.ts`](../packages/shared/src/tests.ts).

---

## 3. Node kinds

The `NodeType` union declares fifteen kinds. The table below marks which kinds
the current scanners actually emit versus those that are declared and reserved
for planned/future layers. (Verify with the scanner plugins under
[`packages/scanners/src/plugins`](../packages/scanners/src/plugins).)

| Type        | Status      | Layer   | Emitted by                                  |
| ----------- | ----------- | ------- | ------------------------------------------- |
| `file`      | **emitted** | code/test | TS/JS + Python scanners                    |
| `function`  | **emitted** | code/test | TS/JS + Python scanners                    |
| `class`     | **emitted** | code/test | TS/JS + Python scanners                    |
| `route`     | **emitted** | code    | TS/JS (Next.js) + Python route extractors  |
| `test`      | **emitted** | test    | TS/JS + Python symbol extractors           |
| `table`     | **emitted** | data    | SQL scanner                                 |
| `migration` | **emitted** | data    | SQL scanner                                 |
| `doc`       | **emitted** | docs    | Markdown scanner                            |
| `section`   | **emitted** | docs    | Markdown scanner (per heading)             |
| `package`   | **emitted** | config  | package.json scanner                       |
| `symbol`    | *reserved*  | —       | generic symbol placeholder; not emitted     |
| `env`       | *reserved*  | —       | environment variables; not emitted          |
| `image`     | *reserved*  | visual  | planned                                      |
| `diagram`   | *reserved*  | visual  | planned                                      |
| `decision`  | *reserved*  | decision | future                                      |

Two deliberate omissions in the code scanners, so you don't go looking for nodes
that will never exist:

- **Methods and nested functions are not separate nodes.** A method rides on its
  class as metadata; only top-level functions and classes become nodes.
- **Ambient declarations are not claimed.** `.d.ts` / `.pyi` type-only files are
  not turned into owned nodes.

### Node shape

Every node (`KawnNode`) has:

```ts
interface KawnNode {
  id: string;                 // stable, content-addressable (see §4)
  type: NodeType;             // one of the kinds above
  layer: Layer;               // which layer it belongs to
  label: string;              // short display name (basename, symbol name, table name)
  sourcePath: string;         // repo-relative, POSIX-normalized
  lineStart?: number;         // where it is defined (optional)
  lineEnd?: number;
  metadata?: Record<string, unknown>;  // scanner-specific extras (e.g. externalImports on a file)
}
```

`lineStart`/`lineEnd` are *informational* — they tell you where to look, but they
are **never** part of the ID, which is what keeps the graph diff-stable.

---

## 4. Node IDs (content-addressable)

IDs follow the form `"<type>:<identifier>"`. Paths inside an ID are always
POSIX-normalized (`toPosix`) so IDs are stable across operating systems. The
exact constructors (from [`packages/shared/src/ids.ts`](../packages/shared/src/ids.ts)):

| Constructor                        | ID shape                              | Notes                                                        |
| ---------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| `fileId(relPath)`                  | `file:<relPath>`                      |                                                             |
| `functionId(relPath, name)`        | `function:<relPath>#<name>`           |                                                             |
| `classId(relPath, name)`           | `class:<relPath>#<name>`              |                                                             |
| `routeId(urlPath, method)`         | `route:<urlPath>#<METHOD>`            | method upper-cased                                          |
| `tableId(name)`                    | `table:<name>`                        | name lower-cased (unquoted SQL identifiers are case-insensitive) |
| `migrationId(relPath)`             | `migration:<relPath>`                 |                                                             |
| `docId(relPath)`                   | `doc:<relPath>`                       | markdown/mdx file                                           |
| `sectionId(relPath, slug)`         | `section:<relPath>#<slug>`            | `slug` is a stable, deduped heading slug                    |
| `packageId(name)`                  | `package:<name>`                      |                                                             |

Because IDs never depend on line numbers or ordering, re-scanning a file whose
contents shifted (but whose symbols are unchanged) produces the **same** IDs —
so a `git diff` of `graph.json` shows only what genuinely changed.

---

## 5. Edges

An edge (`KawnEdge`) connects two node IDs in one direction:

```ts
interface KawnEdge {
  id: string;          // deterministic: `${type}|${from}|${to}`  (see edgeId)
  from: string;        // source node ID
  to: string;          // target node ID
  type: EdgeType;      // the relationship kind
  confidence: Confidence;   // how strongly we trust it (§6)
  evidence?: Evidence;      // path + optional line range + snippet
}
```

The edge ID is `edgeId(type, from, to)` → `"<type>|<from>|<to>"`, so a re-scan
**dedupes** identical relationships instead of duplicating them.

### Evidence

```ts
interface Evidence {
  sourcePath: string;     // repo-relative file the relationship was read from
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;       // the literal text that justifies the edge
}
```

### Edge kinds

The `EdgeType` union declares fifteen kinds. Current scanners emit nine of them;
the rest are reserved for layers/features not yet live.

| Type         | Status      | Direction (typical)            | Meaning                                                     |
| ------------ | ----------- | ------------------------------ | ---------------------------------------------------------- |
| `imports`    | **emitted** | file → file                    | module import resolved to a file                           |
| `defines`    | **emitted** | file → function/class/route, migration → table | a file/migration defines a symbol/table |
| `calls`      | **emitted** | function/class → function/class | a call resolved within or across files                    |
| `references` | **emitted** | route → handler, table → table | route points at its handler; SQL foreign keys (table→table) |
| `documents`  | **emitted** | doc → file                     | a markdown link resolves to a known file node              |
| `explains`   | **emitted** | section → route/symbol/table   | a heading names a code entity                              |
| `mentions`   | **emitted** | doc → route/file/symbol/table  | the doc body references an entity                          |
| `belongs_to` | **emitted** | section → doc, package → file  | containment (a section to its doc; a package to its manifest) |
| `depends_on` | **emitted** | package → package              | a declared dependency between packages                     |
| `exports`    | *reserved*  | —                              | not currently emitted                                     |
| `reads_table`/`writes_table` | *reserved* | —              | code↔data access; not currently emitted                  |
| `tests`      | *reserved*  | —                              | test → code-under-test; not currently emitted             |
| `depicts`    | *reserved*  | —                              | visual layer; future                                      |
| `changed_by` | *reserved*  | —                              | runtime/decision layer; future                            |

> Always verify the emitted set against the scanners
> ([`packages/scanners/src`](../packages/scanners/src)) — this list reflects the
> current release and may grow as layers come online.

---

## 6. Confidence

Every edge carries a `confidence` saying how it was established:

| Confidence  | Meaning                                                              | Produced by                                  |
| ----------- | ------------------------------------------------------------------- | -------------------------------------------- |
| `extracted` | parsed directly from source (e.g. an AST import, a `CREATE TABLE`). | deterministic scanners                       |
| `linked`    | resolved by deterministic rules (e.g. a relative import → a file).  | deterministic scanners                       |
| `semantic`  | inferred by similarity/AI. **Always opt-in, local-first.**          | optional AI enrichment (not the base scan)   |
| `manual`    | asserted by a human.                                                | human authoring                              |

The base, default scan produces only `extracted` and `linked` edges — no network,
no LLM. `semantic` appears only when AI enrichment is explicitly enabled, and
`manual` only when a human asserts a relationship. This is why an agent can trust
the graph: by default every edge is mechanically derived from your source with a
snippet to prove it.

---

## 7. The whole-graph document

A scan produces a single `KawnGraph` object:

```ts
interface KawnGraph {
  kawnVersion: string;     // KawnGraph version that built it
  generatedAt: string;     // ISO timestamp
  root: string;            // scan root
  stats: GraphStats;       // counts by layer / type / edge type
  nodes: KawnNode[];
  edges: KawnEdge[];
}
```

`GraphStats` carries `nodes`, `edges`, and the `byLayer` / `byType` /
`byEdgeType` count maps that drive the report and Studio summaries.

---

## 8. What `.kawn/` contains

A scan writes to a project-local `.kawn/` directory (helpers in
[`packages/core/src/graph/graphStore.ts`](../packages/core/src/graph/graphStore.ts)
and [`manifest.ts`](../packages/core/src/graph/manifest.ts)):

| File                  | What it is                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `.kawn/graph.json`    | The canonical graph — the `KawnGraph` object above, serialized as pretty-printed JSON.            |
| `.kawn/report.md`     | A human-readable Markdown summary generated from the graph.                                       |
| `.kawn/manifest.json` | A freshness record (see below) so readers can tell whether the graph is still current.            |

### `graph.json` — deterministic & diffable

`serializeGraph`
([`serializeGraph.ts`](../packages/core/src/graph/serializeGraph.ts)) sorts
nodes and edges by ID before writing and emits `JSON.stringify(..., 2)` with a
trailing newline. Combined with content-addressable IDs, this means two scans of
the same code produce **byte-identical** files — `graph.json` is meant to be
committed and reviewed in PRs.

### `report.md` — the human summary

`generateReport`
([`generateReport.ts`](../packages/core/src/report/generateReport.ts)) renders:

- Header: generated timestamp, root, KawnGraph version, node/edge totals.
- Count tables: **nodes by layer**, **nodes by type**, **edges by type**.
- **Most connected nodes** (top 15 by in+out degree).
- **Routes**, **Tables** (with foreign keys, i.e. table→table `references`),
  **Docs** (with section counts and their code links), and **Packages** (with
  their `depends_on` edges) — each section appears only when such nodes exist.

### `manifest.json` — freshness, without rebuilding

The manifest (`GraphManifest`) lets `kawn check` (status/doctor), the MCP server,
and Studio answer *"is this graph still trustworthy?"* **without** re-scanning —
building stays an explicit CLI step (`kawn scan` / `kawn update`). It records:

- `schemaVersion` (currently **1**, `GRAPH_SCHEMA_VERSION`) and `kawnVersion`.
- `scannedAt`, the scan `root` and a `rootFingerprint` (hash of the normalized root).
- `gitHead` at scan time (or `null` outside a git repo).
- `trackedFileCount`, `nodes`, `edges`.
- `graphHash` — a SHA-256 of the canonical `graph.json` bytes.

`graphFreshness` classifies the on-disk graph as `fresh`, `possibly-stale`,
`stale`, `missing`, `malformed`, or `incompatible` — e.g. it reports
`incompatible` when `schemaVersion` doesn't match, `possibly-stale` when
`graph.json` was edited out-of-band (hash mismatch) or the working tree is dirty,
and `stale` when git HEAD has moved since the scan. The one safe remediation it
points to is always `kawn update`.

---

## See also

- [README.md](../README.md) — overview, install, and commands.
- [`packages/shared/src/types.ts`](../packages/shared/src/types.ts) — the source of truth for nodes, edges, layers, confidence.
- [`packages/shared/src/ids.ts`](../packages/shared/src/ids.ts) — the ID scheme.
- [`packages/scanners/src`](../packages/scanners/src) — what each scanner actually emits.
