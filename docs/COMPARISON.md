# KawnGraph — Comparison

> A neutral, dated, sourced comparison. The point is honesty, not a sales pitch:
> we show where KawnGraph leads, where it **differs**, and where it is **behind**.

**Document date:** 2026-06-23. The KawnGraph column reflects this repository at
commit `2de5ef48` (the commit recorded in the published benchmark artifact). The
competitor column reflects **Graphify**'s public GitHub repository, **accessed
2026-06-23** (its marketing site `graphifylabs.ai` returned HTTP 403 to automated
fetching and is not used as a source here).

Two comparisons live here:

1. A **primary, approach-based** table — KawnGraph against *categories* of tooling
   (plain repository search, general RAG, generic graph viewers). No named
   target; every cell defensible; `varies` where it genuinely depends on the tool.
2. A **secondary, named-tool** table — KawnGraph against **Graphify**, a real,
   mature, publicly documented graph-based code-context tool. Each Graphify cell
   is sourced from its public repository at the access date; each KawnGraph cell
   points at a file or test in *this* repository.

Verify any KawnGraph claim yourself: every KawnGraph cell points at a file or test
in this repo. Verify any Graphify claim against the linked public source.

---

## 1) Approach comparison (no named target)

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
| Works with **no** LLM anywhere in the pipeline | ✅ | ❌ | ✅ | ✅ |
| No telemetry, no query logging by default | varies | varies | varies | ✅ |
| Broad language/format breadth out of the box | varies | ✅ | varies | **❌ (5 scanners)** |
| Incremental / live file-watch indexing | n/a | varies | varies | **❌ (explicit `kawn update`)** |

The last two rows are deliberate: KawnGraph is **narrow and explicit** today. It
covers five formats (TS/JS, Python, SQL, `package.json`, Markdown) and rebuilds
only on an explicit `kawn scan` / `kawn update`, never during a session.

Sources for the KawnGraph column: this repository's `README.md`,
`docs/AGENT_INTEGRATION.md`, `ARCHITECTURE.md`, the scanner registry in
`packages/scanners/src/plugins/index.ts`, the read-only MCP loop in
`packages/mcp/src/index.ts`, and the test suite under `tests/`.

---

## 2) Named-tool comparison: KawnGraph vs Graphify (sourced)

**Graphify** ([github.com/safishamsi/graphify](https://github.com/safishamsi/graphify),
**accessed 2026-06-23**, stated version **v0.8.45**, released 2026-06-22, MIT) turns
"any folder of code, SQL schemas, R scripts, shell docs, papers, images, or
videos into a queryable knowledge graph." It is a mature, broad, actively
released project with a public ecosystem. KawnGraph is earlier (`v0.1.0`,
unpublished) and deliberately narrower.

This is **not** an endorsement, attack, or ranking — different designs, different
trade-offs. Where a behavior is not stated in Graphify's public README, the cell
says so rather than guessing.

| Capability | Graphify (public repo, accessed 2026-06-23, v0.8.45) | KawnGraph (this repo, commit `2de5ef48`) | Notes |
| --- | --- | --- | --- |
| **Install prerequisites** | Python 3.10+; `uv` or `pipx`: `uv tool install graphifyy` / `pipx install graphifyy`; then `graphify install`. | Node ≥18 + pnpm; build from source (`pnpm install && pnpm build`). **Not yet published to npm** (`packages/cli` `private:true`) — no `npx kawngraph` today. | Different runtimes (Python vs Node). |
| **Scanners / formats** | **36 tree-sitter grammars** (Python, JS/TS, Go, Rust, Java, C/C++, C#, Ruby, PHP, Swift, Kotlin, …) **plus** Apex, Terraform/HCL, manifests, Markdown, YAML, **PDFs, Office (.docx/.xlsx), Google Workspace, images, and video/audio transcription**. | **5 formats**, each a versioned plugin: TS/JS, Python (`@lezer/python`, pure-JS), SQL, `package.json`, Markdown. See `packages/scanners/src/plugins/index.ts`. | **Graphify is far broader** — code, docs, and rich media. KawnGraph trades breadth for deterministic, dependency-light, LLM-free scanners. |
| **Graph storage** | File-based: `graph.json` + `GRAPH_REPORT.md` + `graph.html` in `graphify-out/` (intended for git commit). | File-based: `.kawn/graph.json` + `report.md` (gitignored by default). | Both are file-based, no database required. |
| **Coding-agent integrations** | ~20+: Claude Code, Codex, Cursor, Copilot CLI/Chat, Aider, Gemini CLI, OpenCode, Kilo/Roo/Cline, Amazon Q, Kiro, Goose, Antigravity, … | **8 adapters**: Claude Code, Codex, Cursor, Copilot, Gemini CLI (read-only MCP); Aider (context file); `generic` (Markdown/JSON export); optional local LLM — all reversible, project-scoped, contract-tested. See `packages/agents`, `tests/agentAdapters.test.ts`. | **Graphify integrates with more clients.** KawnGraph's eight adapters are contract-tested and reversible. |
| **Graph layers** | Code + docs + media; SQL schemas and many formats; no explicit `code/data/config/docs/test` layer taxonomy described. | Five live layers (`code`/`data`/`config`/`docs`/`test`) with per-layer query modes. See `ARCHITECTURE.md`, `tests/docsLink.test.ts`. | KawnGraph models layers + per-layer modes as first-class; Graphify ingests more formats overall. |
| **Context packs** | `query`/`path`/`explain` with DFS + budget params; returns nodes/snippets. No "Context Pack" with must-read/risks/excluded/confidence described. | **Token-budgeted Context Packs** (default 8000, `--budget`) with must-read/docs/tables/tests/risks/excluded + a confidence score; agent-neutral UCP export. See `packages/core/src/context`, `tests/context.test.ts`. | KawnGraph's product *is* the budgeted pack; Graphify exposes graph queries the agent composes. |
| **Evidence / confidence** | Not described as per-edge evidence + confidence levels. | Every edge carries **evidence** (path + line range + snippet) and a **confidence level**; stable content-addressable node IDs. See `ARCHITECTURE.md`, `tests/ids.test.ts`. | A core KawnGraph design point. |
| **Incremental / watch** | **Yes** — `--update` (changed files only), `--watch` (filesystem), `graphify hook install` (rebuild on git commit). | **No live watch.** Rebuild is an explicit `kawn scan` / `kawn update`; MCP/Studio never rebuild and warn when stale. See `docs/AGENT_INTEGRATION.md`. | **Graphify is ahead here.** KawnGraph trades auto-freshness for a strict "never rebuild during a session" guarantee. |
| **MCP transport + write behavior** | MCP over **stdio or HTTP**; tools `query_graph`, `get_node`, `get_neighbors`, `shortest_path`, `list_prs`, `get_pr_impact`, `triage_prs`. **Read-only** (cannot write/re-index through MCP). | **stdio** JSON-RPC 2.0, **zero deps**, **read-only**; refuses an incompatible/malformed graph. See `packages/mcp/src/index.ts`, `tests/mcp.test.ts`. | **Both MCP servers are read-only.** Graphify adds an HTTP transport and PR tools; KawnGraph adds a hard stale/incompatible-refusal guarantee. |
| **Hooks / default behavior** | Optional `graphify hook install` rebuilds the graph on git commit. | No lifecycle hooks installed; never edits `CLAUDE.md`/`AGENTS.md`. Suggest-only hooks are *planned, not built*. | Different defaults: Graphify offers a commit hook; KawnGraph stays out of the workflow by default. |
| **Query logging** | **On by default** — queries logged to `~/.cache/graphify-queries.log` (opt-out via env var). | **No query logging.** See `README.md` "Privacy & security", `docs/PRIVACY.md`. | KawnGraph does not log queries at all. |
| **Telemetry** | "No telemetry, no usage tracking, no analytics." | **No telemetry.** | Both local-first; neither phones home. |
| **External-LLM behavior** | Code extraction is local (tree-sitter); **docs/PDFs/images use an LLM** via the IDE session or a configurable headless backend (Claude/Gemini/OpenAI/DeepSeek/Kimi/Ollama/Bedrock/Azure). | **No LLM anywhere** in scan or retrieval — the docs layer is deterministic too. AI enrichment is opt-in/local-first and *not built yet*. See `README.md`, `PROJECT_PLAN.md`. | KawnGraph's pipeline is fully LLM-free; Graphify uses an LLM for non-code formats. |
| **Visualization** | Interactive `graph.html`; callflow/architecture HTML with Mermaid diagrams. | **KawnGraph Studio** (`kawn map`): local, read-only, `127.0.0.1`; 2D graph + budgeted 3D "Universe" + Context-Pack/impact/changes/bench views; EN + AR (RTL). See `apps/studio`, `tests/studioServer.test.ts`. | Per-query HTML export vs an interactive read-only explorer. |
| **Git / PR features** | Rich: PR dashboard (CI, review, worktree mapping), per-PR deep-dive, **AI triage ranking**, conflict detection across graph communities. | `kawn changes` / `pr-impact` and the `kawn_changes` MCP tool: impact of uncommitted edits or a branch vs a base ref (local git only). See `packages/core/src/git`, `tests/changeImpact.test.ts`. | **Graphify's PR tooling is broader** (dashboard + triage). KawnGraph focuses on graph-level change impact. |
| **Benchmark methodology** | No benchmark stated in the README at the accessed version. | **Local A/B harness**, same agent/task with-vs-without KawnGraph. Published artifact: **72 sessions run, 12 excluded for gold provenance, 60 usable across 10 cells, n=3/arm — exploratory, directional, NOT significant**; honest neutral/negative cells included. See [`benchmarks/published/campaign-2026-06-20.summary.json`](../benchmarks/published/campaign-2026-06-20.summary.json). | KawnGraph publishes an explicitly under-powered behavioral A/B; Graphify publishes none in-repo. |
| **Team / shared deployment** | `graphify-out/` committed to git; shared **HTTP MCP** server with `--api-key`; a merge-driver for conflict-free parallel `graph.json` commits. | Repo-local `.kawn/graph.json` + a committed project-scoped MCP config the team shares; no server to host. See `docs/AGENT_INTEGRATION.md`. | Graphify can centralize on a shared HTTP server; KawnGraph is file-in-repo, no service. |
| **Export formats** | Many: JSON, HTML, **Markdown wiki, Obsidian vault, SVG, GraphML (Gephi/yEd), Cypher (Neo4j/FalkorDB)**, callflow HTML + Mermaid. | Context Pack as **text / JSON / UCP / UCP-Markdown**; graph as JSON; benchmark reports as JSON/CSV/Markdown. See `packages/context-protocol/src`. | **Graphify exports far more graph-interchange formats** (GraphML/Cypher/Obsidian). KawnGraph's exports center on the agent-facing pack. |
| **Maturity / community** | **MIT**, **v0.8.45** (2026-06-22), active releases, broad public ecosystem. | **MIT**, `v0.1.0`, active development, **not yet on npm**; no public ecosystem yet. | **Graphify is the more mature, more public project.** We do not use star counts as a quality claim. |

### Where Graphify leads (stated plainly)

- **Input breadth** — 36 tree-sitter grammars **plus** PDFs, Office, Google
  Workspace, images, and audio/video, vs KawnGraph's 5 code/data/doc formats.
- **Client integrations** — ~20+ vs KawnGraph's 3.
- **Incremental / live watch** — `--update`, `--watch`, and a git-commit hook, vs
  KawnGraph's explicit `kawn update` only.
- **Export formats** — GraphML, Cypher, Obsidian, SVG, Mermaid, Markdown wiki, vs
  KawnGraph's pack/JSON exports.
- **PR tooling** — dashboard, AI triage ranking, and conflict detection.
- **Maturity & ecosystem** — v0.8.45 with public releases vs an unpublished v0.1.0.

### Where KawnGraph differs (by design)

- **No LLM anywhere** in scan or retrieval — including the docs layer (Graphify
  uses an LLM to extract docs/PDFs/images).
- **No query logging at all** (Graphify logs queries to `~/.cache` by default,
  opt-out).
- **Evidence + confidence on every edge**, stable content-addressable IDs.
- **Token-budgeted Context Packs** as the product, with an agent-neutral export
  (UCP) — vs raw graph queries the agent assembles.
- **Explicit code/data/config/docs/test layers** with per-layer query modes.
- **A published behavioral A/B benchmark** (honestly under-powered and including
  regressions), where Graphify publishes none in-repo.
- **A hard read-only/stale-refusal MCP guarantee** (both servers are read-only;
  KawnGraph additionally refuses to serve an incompatible or malformed graph).

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

For Graphify, re-check the public source:
<https://github.com/safishamsi/graphify> (accessed 2026-06-23, v0.8.45). If its
docs have changed since, treat the dated cells above as a historical snapshot and
re-source them.

---

## Caveats & scope

- This is a **capability** comparison, not a performance benchmark between the two
  tools. We did not run Graphify through KawnGraph's A/B harness.
- Graphify cells reflect that project's **public repository at the access date**.
  Behaviors not stated in its README are marked accordingly — verify from the
  source if they matter. Graphify's marketing site (`graphifylabs.ai`) returned
  HTTP 403 to automated fetching and is **not** cited here.
- KawnGraph cells reflect **this repo at commit `2de5ef48`**. Features marked
  *planned*/*future* are not counted as shipped.
- We use **no competitor logos or names in KawnGraph's branding**, and we treat
  **star counts as popularity, never as quality**.

---

## Related

- [README.md](../README.md) — overview, the approach table, and the benchmark block.
- [docs/AGENT_INTEGRATION.md](AGENT_INTEGRATION.md) — MCP contract, freshness, reversibility.
- [docs/BENCHMARKS.md](BENCHMARKS.md) — methodology, exclusions, and full results.
- [ARCHITECTURE.md](../ARCHITECTURE.md) — graph model, layers, evidence, IDs.
- [`benchmarks/published/`](../benchmarks/published/) — the committed, validated benchmark artifacts.
