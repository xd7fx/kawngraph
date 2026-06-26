# Getting started

KawnGraph maps your repo into an evidence-backed graph, then hands a coding agent
the **few files that matter** for a task — a [Context Pack](CONTEXT_PACKS.md) —
instead of the whole tree. This guide takes you from a fresh clone to a connected
agent in about **5 minutes**.

> **Install with `npx`.** `kawngraph` is on npm — `npx kawngraph <command>` runs it
> with no clone (Node ≥ 18), and `npx kawngraph setup` is the fastest start. The
> from-source path below (`pnpm install && pnpm build`, then `pnpm kawn <command>`)
> is for **contributors** working in this monorepo.

---

## Prerequisites

- **Node.js ≥ 18** (`node --version`).
- **[pnpm](https://pnpm.io)** (`npm install -g pnpm`). This is a pnpm workspace.
- A local **Git** checkout of this repository.

No API keys, no accounts. Scan and retrieval make **no network calls** and run
**no LLM** — see [PRIVACY.md](PRIVACY.md).

---

## The 5-minute path

### 1. Install and build (once)

```bash
pnpm install && pnpm build
```

`pnpm build` runs `tsc -b` across every package, producing the CLI entry point at
`packages/cli/dist/index.js` that `pnpm kawn` invokes.

### 2. Scan a project

Point the scanner at any project directory to build its graph:

```bash
pnpm kawn scan ./path/to/your/project
```

Or scan the repo's bundled sample (Next.js + Supabase) with the ready-made
script:

```bash
pnpm scan:example
```

Scanning writes the graph and a human-readable report into a local **`.kawn/`**
directory next to the scanned project (`.kawn/graph.json` + `.kawn/report.md`).
`scan` is the advanced name; `setup` (step 4) scans for you, and `update`
re-scans after you change code to keep the map fresh.

### 3. Build your first Context Pack

Ask for the files that matter for a concrete task. `ask` is the beginner alias
for `context`:

```bash
pnpm kawn ask "fix the OAuth callback that writes store tokens"
```

The pack is **token-budgeted** — it fits a budget so it never overflows an
agent's context window. The default budget is **8000** tokens; set your own with
`--budget`, and scope the pack to a layer with `--mode`:

```bash
pnpm kawn context "trace the checkout flow" --budget 8000 --mode code
```

Output is human-readable text by default. Add `--format json` for a machine pack,
or `--format ucp` / `--format ucp-md` for the agent-neutral **Universal Context
Protocol**. More on ranking, budgets, and the wire format:
[docs/CONTEXT_PACKS.md](CONTEXT_PACKS.md).

### 4. Connect an agent

Wire the project to your coding agents in one non-interactive step:

```bash
pnpm kawn setup --agent all --yes
```

`setup` scans if needed, detects **Claude Code**, **Codex**, and **Cursor**, and
installs a **read-only MCP integration** scoped to the project (`.mcp.json`,
`.cursor/mcp.json`, or `.codex/config.toml`). It writes atomically, backs up
anything it touches, and **never** edits `CLAUDE.md` or `AGENTS.md`. Target one
agent with `--agent claude|codex|cursor|copilot|gemini|aider|generic|local`,
preview without writing using `--dry-run`, and undo cleanly with
`pnpm kawn disconnect`. Full contract:
[docs/AGENT_INTEGRATION.md](AGENT_INTEGRATION.md).

After this, open your agent and just describe your task — it pulls the right
context on its own.

### 5. Open Studio (the visual map)

Build the Studio app once, then launch the local, read-only explorer. `map` is
the beginner alias for `studio`:

```bash
pnpm studio:build && pnpm kawn map
```

Studio serves over `127.0.0.1` and reads the existing `.kawn/graph.json` — it
never scans, rebuilds, or writes. It opens a browser by default (`--no-open` to
skip) on port **4173** (`--port <n>` to change). You get a 2D graph, a 3D
"Universe" star-map, a Context-Pack builder, reverse-impact, Git-change views,
and the benchmark view, in English and Arabic.

---

## Verify your setup

```bash
pnpm kawn check
```

`check` (alias for `doctor`/`status`) reports whether the graph is fresh and
which agents are connected. If it flags the graph as **stale** after you change
code, re-scan with:

```bash
pnpm kawn update
```

---

## Common options

These work across the relevant commands:

| Option | Used by | Meaning |
| ------ | ------- | ------- |
| `--root <path>` | most | Operate on a project at this path. |
| `--yes` | `setup` | Non-interactive; accept defaults (CI). |
| `--json` / `--format <fmt>` | `ask` / `context` | `text` (default), `json`, `ucp`, `ucp-md`. |
| `--budget <n>` | `ask` / `context` / `changes --context` | Token budget (default **8000**). |
| `--mode <…>` | `ask` / `context` | `auto`, `code`, `docs`, `data`, `tests`, `all` (default `all`). |
| `--depth <n>` | `impact` / `changes` | Max impact depth (default **6**). |
| `--base <ref>` | `changes` | Compare a branch against a base ref. |
| `--agent <sel>` | `setup` | `auto`, `all`, `claude`, `codex`, `cursor`, `copilot`, `gemini`, `aider`, `generic`, `local`. |
| `--port <n>` / `--no-open` | `map` | Studio port (default **4173**) / don't open a browser. |

Run `pnpm kawn help` for the full command list (beginner aliases plus the
advanced names like `init`, `scan`, `query`, `affected`, `diff`, `pr-impact`).

---

## What next

- **[docs/AGENT_INTEGRATION.md](AGENT_INTEGRATION.md)** — the MCP setup contract,
  what each tool does, and how to reverse it.
- **[docs/CONTEXT_PACKS.md](CONTEXT_PACKS.md)** — ranking, budgets, and the UCP
  wire format.
- **[docs/GRAPH_MODEL.md](GRAPH_MODEL.md)** — nodes, edges, layers, evidence, and
  stable IDs.
- **[docs/SCANNERS.md](SCANNERS.md)** — what each language plugin extracts.
- **[docs/BENCHMARKS.md](BENCHMARKS.md)** — methodology and honest, task-dependent
  results.
- **[docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md)** · **[docs/FAQ.md](FAQ.md)** —
  if something goes sideways.

Back to the **[README](../README.md)** for the project overview.
