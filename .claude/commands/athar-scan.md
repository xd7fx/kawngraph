---
description: Scan (or re-scan) the repo and rebuild the Athar Agent Context Graph
argument-hint: "[path] (default: .)"
allowed-tools: Bash(node packages/cli/dist/index.js:*)
---

Rebuild the Athar graph so `/athar-context`, `/athar-query`, and the MCP tools serve fresh data.

!`node packages/cli/dist/index.js scan $ARGUMENTS`

Summarize the node/edge counts and the per-layer breakdown above. If the scan failed, surface the error and suggest a fix (e.g. run `pnpm build` first if the CLI isn't built).
