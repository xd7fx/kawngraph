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
  | "docs"      // markdown, sections
  | "visual"    // images, diagrams        (planned)
  | "decision"  // ADRs, choices
  | "test"      // tests
  | "runtime";  // logs, traces            (planned)
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
- `.md/.mdx` → docs scanner
- (images → visual scanner — planned)

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
- **Docs** (dependency-free markdown reader):
  - `parseMarkdown` — frontmatter, headings/sections, links, inline code, fenced
    blocks, with 1-based line numbers for evidence. It does not render markdown.
  - `scanDocs` — `doc` + `section` nodes.
  - `linkDocsToCode` — links docs to code/data without an LLM: markdown links and
    mentions of file paths, route URLs, symbol names, and table names become
    `documents` / `explains` / `mentions` edges. It never invents target nodes —
    a link is only emitted when the referenced node already exists in the graph,
    and every edge keeps its evidence (`linked` confidence).

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

## 4. Context packs (implemented)

The retrieval interface the product exists for. `buildContextPack(graph, task,
{ mode, budget })` returns evidence-backed buckets, kept in separate layers:

```jsonc
{
  "task": "fix OAuth callback",
  "mode": "all",                       // code | docs | all
  "budget": 8000,
  "tokensUsed": 386,                   // never exceeds budget
  "confidence": 0.74,                  // 0..1, reflects keyword coverage + grounding
  "mustRead":    [ { "type": "function", "label": "...", "sourcePath": "...", "lineStart": 3, "tokensEstimate": 40, "reason": "..." } ],
  "relatedDocs": [ { "type": "section", "label": "...", "sourcePath": "...#...", "reason": "..." } ],
  "tables":      [ { "type": "table", "label": "store_tokens", "reason": "..." } ],
  "tests":       [ { "type": "test", "label": "...", "reason": "..." } ],
  "risks":       [ { "level": "high", "kind": "auth", "message": "..." } ],
  "excluded":    [ { "label": "...", "reason": "over budget (~120 tok)" } ]
}
```

**Construction (deterministic, no LLM):**
1. Extract keywords from the task (stopwords dropped, lowercased).
2. Seed nodes by keyword match, filtered to the requested `mode`.
3. Expand along high-value edges with a bounded BFS; the walk *crosses layers*
   internally (so a doc can bridge code → table), but the final buckets are
   re-filtered by mode so a code query never leaks docs.
4. Rank by keyword relevance + BFS proximity + degree centrality.
5. Fill buckets under the token budget (`estimateTokens` ≈ chars / 4). Code and
   docs are optional and gated by budget; anything that does not fit is surfaced
   in `excluded` with a reason — never silently dropped. **Tables and tests are a
   mandatory floor and are never dropped for budget** (SQL is load-bearing).

`athar query "<q>" --mode <layer>` exposes the same ranking without the bucketing
or the budget, for quick "where does this live?" lookups.

## 5. Interfaces

### CLI (`packages/cli`)
- Implemented: `init`, `scan [path]`, `update [path]`, `affected <symbol>`,
  `query "<q>" --mode <code|docs|all> [--limit N]`,
  `context "<task>" --budget N [--mode]`,
  `studio [path] [--port N] [--no-open]`, `version`, `help`.
- Agent integration: `setup [path] [--agent auto|all|claude|codex|cursor]
  [--scope project|user] [--yes] [--force] [--dry-run] [--json]`,
  `connect <agent> [path]`, `disconnect <agent> [path]`,
  `doctor [path] [--json] [--skip-probe]`, `status [path] [--json]`,
  `agents [path] [--json]`.
- Common flags: `--root <dir>` (default `.`), plus per-command value flags
  (`--ignore`, `--depth`, `--mode`, `--budget`, `--out`, `--limit`, `--port`,
  `--agent`, `--scope`).
- Later: `hook`.

### MCP (`packages/mcp` — implemented)
A zero-dependency stdio JSON-RPC 2.0 server (no MCP SDK). **Read-only** over an
existing `.athar/graph.json` — it never scans or mutates. Three tools:
- `athar_context` — token-budgeted context pack for a task.
- `athar_query` — ranked, mode-scoped search over the graph.
- `athar_affected` — reverse impact for a symbol or file.

stdout carries protocol messages only; logs go to stderr. The root is chosen by
`--root`, `--root=`, `ATHAR_ROOT`, then cwd, and can be overridden per call.

**Agent-facing metadata.** `initialize` advertises a <2 KB server-instruction
block (call `athar_context` first; read-only; stale ⇒ ask the user to run
`athar update`), and each tool description states its purpose and that it is
read-only. This is how the in-session behavior changes without editing any prose
instruction file.

**Freshness-aware, never rebuilds.** Before serving, the server consults
`graphFreshness(root)` (from `@athar/core`) and prepends a banner by severity:
`stale`/`incompatible` get a prominent ⚠ + `athar update`; `possibly-stale` gets
a soft note; `fresh` is silent. The pack is still served on staleness (read-only
never blocks); only a missing/malformed graph is an error (with `athar scan`
guidance, no banner). A short TTL cache avoids re-shelling git on bursts. The
server never writes a manifest or mutates the graph just by being queried.

Future tools (`find_docs`, `shortest_path`, `explain_flow`, `get_node`,
`get_neighbors`) remain on the roadmap.

### Agent integration (`packages/agents` — implemented)
The layer that connects a project to coding agents over MCP. It is the **only**
part of Athar that edits agent config files, and every write is reversible.

- **Adapters** (`adapters/`) — one per agent, behind a uniform `AgentAdapter`
  interface (`detect`, `plan`, `install`, `verify`, `uninstall`). Each owns
  exactly one key/table in one file and records the verified config format +
  source URL + date:

  | Agent | File | Owns | Shape | Verified |
  | ----- | ---- | ---- | ----- | -------- |
  | Claude Code | `.mcp.json` | `mcpServers.athar` | `{type:"stdio",command,args,env}` | 2026-06-19 · code.claude.com/docs/en/mcp.md |
  | Cursor | `.cursor/mcp.json` | `mcpServers.athar` | `{command,args,env}` (no type) | 2026-06-19 · cursor.com/docs/context/mcp |
  | Codex | `.codex/config.toml` | `[mcp_servers.athar]` | TOML table | 2026-06-19 · developers.openai.com/codex/mcp |

  The Claude/Cursor JSON shape is shared via `mcpJsonFile.ts`; Codex uses a
  table-aware TOML editor (`config/safeToml.ts`) that preserves comments and
  unrelated tables. No per-agent branching leaks into the CLI.
- **Safe config IO** (`config/`) — `atomicWriteFile` (temp + fsync + atomic
  rename), `backupFile` → `.athar/backups/<timestamp>__<path>`, JSON and TOML
  parse/edit/serialize helpers. Malformed existing config is a **blocker**, never
  overwritten. A foreign `athar` entry blocks until `--force`.
- **Launch resolution** (`launch.ts`) — resolves how to start the MCP server and
  records provenance (`npx` / `global-bin` / `local-node`) and `portable`, so
  setup/doctor can warn honestly that a local install is machine-specific until
  `@athar/mcp` is published.
- **Manifest** (`integrations.ts`) — `.athar/integrations.json` records each
  connected agent: files touched, owned keys/tables, backups, and the exact
  launch command. `disconnect` uses it to remove only Athar's entry — and still
  works without it by recognizing Athar-owned entries by name.
- **Doctor** (`doctor/`) — a read-only PASS/WARN/FAIL audit: Node ≥18, graph
  presence + freshness, MCP resolvable, a live handshake + retrieval smoke test,
  detected agents + connection state, and manifest-target resolution. Exit code
  is `0` unless a check FAILs (WARN never fails the command). `--json` is stable
  for CI.

`setup`/`connect` orchestrate: ensure a graph (offer to scan when missing) →
plan (no writes) → confirm (skipped with `--yes`; never hangs on a non-TTY) →
install + verify with a live MCP handshake. Project scope is the default; the
`user` (global) scope is intentionally refused this release. See
[docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md).

### Studio (`apps/studio` + `packages/studio-server` — implemented)
A local, **read-only** desktop-style explorer for an existing
`.athar/graph.json`. Two parts cooperate:

- **`@athar/studio-server`** — a zero-dependency Node `http` server. It binds to
  `127.0.0.1` only, loads the graph **once**, serves the built frontend from
  disk, and exposes a read-only JSON API. It reuses `@athar/core` for every
  computation (query, context, impact, flow) — no graph logic is duplicated.
  `GET`s read; `POST`s are **computational only** — they run the engines over the
  in-memory graph and never mutate it or touch disk. Inputs are validated and
  outputs are bounded (query limit, context budget, affected depth, flow nodes).

  | Method + path | Engine | Purpose |
  | ------------- | ------ | ------- |
  | `GET /api/health` | — | Status, resolved root, graph presence. |
  | `GET /api/graph` | — | Normalized nodes + edges + stats. |
  | `GET /api/summary` | — | Counts by layer / type + most-connected nodes. |
  | `POST /api/query` | `queryGraph` | Ranked, mode-scoped search. |
  | `POST /api/context` | `buildContextPack` | Token-budgeted context pack. |
  | `POST /api/affected` | `affected` | Reverse impact for a node. |
  | `POST /api/flow` | `flowBetween` | Bounded shortest path between two nodes. |

- **`apps/studio`** — a Vite + React (`@xyflow/react`) single-page app served by
  the studio server. Tabs: Graph, Context, Impact, Flow, Docs, Data, Settings.
  Interactive graph (pan / zoom / fit / minimap, node **and** edge selection,
  search / focus, layer / type / edge filters, hide-isolated, neighborhood focus,
  render cap + progressive expansion, color-by-layer, icon-by-type), the
  context-pack builder ("copy context for Claude" as Markdown / JSON), reverse
  impact, and bounded flow tracing with per-step evidence. Light (default) + dark
  themes; only harmless view prefs are persisted to `localStorage`, with a clear
  action.

The Studio **explains retrieval; it is not the product.** It never scans,
rebuilds, or writes — building the graph stays the CLI's job (`athar scan`). The
visual and runtime layers remain future work and are not surfaced as implemented.

## 6. Safety model

1. No external LLM by default; AI enrichment is opt-in and local-first.
2. No hooks by default; hooks are opt-in and suggest-only; never edit `CLAUDE.md`.
3. No telemetry; no network calls by default.
4. Every edge carries evidence and a confidence level.
5. Layers are never mixed blindly — queries are mode-scoped.
6. Docs never enter code-impact unless explicitly requested.
7. SQL is never ignored by default.
8. MCP reads the graph; it never scans, updates, or mutates source. It may warn
   that the graph is stale, but the fix is always an explicit CLI step.
9. Studio reads the graph over a `127.0.0.1`-only API; it never scans, mutates,
   or writes, and makes no external network calls.
10. Agent integrations are project-scoped by default and reversible: atomic
    writes, backups before every edit, structured (never string-replacement)
    config editing, ownership tracked in a manifest, and clean removal.
11. Athar never edits `CLAUDE.md`/`AGENTS.md`, never installs hooks, and never
    touches global/user config by default — the `user` scope is opt-in only.
