<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="brand/logo-light.svg">
  <img src="brand/logo.svg" alt="KawnGraph" width="320">
</picture>

### The Agent Context Universe

**One project universe. Every coding agent.**

KawnGraph maps code, docs, data, tests, and Git changes into evidence-backed
**Context Packs** so Claude, Codex, and Cursor can reach the right files without
reading the entire repository.

[![License: MIT](https://img.shields.io/badge/License-MIT-22C7A9.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518-4C8DFF.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-4C8DFF.svg)](tsconfig.base.json)
[![Local-first](https://img.shields.io/badge/Local--first-no%20cloud-42D392.svg)](docs/PRIVACY.md)
[![No telemetry](https://img.shields.io/badge/Telemetry-none-42D392.svg)](docs/PRIVACY.md)
[![Support](https://img.shields.io/badge/Support-get%20help-4C8DFF.svg)](SUPPORT.md)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Abdulrahman%20Alnashri-0A66C2.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)

<!-- LANGBAR:START -->

**English** ·
[العربية](README.ar.md) ·
[Español](docs/i18n/README.es.md) ·
[Français](docs/i18n/README.fr.md) ·
[Deutsch](docs/i18n/README.de.md) ·
[Português (BR)](docs/i18n/README.pt-BR.md) ·
[简体中文](docs/i18n/README.zh-CN.md) ·
[繁體中文](docs/i18n/README.zh-TW.md) ·
[日本語](docs/i18n/README.ja.md) ·
[한국어](docs/i18n/README.ko.md) ·
[हिन्दी](docs/i18n/README.hi.md) ·
[Bahasa Indonesia](docs/i18n/README.id.md) ·
[Türkçe](docs/i18n/README.tr.md) ·
[Русский](docs/i18n/README.ru.md) ·
[Italiano](docs/i18n/README.it.md) ·
[فارسی](docs/i18n/README.fa.md) ·
[اردو](docs/i18n/README.ur.md) ·
[Polski](docs/i18n/README.pl.md) ·
[Nederlands](docs/i18n/README.nl.md) ·
[Українська](docs/i18n/README.uk.md) ·
[Tiếng Việt](docs/i18n/README.vi.md) ·
[ภาษาไทย](docs/i18n/README.th.md) ·
[Svenska](docs/i18n/README.sv.md) ·
[Ελληνικά](docs/i18n/README.el.md) ·
[Română](docs/i18n/README.ro.md) ·
[Čeština](docs/i18n/README.cs.md) ·
[Suomi](docs/i18n/README.fi.md) ·
[Dansk](docs/i18n/README.da.md) ·
[Norsk](docs/i18n/README.no.md) ·
[Magyar](docs/i18n/README.hu.md) ·
[עברית](docs/i18n/README.he.md)

<sub>English is canonical · العربية is AI-assisted · owner review pending · the other 29 languages are machine-assisted (human review needed) — see [translation status](docs/i18n/STATUS.md).</sub>

<!-- LANGBAR:END -->

**[Quick Start](#quick-start)** ·
**[How It Works](#how-it-works)** ·
**[Studio](#studio)** ·
**[Benchmarks](#benchmarks)** ·
**[Docs](#documentation)** ·
**[Contributing](#contributing)**

</div>

---

<div align="center">
<img src="docs/assets/context-pack-flow.svg" alt="A task ('Fix the Zid OAuth callback') flows into KawnGraph, which returns a token-budgeted Context Pack: must-read files, related docs, tables, tests, risks, an excluded list, and a confidence score." width="860">
</div>

---

## Why KawnGraph?

When you give a coding agent a task, it usually starts by *reading* — a lot. It
opens dozens of files, re-derives how routes reach the database, and rebuilds the
same mental model on every request. That is slow, token-expensive, and often
inaccurate: the agent misses the one file that matters and drowns in five that do
not.

KawnGraph scans the repository **once**, builds a layered, evidence-backed graph
of how things relate, then answers, for a specific task, with the **few files
that matter** — plus the relevant docs, the related database tables, the tests to
run, and the risks to watch. That bundle is a **Context Pack**. The graph is the
substrate; the Context Pack is the product.

> **Give agents the map, not the repo.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Quick Start

> **Heads-up:** the `kawngraph` npm package is **not published yet**, so
> `npx kawngraph …` is *not* available today. Use the from-source path below; the
> `npx` flow is shown for **after publication**.

**Today — from source** (this monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**After npm publication** (the intended one-command experience):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Then open your agent and just describe your task — it pulls the few files that
matter, on its own. No API keys, no telemetry, no network calls during scan or
retrieval. New to it? Start with **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)**.

---

## Connect it to your coding agent

The point of KawnGraph is that the agent reaches for the map **automatically**.
One command wires a project to the agents you use — without editing `CLAUDE.md`
or `AGENTS.md`, every change reversible:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` detects your coding agents — **Claude Code**, **Codex**, **Cursor**,
**Copilot**, **Gemini CLI**, and **Aider** (plus a `generic` Markdown/JSON export
and an optional **local LLM**) — and installs a **read-only integration** scoped to
the project (`.mcp.json`, `.cursor/mcp.json`, `.codex/config.toml`,
`.vscode/mcp.json`, `.gemini/settings.json`, or an Aider context file), backing up
anything it touches and verifying each MCP server with a live handshake. Full
contract: **[docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md)**.

The **MCP server** is read-only stdio JSON-RPC with zero dependencies and four tools:

| Tool | What it does |
| ---- | ------------ |
| `kawn_context` | Token-budgeted Context Pack for a task. |
| `kawn_query` | Ranked, mode-scoped search over the graph. |
| `kawn_affected` | Reverse impact: what depends on a symbol. |
| `kawn_changes` | Impact of the current change set (uncommitted, or a branch vs a base ref). Local git only. |

It **only reads** the graph — it never scans, rebuilds, or writes it (it warns
when the graph looks stale and points to `kawn update`).

---

## How It Works

A project is not just code. It is code **and** docs **and** SQL **and** tests
**and** the configuration that ties them together. KawnGraph models each as a
distinct **layer**, so a query asks for exactly what it needs and nothing it does
not — a code-impact query never drags in marketing docs; a docs query never
returns raw call graphs unless you ask.

<div align="center">
<img src="docs/assets/architecture.svg" alt="KawnGraph reads your repo with deterministic scanners into one layered graph at .kawn/graph.json (code, data, config, docs, test layers), served read-only to the kawn CLI, the MCP server, and Studio. No network, no LLM, no telemetry." width="860">
</div>

| Layer    | Examples                                            |
| -------- | --------------------------------------------------- |
| `code`   | files, functions, classes, imports, calls, routes   |
| `data`   | SQL tables, migrations, foreign keys                |
| `config` | workspace packages, dependencies                    |
| `docs`   | markdown sections, links, mentions                  |
| `test`   | tests and what they cover                           |

Every edge carries **evidence** (source path, line range, snippet) and a
confidence level; every node has a **stable, content-addressable ID** so the
graph stays diffable across scans. Deeper model:
**[docs/GRAPH_MODEL.md](docs/GRAPH_MODEL.md)**.

### A Context Pack, end to end

```text
$ kawn ask "fix the Zid OAuth callback that writes store tokens"

Must-read
  app/api/zid/oauth/callback/route.ts     entry route
  packages/zid/src/oauth.ts               token exchange
  packages/db/.../storeTokens.ts          writes store_tokens
Docs
  docs/zid-oauth-core.md#callback-flow     expected behaviour
Tables
  store_tokens (written) · merchants (fk)
Tests        oauth.test.ts
Risks        token encryption · tenant isolation
Excluded     unrelated UI components (over budget)   ·   confidence 0.6
```

The same pack is available as Markdown, JSON, or the agent-neutral **Universal
Context Protocol** (`--format ucp` / `ucp-md`). More:
**[docs/CONTEXT_PACKS.md](docs/CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` opens **KawnGraph Studio** — a local, **read-only** explorer served
over `127.0.0.1` that reads the existing `.kawn/graph.json` and never scans,
rebuilds, or writes. It offers an interactive 2D graph, a scalable 3D "Universe"
star-map (budgeted so it never draws a whole large graph at once), a Context-Pack
builder, reverse-impact, Git-change views, and a behavioral benchmark view. Built
in English and Arabic (RTL-aware). Run it from source with `pnpm studio:build &&
pnpm kawn map`.

<div align="center">
<img src="docs/assets/studio-universe.webp" alt="KawnGraph Studio — the read-only 3D 'Universe' view of this repository's own graph: 1,261 nodes clustered by layer (Code 815, Docs 430, Config 13, Data 3) with connection lines, plus per-layer/type/edge filters." width="860">
<br><sub>The 3D <b>Universe</b> view — this repository's own graph (1,261 nodes), read-only.</sub>
</div>

<div align="center">
<img src="docs/assets/studio-map.webp" alt="KawnGraph Studio — the 2D graph view of the bundled example project: files, functions, routes, tables, and docs as nodes with labeled evidence-backed edges (imports, calls, defines, mentions, explains), plus layer/type/edge filters." width="860">
<br><sub>The 2D <b>graph</b> view — the bundled example project, with layer / type / edge filters.</sub>
</div>

---

## KawnGraph vs. plain repository search

A neutral comparison of *approaches* (not a competitor attack). Every cell is
defensible; "varies" means it depends on the specific tool.

| Capability | Plain search | General RAG | Generic graph viewer | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministic local scan | ✅ | varies | ✅ | ✅ |
| Symbol-level relationships | ❌ | varies | ✅ | ✅ |
| Docs / data / test layers | ❌ | varies | varies | ✅ |
| Evidence on every edge | ❌ | ❌ | varies | ✅ |
| Bounded impact analysis | ❌ | ❌ | varies | ✅ |
| Git-change context | varies | ❌ | ❌ | ✅ |
| Token-budgeted Context Packs | ❌ | varies | ❌ | ✅ |
| Read-only MCP retrieval | ❌ | varies | varies | ✅ |
| No internal LLM required | ✅ | ❌ | ✅ | ✅ |

A dated, sourced, three-column comparison against a mature graph tool
(capabilities KawnGraph leads on **and** capabilities it does not) lives in
**[docs/COMPARISON.md](docs/COMPARISON.md)**.

---

## Benchmarks

KawnGraph ships a **local A/B harness** that runs the *same* agent on the *same*
task **with vs without** KawnGraph and records behavior. Results are honest and
**task-dependent** — including neutral and negative cases.

<!-- BENCH:START -->

<!-- Generated by scripts/readme-benchmark.mjs from benchmarks/published/campaign-2026-06-20.summary.json — do not edit by hand. -->

Local A/B harness: 72 sessions run, 60 usable across 10 task cells, seed 1, 3 repeats per arm (3/arm after grouping — **exploratory, n<5, directional only**). Same agent, same task, same repository snapshot; A = without KawnGraph, B = with. Δ = B − A. 12 of 72 sessions were excluded for gold provenance (see the artifact). Gold validation: all retained runs have a valid gold reference.

**Headline task — `zid-oauth` (retrieval) on `nextjs-supabase`:**

*Claude Code — same task, same repository, same model (model not pinned in artifact):*

| Metric | Without KawnGraph | With KawnGraph | Difference |
| --- | --- | --- | --- |
| task correctness | 100% | 100% | 0 pp |
| automatic KawnGraph invocation | 0% | 100% | +100 pp |
| relevant files found (recall) | 100% | 93% | -7 pp |
| opened-file precision | 83% | 89% | +6 pp |
| distinct files opened | 6 | 5.3 | -0.7 |
| tool calls | 8.3 | 8.7 | +0.3 |
| time to first relevant file | 20.7 s | 22.4 s | +1.7 s |
| total wall time | 54.6 s | 61.9 s | +7.3 s |
| output tokens | 2,867 | 3,130 | +262 |

*Codex — same task, same repository, same model (model not pinned in artifact):*

| Metric | Without KawnGraph | With KawnGraph | Difference |
| --- | --- | --- | --- |
| task correctness | 100% | 100% | 0 pp |
| automatic KawnGraph invocation | 0% | 0% | 0 pp |
| relevant files found (recall) | 80% | 87% | +7 pp |
| opened-file precision | 25% | 61% | +36 pp |
| distinct files opened | 1 | 4.3 | +3.3 |
| tool calls | 2.7 | 8 | +5.3 |
| time to first relevant file | 18.7 s | 17.8 s | -884 ms |
| total wall time | 36.4 s | 41 s | +4.5 s |
| output tokens | 822 | 1,082 | +260 |

> KawnGraph is task-dependent. It can reduce repository exploration on unfamiliar multi-file work, while adding overhead on already-focused tasks. See the full methodology and limitations in [docs/BENCHMARKS.md](docs/BENCHMARKS.md).

**Where it helped, was neutral, or hurt (all 10 task cells):**

| Task family | Agent | Mode | Outcome | Tool-call Δ | Time Δ |
| --- | --- | --- | --- | --- | --- |
| context-pack-ranking | claude | retrieval | Neutral | -0.3 | +6.2 s |
| docs-to-code-linking | claude | retrieval | Neutral | -0.3 | +9.6 s |
| freshness-gate | claude | retrieval | Improved | -9.7 | -54.6 s |
| oauth-code-guard | claude | e2e | Neutral | -0.3 | +5.9 s |
| zid-oauth | claude | retrieval | Regressed | +0.3 | +7.3 s |
| context-pack-ranking | codex | retrieval | Regressed | +4 | +33.3 s |
| docs-to-code-linking | codex | retrieval | Improved | -0.7 | -4.6 s |
| freshness-gate | codex | retrieval | Neutral | 0 | -2.1 s |
| oauth-code-guard | codex | e2e | Regressed | 0 | +1.5 s |
| zid-oauth | codex | retrieval | Regressed | +5.3 | +4.5 s |

Outcome labels (`Improved` / `Neutral` / `Regressed` / `Insufficient data`) are derived deterministically from tool-call and wall-time deltas; every cell is n=3/arm, so all are directional. Full per-metric tables: [benchmarks/published/campaign-2026-06-20.md](benchmarks/published/campaign-2026-06-20.md).

<!-- BENCH:END -->

Methodology, environment, sample sizes, the per-metric tables, and limitations:
**[docs/BENCHMARKS.md](docs/BENCHMARKS.md)** — generated from the committed,
validated artifact in [`benchmarks/published/`](benchmarks/published/).

---

## Supported scanners & layers

Every language/format is a versioned **scanner plugin** behind one registry
(detect → scan → finalize): deterministic order, per-file failure isolation,
explicit registration, and bounded file sizes.

| Language / format | Extracted |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

Two deliberate omissions in both code scanners: methods/nested functions are
never separate nodes (a method rides on its class as metadata), and ambient
declaration files (`.d.ts`, `.pyi`) are never claimed. Details:
**[docs/SCANNERS.md](docs/SCANNERS.md)**.

---

## Privacy & security

- **No network by default.** Scan and retrieval read your repo and write JSON
  under `.kawn/`. Nothing leaves the machine.
- **No internal LLM.** Code, docs, and SQL are parsed structurally; AI enrichment
  is opt-in and local-first.
- **No telemetry. No query logging by default.**
- **Read-only MCP.** The server serves the graph; it never scans, rebuilds, or
  writes — and refuses to serve a graph whose schema it cannot trust.
- **Reversible, project-scoped integrations.** Atomic writes, timestamped
  backups, structured (not string) config edits; never edits `CLAUDE.md` /
  `AGENTS.md`, never touches global config by default.

Full model: **[docs/PRIVACY.md](docs/PRIVACY.md)**. Report a vulnerability
privately via **[SECURITY.md](SECURITY.md)**.

---

## Status & limitations

KawnGraph is in **active development** (`v0.1.0`, not yet published to npm). Built
and tested end-to-end: the code/data/config/docs/test graph, docs-to-code links,
mode-scoped query, impact analysis, Git/PR impact, token-budgeted Context Packs,
the Universal Context Protocol, the read-only MCP server, one-command agent setup
(Claude Code / Codex / Cursor), Studio, and the A/B benchmark harness.

**Honest limits.** The published benchmark is **exploratory (n<5 per arm —
directional, not significant)**. KawnGraph helps most on unfamiliar multi-file
discovery and can add overhead on already-focused single-file tasks. Not built
yet: opt-in suggest-only hooks, the visual layer, semantic/AI enrichment, and a
runtime layer — all opt-in by design. See
[PROJECT_PLAN.md](PROJECT_PLAN.md) · [ARCHITECTURE.md](ARCHITECTURE.md) ·
[docs/FAQ.md](docs/FAQ.md) · [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

## Documentation

| Guide | What's inside |
| ----- | ------------- |
| [Getting started](docs/GETTING_STARTED.md) | Install, scan, first Context Pack |
| [Agent integration](docs/AGENT_INTEGRATION.md) | MCP setup contract, reversibility |
| [Context Packs](docs/CONTEXT_PACKS.md) | Ranking, budgets, UCP wire format |
| [Graph model](docs/GRAPH_MODEL.md) | Nodes, edges, layers, evidence, IDs |
| [Scanners](docs/SCANNERS.md) | What each language plugin extracts |
| [Benchmarks](docs/BENCHMARKS.md) | Methodology, environment, full results |
| [Comparison](docs/COMPARISON.md) | Dated, sourced capability comparison |
| [Privacy](docs/PRIVACY.md) | Data boundaries per layer |
| [Troubleshooting](docs/TROUBLESHOOTING.md) · [FAQ](docs/FAQ.md) | Common issues & questions |

---

## Contributing

Contributions are welcome. Build from source, run the suite, and read the guide:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for setup, conventions, and the
privacy review every PR passes; **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** for
community expectations; **[docs/i18n/TRANSLATING.md](docs/i18n/TRANSLATING.md)**
to add or review a language; and **[SUPPORT.md](SUPPORT.md)** for where to ask
questions.

---

## License & acknowledgements

**[MIT](LICENSE)** © KawnGraph contributors.

Created & maintained by **[Abdulrahman Alnashri](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)**.

**Kawn** (Arabic **كَوْن** — *cosmos, universe, existence*) treats a repository as
a living universe of knowledge; **Graph** is the evidence-backed Agent Context
Graph at its core. Built with [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/), and
[`@lezer/python`](https://lezer.codemirror.net/).
