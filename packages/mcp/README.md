# @athar/mcp — _placeholder (Phase 5)_

This package will expose Athar's graph to coding agents over the **Model Context
Protocol (MCP)** so tools like Claude Code, Cursor, and Codex can request a
**context pack** instead of crawling the whole repo.

**Status:** not implemented yet. See [`PROJECT_PLAN.md`](../../PROJECT_PLAN.md) for the roadmap.

### Design constraints (carried from the project principles)

- **Read-only.** The MCP server reads `.athar/graph.json`; it never builds the
  graph itself and never writes to the repo.
- **No network, no LLM, no telemetry** by default.
- Every served edge keeps its **evidence** so the agent can verify a claim.
