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
| `docs`     | markdown sections, links, mentions *(Phase 2)*       |
| `visual`   | screenshots, diagrams, image metadata *(Phase 7)*    |
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

Athar is in early development. This repository currently implements **Phase 1**:

- ✅ Code graph: TypeScript/JavaScript files, imports, functions/classes, calls
- ✅ Route detection: Next.js App Router handlers
- ✅ Data graph: SQL tables and foreign keys
- ✅ Config graph: workspace packages and internal dependencies
- ✅ `athar init`, `athar scan`, `athar update`, `athar affected`
- ✅ Output: `.athar/graph.json` + a human-readable `.athar/report.md`

Planned next: docs layer (Phase 2), context packs (Phase 3), Studio UI
(Phase 4), MCP server (Phase 5), opt-in hooks (Phase 6), visual layer (Phase 7).
See [PROJECT_PLAN.md](PROJECT_PLAN.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

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

# see what depends on a symbol
pnpm athar affected getMerchantContext
```

---

## Repository layout

```
athar/
  packages/
    shared/     # types, logger, path + id helpers, errors
    scanners/   # code (TS), SQL, package.json extractors
    core/       # repo walker, graph builder/store, report, impact
    cli/        # the `athar` command
    mcp/        # MCP server (planned, Phase 5)
  apps/
    studio/     # Athar Studio UI (planned, Phase 4)
  examples/
    nextjs-supabase/   # sample project to scan
  docs/
```

## License

MIT — see [LICENSE](LICENSE).
