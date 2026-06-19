# Athar — Architecture

This document defines the data model, the pipeline that builds it, and the
safety model that keeps Athar trustworthy. It is the contract the code is held
to.

## 1. The graph

Athar represents a project as a directed graph of **nodes** and **edges**,
organized into **layers**.

```
Node = a thing in the project        (a file, a function, a table, a doc, ...)
Edge = a relationship between things  (calls, imports, defines, explains, ...)
```

### 1.1 Layers

Every node and edge belongs to a layer. Layers let a query ask for exactly the
kind of knowledge it needs.

```ts
type Layer =
  | "code"      // files, symbols, routes
  | "data"      // tables, migrations
  | "config"    // packages, env
  | "docs"      // markdown, sections      (Phase 2)
  | "visual"    // images, diagrams        (Phase 7)
  | "decision"  // ADRs, choices
  | "test"      // tests
  | "runtime";  // logs, traces            (future)
```

### 1.2 Node model

```ts
type AtharNode = {
  id: string;            // stable, content-addressable (see §3)
  type: NodeType;
  layer: Layer;
  label: string;         // human-readable name
  sourcePath: string;    // posix-relative to scan root
  lineStart?: number;
  lineEnd?: number;
  metadata?: Record<string, unknown>;
};

type NodeType =
  | "file" | "symbol" | "function" | "class" | "route"
  | "table" | "migration"
  | "doc" | "section" | "decision"
  | "image" | "diagram"
  | "package" | "test" | "env";
```

### 1.3 Edge model

Every edge **must** carry evidence. An edge without a source is not allowed.

```ts
type AtharEdge = {
  id: string;
  from: string;          // node id
  to: string;            // node id
  type: EdgeType;
  confidence: "extracted" | "linked" | "semantic" | "manual";
  evidence?: {
    sourcePath: string;
    lineStart?: number;
    lineEnd?: number;
    snippet?: string;
  };
};

type EdgeType =
  | "imports" | "exports" | "calls" | "defines"
  | "reads_table" | "writes_table"
  | "tests" | "documents" | "explains" | "mentions"
  | "depicts" | "belongs_to" | "references"
  | "changed_by" | "depends_on";
```

**Confidence levels:**

- `extracted` — parsed directly from source (e.g. an AST import). Highest trust.
- `linked` — resolved by deterministic rules (e.g. a relative import resolved to
  a file, a symbol name matched to its definition).
- `semantic` — inferred by similarity/AI (Phase 3+). Always opt-in.
- `manual` — asserted by a human in config.

## 2. Pipeline

```
files ──▶ classify ──▶ scan (per layer) ──▶ build graph ──▶ store ──▶ report
                                   │
                                   └─ each scanner emits nodes + evidence-backed edges
```

### 2.1 Walker + ignore rules
`scanRepo` walks the directory tree from a root, applying ignore rules:
- Default-ignored: `node_modules`, `dist`, `build`, `.git`, `.athar`, common
  binary/asset folders.
- **SQL is never ignored by default.**
- Optional `.atharignore` (newline-separated glob-ish patterns) extends the
  defaults.

### 2.2 Classify
`classifyFile` maps a path to a scanner by extension and convention:
- `.ts/.tsx/.js/.jsx` → code scanner
- `.sql` → SQL scanner
- `package.json` → config scanner
- (`.md/.mdx` → docs scanner — Phase 2)
- (images → visual scanner — Phase 7)

### 2.3 Scanners (`packages/scanners`)
Pure functions: given a file path + contents, return `{ nodes, edges }`. They do
not touch disk beyond what they are handed, which keeps them testable.

- **Code** (TypeScript Compiler API):
  - `extractImports` — import declarations → `imports` edges (relative imports
    resolved to files; bare imports matched to workspace packages).
  - `extractSymbols` — functions, classes, exported declarations → nodes +
    `defines` edges from the file.
  - `extractCalls` — call expressions → `calls` edges, resolved to local or
    imported symbols.
  - `extractRoutes` — Next.js App Router `route.ts` handlers → `route` nodes +
    `references` edges to handler functions.
- **SQL** (lightweight, regex-guided):
  - `extractTables` — `CREATE TABLE` → `table` nodes + `defines` edges from the
    migration.
  - `extractForeignKeys` — `REFERENCES` / `FOREIGN KEY` → `references` edges
    between tables.
- **Config**:
  - `parsePackageJson` — `package` node + internal `depends_on` edges + file
    `belongs_to` package.

### 2.4 Graph builder + store (`packages/core`)
`graphBuilder` merges scanner output into a single graph, de-duplicating nodes
by ID and edges by `(from,to,type)` while keeping the strongest evidence.
`graphStore` serializes to `.athar/graph.json`:

```jsonc
{
  "atharVersion": "0.1.0",
  "generatedAt": "<ISO>",
  "root": "<scanned path>",
  "stats": { "nodes": N, "edges": M, "byLayer": {...}, "byType": {...} },
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

### 2.5 Report
`generateReport` writes `.athar/report.md`: totals, per-layer/type counts, most
connected nodes, routes, tables + foreign keys, and packages.

### 2.6 Impact
`affected(graph, target)` does reverse reachability over `calls`/`imports`/
`references`/`defines` edges to answer "what depends on this?" — the seed of the
Studio Impact view and the MCP `affected` tool.

## 3. Stable IDs

IDs are `"<type>:<identifier>"` and never depend on line numbers (which churn on
every edit). All paths are normalized to **posix-relative** form first.

| Node     | ID pattern                                  |
| -------- | ------------------------------------------- |
| file     | `file:<relpath>`                            |
| function | `function:<relpath>#<name>`                 |
| class    | `class:<relpath>#<name>`                    |
| route    | `route:<url-path>#<METHOD>`                 |
| table    | `table:<name>`                              |
| migration| `migration:<relpath>`                       |
| package  | `package:<name>`                            |

Two scans of unchanged source produce identical IDs, so `graph.json` diffs
cleanly.

## 4. Context packs (Phase 3 — design)

The retrieval interface the product exists for:

```jsonc
{
  "task": "fix OAuth callback",
  "budget": 8000,
  "confidence": "high",
  "mustRead":    [ { "path": "...", "reason": "..." } ],
  "relatedDocs": [ { "path": "...", "section": "...", "reason": "..." } ],
  "tables":      [ "stores", "store_tokens" ],
  "tests":       [ "..." ],
  "risks":       [ "token encryption", "tenant isolation" ],
  "excluded":    [ "brand assets", "unrelated marketing docs" ]
}
```

Construction: seed from the task (symbol/route/table/keyword match), expand along
high-value edges, rank by relevance and centrality, then trim to the token
budget while preserving must-reads.

## 5. Interfaces

### CLI (`packages/cli`)
- Phase 1: `init`, `scan [path]`, `update [path]`, `affected <symbol>`.
- Later: `query`, `context`, `studio`, `mcp`, `hook`.

### MCP (`packages/mcp` — Phase 5)
Read-only tools over an existing `graph.json`: `get_context_pack`,
`query_graph`, `affected`, `find_docs`, `find_visuals`, `shortest_path`,
`explain_flow`, `get_node`, `get_neighbors`.

### Studio (`apps/studio` — Phase 4)
Views: Impact, Context Pack, Flow, Knowledge, Visual — with layer filters and a
"copy context for Claude" action.

## 6. Safety model

1. No external LLM by default; AI enrichment is opt-in and local-first.
2. No hooks by default; hooks are opt-in and suggest-only; never edit `CLAUDE.md`.
3. No telemetry; no network calls by default.
4. Every edge carries evidence and a confidence level.
5. Layers are never mixed blindly — queries are mode-scoped.
6. Docs never enter code-impact unless explicitly requested.
7. SQL is never ignored by default.
8. MCP reads the graph; it never scans or mutates source.
