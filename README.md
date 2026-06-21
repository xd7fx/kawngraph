# KawnGraph — كون قراف

**The Agent Context Universe.** One project universe. Every coding agent.

> Give agents the map, not the repo.
> اعطِ الإيجنت الخريطة، مو المشروع كامل.

KawnGraph connects your code, docs, visuals, decisions, and configuration into a
single layered graph, then turns that graph into small, token-efficient
**context packs** for AI coding agents like Claude Code, Codex, and Cursor.

The name pairs two ideas. **Kawn** (Arabic **كَوْن** — *cosmos, universe,
existence*) treats a repository as a living universe of knowledge; **Graph** is
the evidence-backed Agent Context Graph at its core. A project is a universe:
files, docs, and tables are **bodies**, dependencies are the **gravity** that
binds them, and every relationship is an **orbit** with evidence behind it.

---

## Get started in one command

```bash
npx kawngraph setup
```

This scans your project, connects the coding agents you already use (Claude
Code, Codex, Cursor) over a **read-only** integration, and verifies that
retrieval works. Then open your agent and just describe your task — it pulls
the few files that matter, on its own. No API keys, no telemetry, no network
calls.

> نزّل KawnGraph، ثم اكتب `kawn`. — *Install KawnGraph, then type `kawn`.*

Every beginner command is a friendly alias: `kawn ask` (the files for a task),
`kawn impact` (what breaks if you change a symbol), `kawn changes` (what your
diff touches), `kawn map` (the visual explorer), `kawn check` (health), and
`kawn bench` (measure the difference). The technical names — `context`,
`affected`, `diff`/`pr-impact`, `studio`, `doctor`/`status`, `benchmark` —
remain fully supported; run `kawn help` for the complete surface.

---

## Why does an AI agent need a map?

When you give a coding agent a task, it usually starts by *reading*. A lot.
It opens dozens of files, scans docs, re-derives how routes connect to the
database, and rebuilds the same mental model on every single request. That is
slow, expensive in tokens, and often inaccurate — the agent can miss the one
file that actually matters and drown in five that do not.

KawnGraph flips this around. It scans the repository **once**, builds a graph of how
things relate, and then answers questions like:

- *What connects the storefront events route to the ranking logic?*
- *If I change `getMerchantContext()`, what breaks?*
- *Which files and docs do I actually need to fix the OAuth callback?*

Instead of reading 100 files, the agent reads the **5 that matter** — plus the
2 relevant docs, the related DB tables, and the tests it should run.

```
Task: Fix Zid OAuth callback

KawnGraph returns:
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
SQL **and** the decisions behind all of them. KawnGraph models each of these as a
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
kawn query "what calls getMerchantContext" --mode code   # code only
kawn query "where is OAuth documented?"     --mode docs   # docs only
kawn context "fix OAuth callback" --budget 8000           # smart mix, budgeted
```

---

## Principles

KawnGraph is built to be a trustworthy substrate for agents. That means:

- **No LLM by default.** Code, docs, and SQL are parsed structurally. AI
  enrichment is opt-in and runs locally first.
- **No hooks by default.** KawnGraph never inserts itself into your workflow
  uninvited. Hooks ship later and are strictly opt-in and suggest-only.
- **No telemetry. No network calls by default.** KawnGraph reads your repo and
  writes JSON. That's it.
- **Every edge has evidence.** Each relationship records *where* it came from —
  file, line range, snippet — and a confidence level (`extracted`, `linked`,
  `semantic`, `manual`). Nothing is asserted without a source.
- **Stable IDs.** Nodes are addressed by what they are, not where they sit on a
  line, so the graph stays diffable across scans.

---

## How is this different from a generic graph viewer?

Tools that visualize "file A imports file B" are useful but stop at the
mechanical layer. KawnGraph adds **meaning**: a doc *explains* a route, a screenshot
*depicts* a page, a decision *introduced* a feature, a migration *defines* a
table. And the goal is not a pretty picture — it is **retrieval**: producing the
minimal, correct context an agent needs for a specific task, under a token
budget. The visualization (KawnGraph Universe) exists to *explain* that retrieval, not
to replace it.

We are not trying to out-draw multimodal graph explorers. We are trying to make
agents cheaper and smarter on real codebases.

---

## Status

KawnGraph is in active development. The graph, the context packs, and the MCP server
are implemented and tested end-to-end:

- ✅ **Code graph** — TypeScript/JavaScript **and Python** files, imports,
  functions/classes, calls (Python via the mature `@lezer/python` grammar — a
  real structural parser, never regex). Python carries structural depth:
  decorator names, a class's own methods (with line/async/decorators) as
  evidence-rich metadata, and the module docstring — all without inventing nodes
- ✅ **Test layer** — files following test conventions (`*.test.*`/`*.spec.*`,
  `test_*.py`/`*_test.py`/`conftest.py`, or anything under a `tests`/`__tests__`
  directory) and their top-level symbols land in the dedicated `test` layer/type,
  so the Context Pack buckets them and `--mode tests` can scope to them — yet a
  test still participates in the call graph (its imports and calls still resolve)
- ✅ **Route detection** — Next.js App Router handlers, plus FastAPI/APIRouter
  and Flask decorators (`@app.get`, `@router.post`, `@app.route(methods=[…])`)
- ✅ **Data graph** — SQL tables and foreign keys (never ignored)
- ✅ **Config graph** — workspace packages and internal dependencies
- ✅ **Extensible scanners** — every language/format is a versioned **scanner
  plugin** behind one registry (detect → scan → finalize): deterministic order,
  per-file **failure isolation** (a throwing *or* malformed plugin is reduced to a
  diagnostic, never aborts the scan), explicit registration (no auto-loading),
  declared **capabilities** validated against real output, and bounded file sizes
- ✅ **Docs layer** — markdown headings/sections linked to code, SQL, and routes
  with evidence (`documents`, `explains`, `mentions`), no LLM
- ✅ **Context packs** — `kawn context "<task>" --budget N`: must-read code,
  related docs, tables, tests, risks, and an explicit excluded list, all under a
  token budget, deterministic, no LLM
- ✅ **Universal Context Protocol (UCP)** — `kawn context … --format ucp` (or
  `ucp-md`): an agent-neutral, versioned wire format any coding agent can consume
  without knowing KawnGraph internals. Role-tagged sections; every item explains its
  **why / layer / evidence / rank**; the producer advertises its capabilities.
  Canonical (hashable, lossless) JSON or drop-in Markdown. A consumer can
  **`negotiate`** capabilities/version up front (rather than guess), then run a
  hardened structural **validator** that checks every guarantee — protocol
  compatibility, in-range enums (mode, role, node kind, layer, risk), sound numbers
  (budgets/tokens ≥ 0, 1-based ranks), and non-empty evidence per item
- ✅ **Mode-scoped query** — `kawn query "<q>" --mode code|docs|all`
- ✅ **Impact analysis** — `kawn affected <symbol>` (reverse reachability over
  calls / imports / references / **package `depends_on`**, so changing a workspace
  package flags the packages that depend on it)
- ✅ **Git & PR impact** — `kawn diff`, `kawn pr-impact`, `kawn pr-context`
  map the files you changed (uncommitted, or a branch vs `--base`) onto the graph,
  then show the blast radius, files to re-check, and a budgeted pack to work it.
  **Renames are detected deterministically** (independent of your `diff.renames`
  config) and resolve to the old file's nodes; deletes still surface their
  dependents. **Local git only — no network, no GitHub API**
- ✅ **MCP server** — read-only stdio JSON-RPC, zero dependencies; tools
  `kawn_context`, `kawn_query`, `kawn_affected`, `kawn_changes`
- ✅ **KawnGraph Universe** — a local, **read-only** graph explorer (`kawn studio`):
  interactive 2D graph, a scalable 3D "Universe" star-map (budgeted so it never
  draws a whole large graph at once), context-pack builder, impact + flow tracing,
  and docs/data views. Reuses the same engines and only reads `.kawn/graph.json`
  — it never scans or writes (see [apps/studio/README.md](apps/studio/README.md))
- ✅ **One-command agent setup** — `kawn setup` detects Claude Code / Codex /
  Cursor and installs reversible, project-scoped MCP integrations, then verifies
  retrieval with a live MCP handshake. Reversible (`kawn disconnect`), atomic
  with backups, never edits `CLAUDE.md`/`AGENTS.md` (see
  [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md))
- ✅ **Claude Code integration** — slash commands, a skill, and a subagent that
  call the real KawnGraph interfaces (see below)
- ✅ Output: `.kawn/graph.json` + a human-readable `.kawn/report.md`
- ✅ Tested with Node's built-in test runner (`pnpm test`) — stable IDs,
  deterministic output, token-budget enforcement, docs-to-code linking, and the
  MCP transport, all covered

Genuinely not built yet: opt-in hooks, the visual layer, semantic/AI
enrichment, and a runtime layer. See [PROJECT_PLAN.md](PROJECT_PLAN.md) and
[ARCHITECTURE.md](ARCHITECTURE.md).

---

## Language support

Every language is a versioned **scanner plugin** (see *Extensible scanners*
above). What each built-in plugin extracts today:

| Language          | Extracted                                                                                                   | Not extracted (yet)                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| TypeScript / JS   | files, top-level functions/classes, imports (relative + workspace packages), calls, Next.js routes, tests   | `.d.ts` ambient declarations; type-only graph; methods as nodes |
| Python            | files, top-level `def`/`async def`/`class`, decorators, a class's own methods (metadata), imports (absolute/relative/`__init__`), calls, FastAPI/Flask routes, module docstrings, tests | `.pyi` stubs (ambient, like `.d.ts`); methods/nested defs as nodes; dynamic/`importlib` imports; star-import expansion |
| SQL               | tables, columns, foreign keys                                                                                | stored procedures; views                                        |
| package.json      | workspace packages and internal dependencies                                                                | —                                                               |
| Markdown          | headings/sections linked to code, SQL, and routes                                                           | —                                                               |

Two deliberate omissions are shared by both code scanners: **methods and nested
functions are never separate nodes** (only top-level symbols are — a method rides
on its class as metadata), and **ambient declaration files** (`.d.ts`, `.pyi`)
are never claimed because they are types, not source.

**Why `@lezer/python`, not tree-sitter?** Both are real structural parsers (not
regex). `@lezer/python` is **pure JavaScript**, **error-tolerant** (a malformed
file yields a partial tree, never a throw), and **synchronous** — it drops into
the scanner's deterministic, sync `scan()` contract with zero native bindings,
WASM, or async init. tree-sitter would add native/WASM build steps and an async
initialization that the per-file scanner contract does not allow, in exchange for
no accuracy we need here. So the choice buys cross-platform reproducibility
(notably on Windows) at no correctness cost.

---

## Build from source

Contributing or running against this monorepo directly? Use the workspace
scripts (the published package is what `npx kawngraph` runs above):

```bash
# install workspace deps and build
pnpm install
pnpm build

# scan a project (creates .kawn/graph.json and .kawn/report.md)
pnpm kawn scan ./path/to/your/project

# or try the bundled example
pnpm scan:example

# build a token-budgeted context pack for a task
pnpm kawn context "fix the OAuth callback that writes store tokens" --budget 8000

# emit the same pack in the agent-neutral Universal Context Protocol
# (--format ucp = canonical JSON · ucp-md = drop-in Markdown for a prompt)
pnpm kawn context "fix the OAuth callback" --format ucp-md --budget 8000

# ask a mode-scoped question (code only / docs only / everything)
pnpm kawn query "store tokens" --mode code
pnpm kawn query "where is OAuth documented?" --mode docs

# see what depends on a symbol before you change it
pnpm kawn affected getMerchantContext

# run the test suite (Node's built-in runner, no extra deps)
pnpm test

# connect this project to your coding agents in one command
# (scans if needed, installs reversible MCP integrations, verifies retrieval)
pnpm kawn setup --agent all --yes

# explore the graph in the local, read-only Studio
# (build the UI once — dist/ is gitignored — then serve it)
pnpm studio:build
pnpm studio examples/nextjs-supabase --port 4199
```

The scan never touches the network, never calls an LLM, and never writes
anything outside `.kawn/`. `node_modules`, `dist`, and friends are ignored;
SQL never is.

---

## Connect it to your coding agent

The point of KawnGraph is that the agent reaches for the map **automatically**. One
command wires a project to the agents you use — no editing of `CLAUDE.md` or
`AGENTS.md`, every change reversible:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn doctor                 # read-only health check (exits non-zero on FAIL)
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` detects Claude Code, Codex, and Cursor and installs a **read-only MCP
integration** scoped to the project — `.mcp.json`, `.cursor/mcp.json`, or
`.codex/config.toml` — backing up anything it touches and verifying the server
with a live handshake. The exact files, verified config formats (with sources +
dates), the automatic in-session behavior, and the reversibility guarantees are
documented in **[docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md)**.

**MCP server** — the read-only stdio server over the existing `.kawn/graph.json`
that `setup` registers. It exposes four tools:

| Tool | What it does |
| ---- | ------------ |
| `kawn_context` | Token-budgeted context pack for a task. |
| `kawn_query` | Ranked, mode-scoped search over the graph. |
| `kawn_affected` | Reverse impact: what depends on a symbol. |
| `kawn_changes` | Impact of the current change set (uncommitted, or a branch vs a base ref). Local git only — no network, no GitHub API. |

The server **only reads** the graph — it never scans or rebuilds it (it will warn
when the graph looks stale and point you to `kawn update`). Build the graph
first with `kawn scan`. See [packages/mcp/README.md](packages/mcp/README.md).

**Slash commands, skill, and subagent** (under `.claude/`, shared in this repo):

- `/kawn-scan`, `/kawn-context`, `/kawn-query` — thin wrappers over the CLI
- the `kawn-context` skill — guidance for pulling a pack before editing
- the `kawn-explorer` subagent — explores a repo through KawnGraph, not raw reads

Personal Claude settings (`launch.json`, `settings.local.json`) stay local and
are gitignored.

---

## Repository layout

```
kawn/
  packages/
    shared/           # types, logger, path + id helpers, errors
    scanner-sdk/      # the scanner plugin contract + registry (detect → scan → finalize)
    scanners/         # built-in scanner plugins: code (TS/JS), Python, SQL, package.json, markdown
    context-protocol/ # the Universal Context Protocol: agent-neutral pack schema, validate, json, markdown
    core/             # repo walker, graph builder/store, report, impact, context packs, flow, freshness
    cli/              # the `kawn` command
    mcp/              # read-only MCP server over .kawn/graph.json
    agents/           # agent-session integration: adapters + safe config IO (setup/connect/disconnect/doctor)
    studio-server/    # local, read-only HTTP API over .kawn/graph.json
    benchmark/        # local-only A/B harness (agents WITH vs WITHOUT KawnGraph)
  apps/
    studio/        # KawnGraph Universe — Vite + React graph explorer (read-only)
  examples/
    nextjs-supabase/   # sample project to scan
  scripts/      # pack-check.mjs — packaging audit (pnpm pack:check)
  tests/        # node:test suite (graph, context, docs links, MCP, agents, freshness)
  .claude/      # shared slash commands, skill, subagent
  .mcp.json     # registers the KawnGraph MCP server
  docs/
    AGENT_INTEGRATION.md   # the one-command agent setup contract
```

## License

MIT — see [LICENSE](LICENSE).
