# @kawngraph/mcp

Exposes KawnGraph's Agent Context Graph to coding agents over the **Model Context
Protocol (MCP)** so tools like Claude Code can request a **Context Pack** instead
of crawling the whole repo.

A tiny, **zero-dependency** stdio server: newline-delimited JSON-RPC 2.0, no MCP SDK.

## Tools

| Tool | Purpose |
|------|---------|
| `kawn_context` | Token-budgeted Context Pack for a task (must-read code, docs, tables, risks). |
| `kawn_query` | Ranked, mode-scoped (`code\|docs\|all`) search over the graph. |
| `kawn_affected` | Reverse impact: what depends on a symbol, and which files to re-check. |
| `kawn_changes` | Impact of the current change set (uncommitted, or a branch vs a base ref): changed nodes → dependents → files to re-check, plus related docs/tables/tests + risks. **Local git only — no network, no GitHub API.** |

## Run

```bash
node packages/mcp/dist/index.js --root <repo>   # or set KAWN_ROOT
```

The easiest way to register it with an agent is **`kawn setup`**, which writes
the project-scoped config for Claude Code / Codex / Cursor for you (reversible,
backed up, verified). See [docs/AGENT_INTEGRATION.md](../../docs/AGENT_INTEGRATION.md).

To register it by hand (project-scoped example, this repo's `.mcp.json`):

```json
{ "mcpServers": { "kawn": { "command": "node", "args": ["packages/mcp/dist/index.js", "--root", "."] } } }
```

The graph must exist first — build it with `kawn scan <repo>`.

## Agent-facing behavior

- **Server instructions.** `initialize` advertises a short (<2 KB) instruction
  block telling the agent to call `kawn_context` *first*, use `kawn_query` /
  `kawn_affected` for lookups and impact, `kawn_changes` to review a diff/branch,
  and that the server is read-only — if
  a result is stale, ask the user to run `kawn update`. Each tool description is
  sharpened and states it is read-only. This shifts in-session behavior **without
  editing `CLAUDE.md` / `AGENTS.md`**.
- **Freshness — warn on lag, refuse on distrust (read-only).** Before serving,
  the server checks the graph's freshness:
  - **`stale`** (git HEAD moved) → prepends a prominent ⚠ + `kawn update` banner
    but **still serves** the pack; **`possibly-stale`** → a soft note. Read-only
    never blocks on mere staleness, and never rebuilds.
  - **`incompatible`** (graph schema ≠ this build's) or **`malformed`** (bytes it
    cannot parse) → the server **refuses to serve**: every tool returns a
    structured error (`isError` + a machine-readable `structuredContent`) pointing
    to `kawn update`. It never returns results from a graph it cannot trust.
  - **`missing`** → an error pointing to `kawn scan` (no banner).

## Design constraints (carried from the project principles)

- **Read-only.** The server reads `.kawn/graph.json`; it never builds the graph
  itself and never writes to the repo. Building is the CLI's job (`kawn scan`).
- **No network, no LLM, no telemetry.** stdout carries protocol messages only; logs go to stderr.
- Every served edge keeps its **evidence** so the agent can verify a claim.
