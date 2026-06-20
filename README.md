# Athar — أثر

**The Agent Context Graph for software projects.**

> Give agents the map, not the repo.
> اعطِ الإيجنت الخريطة، مو المشروع كامل.

Athar connects your code, docs, visuals, decisions, and configuration into a
single layered graph, then turns that graph into small, token-efficient
**context packs** for AI coding agents like Claude Code, Codex, and Cursor.

The name **أثر** ("athar") means *trace, footprint, impact, relationship* — which
is exactly what the graph captures: how every part of a project connects to,
documents, and affects every other part.

---

## Why does an AI agent need a map?

When you give a coding agent a task, it usually starts by *reading*. A lot.
It opens dozens of files, scans docs, re-derives how routes connect to the
database, and rebuilds the same mental model on every single request. That is
slow, expensive in tokens, and often inaccurate — the agent can miss the one
file that actually matters and drown in five that do not.

Athar flips this around. It scans the repository **once**, builds a graph of how
things relate, and then answers questions like:

- *What connects the storefront events route to the ranking logic?*
- *If I change `getMerchantContext()`, what breaks?*
- *Which files and docs do I actually need to fix the OAuth callback?*

Instead of reading 100 files, the agent reads the **5 that matter** — plus the
2 relevant docs, the related DB tables, and the tests it should run.

```
Task: Fix Zid OAuth callback

Athar returns:
- apps/web/app/api/zid/oauth/callback/route.ts   (entry route)
- packages/zid/src/oauth.ts                       (token exchange)
- packages/db/.../storeTokens.ts                  (writes store_tokens)
- docs/zid-oauth-core.md#callback-flow            (expected behaviour)
- tests: oauth.test.ts
- risks: token encryption, tenant isolation
```

That bundle is a **context pack**. It is the real product. The graph is the
substrate; the context pack is what the agent consumes.

---

## Layers, not a soup

A project is not just code. It is code **and** docs **and** screenshots **and**
SQL **and** the decisions behind all of them. Athar models each of these as a
separate **layer**, so a query can ask for exactly what it needs and nothing it
does not.

| Layer      | Examples                                             |
| ---------- | ---------------------------------------------------- |
| `code`     | files, functions, classes, imports, calls, routes    |
| `data`     | SQL tables, migrations, foreign keys                 |
| `config`   | packages, dependencies, env keys                     |
| `docs`     | markdown sections, links, mentions                   |
| `visual`   | screenshots, diagrams, image metadata *(planned)*    |
| `decision` | architecture decisions and what they introduced      |
| `test`     | tests and what they cover                            |
| `runtime`  | logs, traces *(future)*                              |

Everything is supported. Nothing is mixed blindly. A code-impact query never
drags in marketing screenshots; a docs query never returns raw call graphs
unless you ask for them.

```bash
athar query "what calls getMerchantContext" --mode code   # code only
athar query "where is OAuth documented?"     --mode docs   # docs only
athar context "fix OAuth callback" --budget 8000           # smart mix, budgeted
```

---

## Principles

Athar is built to be a trustworthy substrate for agents. That means:

- **No LLM by default.** Code, docs, and SQL are parsed structurally. AI
  enrichment is opt-in and runs locally first.
- **No hooks by default.** Athar never inserts itself into your workflow
  uninvited. Hooks ship later and are strictly opt-in and suggest-only.
- **No telemetry. No network calls by default.** Athar reads your repo and
  writes JSON. That's it.
- **Every edge has evidence.** Each relationship records *where* it came from —
  file, line range, snippet — and a confidence level (`extracted`, `linked`,
  `semantic`, `manual`). Nothing is asserted without a source.
- **Stable IDs.** Nodes are addressed by what they are, not where they sit on a
  line, so the graph stays diffable across scans.

---

## How is this different from a generic graph viewer?

Tools that visualize "file A imports file B" are useful but stop at the
mechanical layer. Athar adds **meaning**: a doc *explains* a route, a screenshot
*depicts* a page, a decision *introduced* a feature, a migration *defines* a
table. And the goal is not a pretty picture — it is **retrieval**: producing the
minimal, correct context an agent needs for a specific task, under a token
budget. The visualization (Athar Studio) exists to *explain* that retrieval, not
to replace it.

We are not trying to out-draw multimodal graph explorers. We are trying to make
agents cheaper and smarter on real codebases.

---

## Status

Athar is in active development. The graph, the context packs, and the MCP server
are implemented and tested end-to-end:

- ✅ **Code graph** — TypeScript/JavaScript files, imports, functions/classes, calls
- ✅ **Route detection** — Next.js App Router handlers
- ✅ **Data graph** — SQL tables and foreign keys (never ignored)
- ✅ **Config graph** — workspace packages and internal dependencies
- ✅ **Docs layer** — markdown headings/sections linked to code, SQL, and routes
  with evidence (`documents`, `explains`, `mentions`), no LLM
- ✅ **Context packs** — `athar context "<task>" --budget N`: must-read code,
  related docs, tables, tests, risks, and an explicit excluded list, all under a
  token budget, deterministic, no LLM
- ✅ **Mode-scoped query** — `athar query "<q>" --mode code|docs|all`
- ✅ **Impact analysis** — `athar affected <symbol>` (reverse reachability)
- ✅ **MCP server** — read-only stdio JSON-RPC, zero dependencies; tools
  `athar_context`, `athar_query`, `athar_affected`
- ✅ **Athar Studio** — a local, **read-only** graph explorer (`athar studio`):
  interactive graph, context-pack builder, impact + flow tracing, and docs/data
  views. Reuses the same engines and only reads `.athar/graph.json` — it never
  scans or writes (see [apps/studio/README.md](apps/studio/README.md))
- ✅ **Claude Code integration** — slash commands, a skill, and a subagent that
  call the real Athar interfaces (see below)
- ✅ Output: `.athar/graph.json` + a human-readable `.athar/report.md`
- ✅ Tested with Node's built-in test runner (`pnpm test`) — stable IDs,
  deterministic output, token-budget enforcement, docs-to-code linking, and the
  MCP transport, all covered

Genuinely not built yet: opt-in hooks, the visual layer, semantic/AI
enrichment, and a runtime layer. See [PROJECT_PLAN.md](PROJECT_PLAN.md) and
[ARCHITECTURE.md](ARCHITECTURE.md).

---

## Quick start

```bash
# install workspace deps and build
pnpm install
pnpm build

# scan a project (creates .athar/graph.json and .athar/report.md)
pnpm athar scan ./path/to/your/project

# or try the bundled example
pnpm scan:example

# build a token-budgeted context pack for a task
pnpm athar context "fix the OAuth callback that writes store tokens" --budget 8000

# ask a mode-scoped question (code only / docs only / everything)
pnpm athar query "store tokens" --mode code
pnpm athar query "where is OAuth documented?" --mode docs

# see what depends on a symbol before you change it
pnpm athar affected getMerchantContext

# run the test suite (Node's built-in runner, no extra deps)
pnpm test

# explore the graph in the local, read-only Studio
# (build the UI once — dist/ is gitignored — then serve it)
pnpm studio:build
pnpm studio examples/nextjs-supabase --port 4199
```

The scan never touches the network, never calls an LLM, and never writes
anything outside `.athar/`. `node_modules`, `dist`, and friends are ignored;
SQL never is.

---

## Using Athar from Claude Code

This repo ships a ready-to-use integration so an agent loads the map instead of
crawling the tree.

**MCP server** (`.mcp.json`) — a read-only stdio server over the existing
`.athar/graph.json`. It exposes three tools:

| Tool | What it does |
| ---- | ------------ |
| `athar_context` | Token-budgeted context pack for a task. |
| `athar_query` | Ranked, mode-scoped search over the graph. |
| `athar_affected` | Reverse impact: what depends on a symbol. |

The server **only reads** the graph — it never scans or rebuilds it. Build the
graph first with `athar scan`. See [packages/mcp/README.md](packages/mcp/README.md).

**Slash commands, skill, and subagent** (under `.claude/`, shared in this repo):

- `/athar-scan`, `/athar-context`, `/athar-query` — thin wrappers over the CLI
- the `athar-context` skill — guidance for pulling a pack before editing
- the `athar-explorer` subagent — explores a repo through Athar, not raw reads

Personal Claude settings (`launch.json`, `settings.local.json`) stay local and
are gitignored.

---

## Repository layout

```
athar/
  packages/
    shared/        # types, logger, path + id helpers, errors
    scanners/      # code (TS), SQL, package.json, markdown extractors
    core/          # repo walker, graph builder/store, report, impact, context packs, flow
    cli/           # the `athar` command
    mcp/           # read-only MCP server over .athar/graph.json
    studio-server/ # local, read-only HTTP API over .athar/graph.json
  apps/
    studio/        # Athar Studio — Vite + React graph explorer (read-only)
  examples/
    nextjs-supabase/   # sample project to scan
  tests/        # node:test suite (graph, context, docs links, MCP)
  .claude/      # shared slash commands, skill, subagent
  .mcp.json     # registers the Athar MCP server
  docs/
```

## License

MIT — see [LICENSE](LICENSE).
