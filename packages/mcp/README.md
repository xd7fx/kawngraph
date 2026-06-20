# @athar/mcp

Exposes Athar's Agent Context Graph to coding agents over the **Model Context
Protocol (MCP)** so tools like Claude Code can request a **Context Pack** instead
of crawling the whole repo.

A tiny, **zero-dependency** stdio server: newline-delimited JSON-RPC 2.0, no MCP SDK.

## Tools

| Tool | Purpose |
|------|---------|
| `athar_context` | Token-budgeted Context Pack for a task (must-read code, docs, tables, risks). |
| `athar_query` | Ranked, mode-scoped (`code\|docs\|all`) search over the graph. |
| `athar_affected` | Reverse impact: what depends on a symbol, and which files to re-check. |

## Run

```bash
node packages/mcp/dist/index.js --root <repo>   # or set ATHAR_ROOT
```

Register it with an MCP client (project-scoped example in this repo's `.mcp.json`):

```json
{ "mcpServers": { "athar": { "command": "node", "args": ["packages/mcp/dist/index.js", "--root", "."] } } }
```

The graph must exist first — build it with `athar scan <repo>`.

## Design constraints (carried from the project principles)

- **Read-only.** The server reads `.athar/graph.json`; it never builds the graph
  itself and never writes to the repo. Building is the CLI's job (`athar scan`).
- **No network, no LLM, no telemetry.** stdout carries protocol messages only; logs go to stderr.
- Every served edge keeps its **evidence** so the agent can verify a claim.
