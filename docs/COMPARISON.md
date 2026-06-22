# KawnGraph — Comparison

> A neutral, dated, sourced comparison. The point is honesty, not a sales pitch:
> we show where KawnGraph leads **and** where it is behind.

**Document date:** 2026-06-23. Reflects this repository at commit
`2de5ef48` (the commit recorded in the published benchmark artifact). External
sources were accessed in **June 2026**; their access dates are noted inline.

Two comparisons live here:

1. A **primary, approach-based** table — KawnGraph against *categories* of tooling
   (plain repository search, general RAG, generic graph viewers). No named
   target; every cell defensible; `varies` where it genuinely depends on the
   tool.
2. A **secondary, named-tool** table — KawnGraph against one real, mature,
   publicly documented graph-based code-context tool, each cell sourced (the
   competitor from its public docs with an access date; KawnGraph from files and
   tests in *this* repository).

Verify any KawnGraph claim yourself: every KawnGraph cell points at a file or test
in this repo. Verify any competitor claim against the linked public source.

---

## 1) Approach comparison (no named target)

How KawnGraph compares to the *kinds* of tooling an agent might otherwise use.
`✅` = generally true; `❌` = generally not true; `varies` = depends on the
specific tool in that category.

| Capability | Plain repository search | General RAG (embeddings) | Generic graph viewer | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministic, local, no-network scan | ✅ | varies | ✅ | ✅ |
| Symbol-level relationships (imports, calls, routes) | ❌ | varies | ✅ | ✅ |
| Separate docs / data / config / test layers | ❌ | varies | varies | ✅ |
| Evidence (path + line range + snippet) on every edge | ❌ | ❌ | varies | ✅ |
| Confidence level on every edge | ❌ | ❌ | varies | ✅ |
| Stable, content-addressable node IDs (diffable scans) | ❌ | ❌ | varies | ✅ |
| Bounded reverse-impact ("what depends on X") | ❌ | ❌ | varies | ✅ |
| Git change-set impact (uncommitted / branch vs base) | varies | ❌ | ❌ | ✅ |
| Token-budgeted Context Packs for a task | ❌ | varies | ❌ | ✅ |
| Read-only retrieval surface for agents (MCP) | ❌ | varies | varies | ✅ |
| Works with **no** internal/external LLM required | ✅ | ❌ | ✅ | ✅ |
| No telemetry, no query logging by default | varies | varies | varies | ✅ |
| Broad language/format breadth out of the box | varies | ✅ | varies | **❌ (5 scanners)** |
| Incremental / live file-watch indexing | n/a | varies | varies | **❌ (explicit `kawn update`)** |

The last two rows are deliberate: KawnGraph is **narrow and explicit** today. It
covers five formats (TS/JS, Python, SQL, `package.json`, Markdown) and rebuilds
only on an explicit `kawn scan` / `kawn update`, never during a session. Plain
search and embedding RAG are broader by nature; that breadth is a real advantage
they hold over KawnGraph right now.

Sources for the KawnGraph column: this repository's `README.md`,
`docs/AGENT_INTEGRATION.md`, `ARCHITECTURE.md`, the scanner registry in
`packages/scanners/src/plugins/index.ts`, the read-only MCP loop in
`packages/mcp/src/index.ts`, and the test suite under `tests/`.

---

## 2) Named-tool comparison (sourced)

The most defensible head-to-head is against another **MCP-native code knowledge
graph**. KawnGraph is compared below to **CodeGraphContext** — a real,
open-source (MIT), actively maintained tool that "indexes local code into a graph
database to provide context to AI assistants."

- **Competitor source:** CodeGraphContext public repository and README,
  <https://github.com/CodeGraphContext/CodeGraphContext> — **accessed
  2026-06-23**. Stated version at access: **v0.5.1**, MIT license, active
  development (pre-1.0). Figures and behaviors below are quoted/paraphrased from
  that public README; verify against the source.
- **KawnGraph source:** *this* repository at commit `2de5ef48`, with file/test
  references in each cell.

This is **not** an endorsement, attack, or ranking. Different designs, different
trade-offs. CodeGraphContext is broader; KawnGraph is more conservative and more
multi-layer. Both are honest, useful tools.

| Capability | CodeGraphContext (public docs, accessed 2026-06-23) | KawnGraph (this repo, commit `2de5ef48`) | Notes |
| --- | --- | --- | --- |
| **Install prerequisites** | `pip install codegraphcontext`, Python 3.10+; uses an **embedded graph DB by default** (FalkorDB Lite / KuzuDB), with optional external **Neo4j ≥5.15** via `codegraphcontext neo4j setup`. | Node ≥18 + pnpm; build from source (`pnpm install && pnpm build`). **Not yet published to npm** (`packages/cli` `private:true`) — no `npx kawngraph` today. No database; the graph is a single JSON file `.kawn/graph.json`. | Different runtimes (Python vs Node). KawnGraph stores a flat file; CodeGraphContext stores a graph database (embedded by default). |
| **Scanners / formats** | **23 languages** via **tree-sitter** (e.g. Python, JS/TS, Java, C/C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, …), with optional SCIP indexing for C/C++/C#. | **5 formats**, each a versioned plugin: TypeScript/JS, Python (`@lezer/python`, pure-JS), SQL, `package.json`, Markdown. See `packages/scanners/src/plugins/index.ts`, `tests/scannerPlugins.test.ts`. | **CodeGraphContext is far broader on languages.** KawnGraph deliberately trades breadth for deterministic, error-tolerant, dependency-light scanners. |
| **Agent integrations** | Wide list incl. VS Code, Cursor, Windsurf, Zed, Claude, Gemini CLI, ChatGPT Codex, Cline, RooCode, Amazon Q, Kiro, Goose, OpenCode (via `mcp setup` wizard). | **3 agents**: Claude Code, Codex, Cursor — reversible, project-scoped MCP config only. See `docs/AGENT_INTEGRATION.md`, `packages/agents`, `tests/agents.test.ts`. | **CodeGraphContext integrates with more clients.** KawnGraph's scope is narrower but each adapter is contract-tested and reversible. |
| **Graph layers** | Code-centric: classes, functions, methods, parameters, inheritance, calls, imports. No explicit docs/SQL/test/config layers in the README. | Five live layers: `code`, `data` (SQL tables/FKs), `config` (workspace packages/deps), `docs` (Markdown linked to code/SQL/routes), `test`. See `ARCHITECTURE.md`, `tests/docsLink.test.ts`. `visual` is planned; `decision`/`runtime` are future. | KawnGraph models docs/data/test as **first-class layers**; CodeGraphContext focuses on the code call-graph. |
| **Context packs** | Returns entry points, related symbols, and code snippets for a query; **no stated token budget** or pack-level confidence in the README. | **Token-budgeted Context Packs** (default budget 8000, `--budget`), with must-read/docs/tables/tests/risks/excluded and a confidence score. See `packages/core/src/context`, `tests/context.test.ts`. | KawnGraph's product *is* the budgeted pack; CodeGraphContext exposes graph queries the agent assembles itself. |
| **Evidence / confidence** | Not described as per-edge evidence + confidence levels. | Every edge carries **evidence** (path + line range + snippet) and a **confidence level** (`extracted`/`linked`/`semantic`/`manual`); every node has a stable content-addressable ID. See `ARCHITECTURE.md`, `tests/ids.test.ts`. | A core KawnGraph design point. |
| **Incremental / watch** | **Yes** — "Live File Watching … automatically update the graph in real-time" (`cgc watch`). | **No live watch.** Rebuild is an **explicit** `kawn scan` / `kawn update`; MCP/Studio never rebuild. See `docs/AGENT_INTEGRATION.md` (freshness model). | **CodeGraphContext is ahead here.** KawnGraph trades auto-freshness for a strict "never rebuild during a session" guarantee, and warns when the graph is stale. |
| **MCP transport + write behavior** | MCP server; transport not stated explicitly in the README (standard MCP implies stdio). The server can **index directories and watch for changes**, i.e. it **updates the graph from inside the session** — not read-only. | **stdio**, newline-delimited **JSON-RPC 2.0**, **zero runtime dependencies**, **strictly read-only** — it never scans/rebuilds/writes; refuses an incompatible/malformed graph. See `packages/mcp/src/index.ts`, `tests/mcp.test.ts`, `tests/mcpFreshness.test.ts`. | **Key design difference.** CodeGraphContext's server can write/refresh the graph; KawnGraph's server only ever reads it. |
| **Hooks / default behavior** | Agent reaches the graph via MCP tools after `mcp setup`. | No lifecycle hooks installed; never edits `CLAUDE.md`/`AGENTS.md`. Behavior change rides on the MCP server's advertised instructions + tool descriptions. See `docs/AGENT_INTEGRATION.md`. | KawnGraph avoids prose-file edits and hooks by design (suggest-only hooks are *planned, not built*). |
| **Query logging** | Not described in the README. | **No query logging by default.** See `README.md` "Privacy & security". | Verify CodeGraphContext's behavior from its source if this matters to you. |
| **Telemetry** | No telemetry mentioned in the README. | **No telemetry.** See `README.md` "Privacy & security". | Both appear local-first; neither claims to phone home. |
| **External-LLM behavior** | No external LLM / API-key calls mentioned (tree-sitter parsing, local graph). | **No internal LLM** required; no network during scan/retrieval; AI enrichment is **opt-in, local-first** (not built yet). See `README.md`, `PROJECT_PLAN.md`. | Both are LLM-optional for the core graph. |
| **Studio / visualization scaling** | HTML visualization (`--viz`): standalone files, force-directed/hierarchical layouts. No web Studio described. | **KawnGraph Studio** (`kawn map`): local, read-only, `127.0.0.1`; 2D graph + a **budgeted 3D "Universe"** (never draws a whole large graph at once) + Context-Pack/impact/changes/bench views; English + Arabic (RTL). See `apps/studio`, `packages/studio-server`, `tests/studioServer.test.ts`. | Different shapes: per-query HTML export vs. an interactive read-only explorer. |
| **Git / PR impact** | Not described in the README. | **Yes** — `kawn changes` / `pr-impact` and the `kawn_changes` MCP tool: impact of uncommitted edits or a branch vs a base ref (local git only). See `packages/core/src/git`, `tests/changeImpact.test.ts`. | A KawnGraph capability not surfaced in CodeGraphContext's public docs. |
| **Benchmark methodology** | README cites "average 35% cost savings, 70% fewer tool calls, 49% speed" across 7 projects; full methodology/sample sizes not detailed in the README excerpt reviewed. | **Local A/B harness**, same agent/task with-vs-without KawnGraph. Published artifact: **72 sessions, 12 cells, n=3/arm — exploratory, directional, NOT significant**; honest neutral/negative cells included. See [`benchmarks/published/campaign-2026-06-20.summary.json`](../benchmarks/published/campaign-2026-06-20.summary.json). | Compare methodologies, not headline numbers. KawnGraph's published numbers are explicitly under-powered and include regressions. |
| **Team / shared deployment** | Embedded DB per machine, or a shared external Neo4j server. | Repo-local: `.kawn/graph.json` + a committed, project-scoped MCP config the team shares; no server to host. See `docs/AGENT_INTEGRATION.md`. | CodeGraphContext can centralize on a shared DB; KawnGraph is file-in-repo, no shared service. |
| **Export formats** | HTML visualization export; no JSON/CSV/GraphML graph export stated in the README. | Context Pack as **text, JSON, UCP, UCP-Markdown** (`--format text\|json\|ucp\|ucp-md`); graph persisted as JSON; benchmark reports as JSON/CSV/Markdown. See `packages/context-protocol/src`, `packages/cli/src/commands/context.ts`. | Different export targets. Neither exports a standard graph-interchange format (e.g. GraphML) today — a gap for both. |
| **Maturity / community** | **MIT**, v0.5.1, active; an established public ecosystem (public repo, releases, external write-ups, contributor base). | **MIT**, `v0.1.0`, active development, **not yet on npm**; no public ecosystem/community yet. See `README.md` "Status & limitations". | **CodeGraphContext is the more mature, more public project.** KawnGraph is earlier and unpublished. We do not use star counts as a quality claim. |

### Where KawnGraph is behind (stated plainly)

- **Language breadth.** 5 formats vs CodeGraphContext's ~23 via tree-sitter.
- **Client integrations.** 3 agents vs CodeGraphContext's broad list.
- **Incremental / live watch.** KawnGraph has **none**; CodeGraphContext watches
  and updates in real time. KawnGraph requires an explicit `kawn update`.
- **Export formats.** No standard graph-interchange export (GraphML/CSV) — and
  no graph export at all for the raw graph beyond its own JSON.
- **Public ecosystem / community / maturity.** KawnGraph is `v0.1.0`,
  unpublished, with no community yet; CodeGraphContext is a more established,
  more public project.

### Where KawnGraph's design differs in its favor

- **Strictly read-only MCP** that never rebuilds during a session and refuses an
  untrusted graph.
- **Multi-layer** graph (docs / data / config / test as first-class), not
  code-only.
- **Evidence + confidence on every edge**, stable content-addressable IDs.
- **Token-budgeted Context Packs** as the product, with an agent-neutral export
  (UCP).
- **Git change-set impact** as a built-in surface (`kawn_changes`).
- **No database / no service to host** — graph is a single file in the repo.

---

## How to re-verify this document

```bash
# KawnGraph claims — read the source and run the suite
pnpm install && pnpm build
pnpm test                       # graph, context, MCP, agents, scanners, Studio

# scanner registry, read-only MCP, export formats
#   packages/scanners/src/plugins/index.ts
#   packages/mcp/src/index.ts
#   packages/cli/src/commands/context.ts
#   benchmarks/published/campaign-2026-06-20.summary.json
```

For CodeGraphContext, re-check the public source:
<https://github.com/CodeGraphContext/CodeGraphContext> (accessed 2026-06-23).
If its docs have changed since, treat the dated cells above as a historical
snapshot and re-source them.

---

## Caveats & scope

- This is a **capability** comparison, not a performance benchmark between the
  two tools. We did not run CodeGraphContext through KawnGraph's A/B harness.
- Competitor cells reflect that project's **public README at the access date**.
  Some behaviors (exact MCP transport, query logging) were not explicit in the
  source and are marked accordingly — verify from the source if they matter.
- KawnGraph cells reflect **this repo at commit `2de5ef48`**. Features marked
  *planned*/*future* in `README.md` and `PROJECT_PLAN.md` are not counted as
  shipped here.
- We use **no competitor logos or names in KawnGraph's branding**, and we treat
  **star counts as popularity, never as quality**.

---

## Related

- [README.md](../README.md) — overview, the approach table, and the benchmark block.
- [docs/AGENT_INTEGRATION.md](AGENT_INTEGRATION.md) — MCP contract, freshness, reversibility.
- [ARCHITECTURE.md](../ARCHITECTURE.md) — graph model, layers, evidence, IDs.
- [PROJECT_PLAN.md](../PROJECT_PLAN.md) — what is shipped vs planned.
- [`benchmarks/published/`](../benchmarks/published/) — the committed, validated benchmark artifacts.
