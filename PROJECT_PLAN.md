# Athar — Project Plan

## Vision

Athar is the **Agent Context Graph** for software projects. It connects code,
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
**Goal:** prove Athar understands a real codebase structurally.
- Scan `.ts/.tsx/.js/.jsx/.json/.sql`.
- Extract imports, exports, functions, classes, calls.
- Detect Next.js App Router routes.
- Parse `package.json` (workspace packages + internal deps).
- Parse SQL migrations (tables + foreign keys).
- Stable node IDs, evidence-backed edges.
- Emit `.athar/graph.json` and `.athar/report.md`.
- Commands: `init`, `scan`, `update`, `affected`.

### Phase 2 — Docs layer
**Goal:** connect docs to code **without an LLM**.
- Parse markdown: headings, sections, links, frontmatter, code blocks.
- Link docs to code via mentions of file paths, route paths, symbol names,
  and table names.
- Edges: `documents`, `explains`, `mentions`, `references`.

### Phase 3 — Context packs
**Goal:** the real product.
- `athar context "<task>" --budget <tokens>`.
- Rank nodes by relevance to the task; expand along high-value edges.
- Return: must-read files, related docs, tables, tests, risks, and an
  explicit "excluded" list, all within a token budget.

### Phase 4 — Studio UI
**Goal:** a practical decision assistant, not just a canvas.
- Views: Impact, Context Pack, Flow, Knowledge, Visual.
- Layer filters; "copy context for Claude" action.

### Phase 5 — MCP server
**Goal:** let agents query Athar directly.
- Tools: `get_context_pack`, `query_graph`, `affected`, `find_docs`,
  `find_visuals`, `shortest_path`, `explain_flow`, `get_node`, `get_neighbors`.
- MCP **reads** the graph; it never builds the graph itself.

### Phase 6 — Safe hooks
**Goal:** optional acceleration, never imposition.
- `athar hook install --suggest-only`.
- Suggests "ask Athar for a context pack before reading many files."
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
| `athar init`                         | 1     |
| `athar scan [path]`                  | 1     |
| `athar update [path]`                | 1     |
| `athar affected <symbol>`            | 1     |
| `athar query "<q>" --mode <layer>`   | 2/3   |
| `athar context "<task>" --budget N`  | 3     |
| `athar studio`                       | 4     |
| `athar mcp` / `athar mcp install`    | 5     |
| `athar hook install --suggest-only`  | 6     |
| `athar scan --with-visuals`          | 7     |

## Invariants that prevent rot

1. Never mix layers blindly — every query has an explicit mode.
2. Every edge carries evidence (source path + line range + snippet).
3. Every node has a stable, content-addressable ID.
4. No LLM, no hooks, no telemetry, no network by default.
5. Docs never enter code-impact unless explicitly requested.
6. SQL is **never** ignored by default.
7. MCP reads the graph only; it does not scan.
8. Studio explains retrieval; it is not the product.

## Current status

Phase 0 and Phase 1 are implemented in this repository. The next milestone is
Phase 2 (docs layer), which unlocks Phase 3 (context packs) — the feature the
whole product is built to deliver.
