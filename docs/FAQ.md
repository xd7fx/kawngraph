# KawnGraph FAQ

Short, honest answers to the questions people ask most. For the full picture,
see the **[README](../README.md)** and **[Agent integration](AGENT_INTEGRATION.md)**.

> KawnGraph (كون قراف) maps your code, docs, data, tests, and Git changes into
> evidence-backed **Context Packs** so coding agents can reach the few files that
> matter without reading the whole repository.

---

## Is KawnGraph an LLM?

No. KawnGraph is a static analysis and retrieval tool, not a language model. It
scans your repository with deterministic, per-language scanners, builds a graph
of how things relate, and serves ranked Context Packs from that graph. There is
**no internal LLM** in the scan or retrieval path. Optional AI enrichment exists
but is **opt-in and local-first** — it is off by default, and nothing about the
core scan/retrieval requires a model or an API key.

## Does it replace Claude or Codex?

No. KawnGraph does not write code or answer your task — your agent does that.
KawnGraph gives the agent a better starting point: instead of the whole tree, it
hands over the specific files, docs, tables, and tests that matter for the task,
plus the risks to watch. It works **alongside** Claude Code, Codex, Cursor,
Copilot, Gemini, and Aider (and any tool via `generic` export), not instead of them.

## Does it upload my repository?

No. KawnGraph is local-first and makes **no network calls by default during scan
or retrieval**. The graph is built on your machine and written to a local
`.kawn/` directory (`graph.json` + `report.md`). There is no telemetry and no
query logging by default. Optional AI enrichment is the only feature that could
involve a model, and it is off unless you explicitly turn it on.

## Does MCP modify files?

No. The KawnGraph MCP server (id: `kawn`) is **strictly read-only**. It only
reads the prebuilt graph to answer its four tools (`kawn_context`, `kawn_query`,
`kawn_affected`, `kawn_changes`). It never edits your code, never scans, and
never rebuilds or writes the graph. Building and refreshing the graph is always
an explicit CLI step (`kawn scan` / `kawn update`).

## Does it always make agents faster?

No — and we are upfront about that. KawnGraph is **task-dependent**. It helps
most on unfamiliar, multi-file discovery, where finding the right files is the
hard part. On already-focused single-file tasks it can add overhead, because the
agent reads the pack on top of work it would have done anyway. Our exploratory
benchmark (72 sessions run; 12 excluded for gold provenance; 60 usable across 10
cells, n=3 per arm — directional, **not** statistically significant) shows a mix
of Improved, Neutral, and Regressed cells, with Codex seeing more regressions
than Claude in that run. See the published summary:
[`benchmarks/published/campaign-2026-06-20.summary.json`](../benchmarks/published/campaign-2026-06-20.summary.json).

## What happens when the graph is stale?

The MCP server still serves you — it just warns. When the graph may lag the code
(for example, git `HEAD` moved since the last scan), the server prepends a
prominent banner pointing to the one safe fix, `kawn update`, and serves the pack
anyway. A soft note covers the case where freshness can't be confirmed against
git. The read-only server **never blocks on mere staleness and never rebuilds**;
refreshing the graph is always your explicit `kawn update` (or `kawn scan`) in a
terminal. (It does refuse to serve a graph it cannot trust — i.e. an
incompatible or malformed one.)

## How large a repository has been measured?

The largest repository in our published scan-cost data is KawnGraph itself
(`kawn-self`): about **736 nodes, 1,770 edges, across 140 tracked files**, scanned
in roughly 0.6 s on the benchmark machine. The other measured project,
`nextjs-supabase`, is small (20 nodes / 39 edges / 4 files). These are the only
two repositories with committed scan-cost numbers, so we do **not** claim results
at larger scales — see
[`benchmarks/published/campaign-2026-06-20.summary.json`](../benchmarks/published/campaign-2026-06-20.summary.json)
for the raw figures.

## Which languages and file types are supported?

Today, five first-party scanners run (in order: package → code → Python → SQL →
docs):

| Scanner | File types |
| --- | --- |
| TypeScript / JavaScript | `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` |
| Python | `.py` |
| SQL | `.sql` |
| package.json | `package.json` |
| Markdown | `.md`, `.mdx` |

Two deliberate omissions: ambient declaration files (`.d.ts`, `.pyi`) are never
claimed as source, and methods / nested functions are never separate nodes — a
method rides on its class as metadata. Each scanner is a versioned plugin that is
explicitly registered (there is no auto-loading), runs deterministically, and
isolates per-file failures.

## Why use a graph instead of plain search?

Plain text search finds strings; it does not understand relationships. A coding
agent that greps a repo opens dozens of files, re-derives how routes reach the
database, and often misses the one file that matters while drowning in five that
don't. KawnGraph scans **once** and records how things actually relate — imports,
calls, routes, docs-to-code links, tables — so it can answer, for a specific
task, with the few files that matter **plus** the related docs, the tables the
code touches, the tests to run, and the risks. Every edge carries **evidence**
(source path + line range + snippet) and a confidence level, and every node has a
stable, content-addressable ID, so results are auditable and diffable across
scans — none of which a raw search gives you.

---

See also: **[README](../README.md)** · **[Agent integration](AGENT_INTEGRATION.md)** · **[Benchmark summary](../benchmarks/published/campaign-2026-06-20.summary.json)**
