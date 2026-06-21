# KawnGraph — Project Plan

## Vision

KawnGraph is the **Agent Context Graph** for software projects. It connects code,
docs, visuals, decisions, and configuration into a layered graph, then serves AI
coding agents **context packs**: the minimal, correct, token-budgeted set of
files, symbols, docs, tables, tests, and risks for a specific task.

The core promise: **give agents the map, not the repo.**

Success is not "a nice graph." Success is:

1. **Fewer tokens** — the agent reads the 5 files that matter, not 100.
2. **Faster, more accurate understanding** — relationships are pre-computed.
3. **Impact awareness** — "if I touch X, what breaks?" before editing.
4. **Right context, right layer** — code questions get code; doc questions get
   docs; nothing mixed blindly.

## Non-goals (for now)

- Not a Graphify clone or a "pretty graph" first. Retrieval first, visuals second.
- No LLM dependency to function. AI is opt-in enrichment, local-first.
- No forced workflow integration. Hooks are opt-in and suggest-only.
- No telemetry, no background network calls.

## Phases

Each phase is shippable on its own and must not break the guarantees of the
phase before it.

### Phase 0 — Foundation ✅ (this commit set)
- Clean monorepo, identity, and documentation.
- `README.md`, `PROJECT_PLAN.md`, `ARCHITECTURE.md`.
- pnpm workspace, shared TS config, license, ignore rules.

### Phase 1 — Code + SQL graph ✅
**Goal:** prove KawnGraph understands a real codebase structurally.
- Scan `.ts/.tsx/.js/.jsx/.json/.sql`.
- Extract imports, exports, functions, classes, calls.
- Detect Next.js App Router routes.
- Parse `package.json` (workspace packages + internal deps).
- Parse SQL migrations (tables + foreign keys).
- Stable node IDs, evidence-backed edges.
- Emit `.kawn/graph.json` and `.kawn/report.md`.
- Commands: `init`, `scan`, `update`, `affected`.

### Phase 2 — Docs layer ✅
**Goal:** connect docs to code **without an LLM**.
- Parse markdown: headings, sections, links, frontmatter, code blocks.
- Link docs to code via mentions of file paths, route paths, symbol names,
  and table names.
- Edges: `documents`, `explains`, `mentions`, `references`.

### Phase 3 — Context packs ✅
**Goal:** the real product.
- `kawn context "<task>" --budget <tokens>`.
- `kawn query "<q>" --mode code|docs|all` for mode-scoped retrieval.
- Rank nodes by relevance to the task (keyword seeds + BFS proximity + degree
  centrality); expand along high-value edges. No LLM.
- Return: must-read files, related docs, tables, tests, risks, a confidence
  score, and an explicit "excluded" list, all within a token budget.
- SQL tables and tests are a mandatory floor — never dropped for budget.

### Phase 4 — Studio UI ✅
**Goal:** a practical decision assistant, not just a canvas.
- Local, **read-only** server (`kawn studio [path]`) bound to `127.0.0.1`; reads
  the existing `.kawn/graph.json` and never scans, rebuilds, or writes.
- `@kawngraph/studio-server`: zero-dependency Node `http` API (`GET /api/health|graph|
  summary`, `POST /api/query|context|affected|flow`) reusing `@kawngraph/core` — no
  duplicated graph logic. `POST`s are computational only; inputs are validated and
  outputs are bounded.
- `apps/studio`: a Vite + React explorer. Tabs: Graph, Universe, Context, Impact,
  Flow, Docs, Data, Settings — no empty tabs. The Universe tab is a scalable 3D
  star-map (budgeted draw calls; never renders a whole large graph at once).
- Interactive graph (pan / zoom / fit / minimap, node **and** edge selection,
  search / focus, layer / type / edge filters, hide-isolated, neighborhood focus,
  render cap + progressive expansion, color-by-layer, icon-by-type), the
  context-pack builder with copy-as-Markdown / JSON, reverse-impact, and bounded
  flow tracing with per-step evidence.
- Layer filters; "copy context for Claude" action. Light (default) + dark themes;
  only harmless view prefs persisted to `localStorage`, with a clear action.

### Phase 5 — MCP server + one-command agent integration ✅
**Goal:** let agents use KawnGraph automatically, with one command and zero prose-file edits.

**MCP server** (shipped ahead of Phase 4):
- Zero-dependency stdio JSON-RPC 2.0 server (no MCP SDK).
- Tools shipped: `kawn_context` (token-budgeted pack), `kawn_query`
  (mode-scoped ranked search), `kawn_affected` (reverse impact).
- MCP **reads** the graph; it never builds or mutates it. Building stays the
  CLI's job (`kawn scan`). When the graph is merely **stale** it warns (and
  points to `kawn update`) but still serves — read-only never blocks on
  staleness. When the graph is **incompatible** (schema ≠ this build) or
  malformed it **refuses to serve**, returning a structured error + `kawn
  update` so the agent never acts on a graph it cannot trust.
- The server advertises sharpened, read-only tool descriptions and a <2 KB
  server-instruction block so the agent calls `kawn_context` first — the
  in-session behavior change rides on MCP metadata, not on `CLAUDE.md`/`AGENTS.md`.

**One-command agent setup** (`@kawngraph/agents`):
- `kawn setup [path]` — scan if needed, detect Claude Code / Codex / Cursor,
  install reversible **project-scoped** MCP integrations, and verify retrieval
  with a live handshake. Plus `connect`, `disconnect`, `status`, `doctor`,
  `agents`. Interactive and non-interactive (`--yes`, `--json`, `--dry-run`).
- Modular adapters own exactly one key/table in one file (`.mcp.json`,
  `.cursor/mcp.json`, `[mcp_servers.kawn]` in `.codex/config.toml`), each format
  verified against official docs with the source + date recorded in code.
- Atomic writes, timestamped backups, a structured JSON/TOML editor (never string
  replacement), an `.kawn/integrations.json` manifest, and reversible removal.
- Never edits `CLAUDE.md`/`AGENTS.md`, never installs hooks, never touches global
  config (the `user` scope is intentionally refused this release).

**Also shipped:** Claude Code repo integration — `/kawn-scan`, `/kawn-context`,
`/kawn-query` slash commands, an `kawn-context` skill, and an `kawn-explorer`
subagent, all calling the real interfaces above.

Future MCP tools (`find_docs`, `shortest_path`, `explain_flow`, `get_node`,
`get_neighbors`) remain on the roadmap.

### Phase 6 — Safe hooks
**Goal:** optional acceleration, never imposition.
- `kawn hook install --suggest-only`.
- Suggests "ask KawnGraph for a context pack before reading many files."
- Opt-in only. No forced behavior. Never edits `CLAUDE.md`.

### Phase 7 — Visual layer
**Goal:** bring screenshots and diagrams into the graph.
- v0: image metadata (path, dimensions, folder meaning).
- v1: local OCR, screenshot grouping.
- v2: optional AI captions (local Ollama, or cloud with explicit permission).
- Visuals never enter code-impact unless `--include-visuals` is passed.

## Command roadmap

| Command                              | Phase |
| ------------------------------------ | ----- |
| `kawn init`                         | 1     |
| `kawn scan [path]`                  | 1     |
| `kawn update [path]`                | 1     |
| `kawn affected <symbol>`            | 1     |
| `kawn query "<q>" --mode <layer>`   | 2/3   |
| `kawn context "<task>" --budget N`  | 3     |
| `kawn studio`                       | 4     |
| MCP server (`node packages/mcp/dist/index.js`) | 5 |
| `kawn setup [path] [--agent …]`     | 5     |
| `kawn connect <agent>` / `disconnect <agent>` | 5 |
| `kawn doctor` / `status` / `agents` | 5     |
| `kawn hook install --suggest-only`  | 6     |
| `kawn scan --with-visuals`          | 7     |

The MCP server currently runs as a standalone entrypoint (registered via
`.mcp.json`); an `kawn mcp` CLI wrapper is a future convenience, not a
requirement.

## Invariants that prevent rot

1. Never mix layers blindly — every query has an explicit mode.
2. Every edge carries evidence (source path + line range + snippet).
3. Every node has a stable, content-addressable ID.
4. No LLM, no hooks, no telemetry, no network by default.
5. Docs never enter code-impact unless explicitly requested.
6. SQL is **never** ignored by default.
7. MCP reads the graph only; it does not scan, update, or write it.
8. Studio explains retrieval; it is not the product.
9. Agent integrations are project-scoped by default and **reversible** — atomic
   writes, backups, structured (not string) config edits, and clean removal.
10. Never edit `CLAUDE.md`/`AGENTS.md`, install hooks, or touch global config by
    default; the `user` scope is opt-in only and refused this release.

## Current status

Phases 0–5 are implemented and tested: the code/data/config/docs graph, the
docs-to-code links, mode-scoped query, reverse-impact analysis, the
token-budgeted **context packs** that the whole product is built to deliver, the
**MCP server** with read-only freshness warnings and agent-facing instructions,
the **one-command agent integration** (`@kawngraph/agents`: setup / connect /
disconnect / doctor / status / agents for Claude Code, Codex, and Cursor), the
Claude Code repo integration (slash commands, skill, subagent), and **KawnGraph
Studio** (Phase 4) — a local, read-only graph explorer served by
`@kawngraph/studio-server`. An automated `node:test` suite covers stable IDs,
deterministic output, token-budget enforcement, docs-to-code linking, the MCP
transport + freshness banner + server instructions, the agent adapters
(install/idempotency/reversibility, foreign-entry and malformed-config blocks,
the manifest, and doctor), and the Studio server (path safety, host binding,
input validation, output limits, flow bounds, and the no-write guarantee). A
`pnpm pack:check` packaging audit packs every publishable package, installs the
whole closure into a throwaway consumer from tarballs only, and smoke-tests the
installed CLI + MCP server — without publishing.

Still ahead: opt-in suggest-only hooks (Phase 6), the visual layer (Phase 7),
and optional semantic/AI enrichment. None of those are required for the core
promise, and all of them stay opt-in.
