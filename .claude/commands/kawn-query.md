---
description: Search the KawnGraph graph for nodes relevant to a phrase (ranked, mode-scoped)
argument-hint: "\"<text>\" [--mode code|docs|all] [--limit N]"
allowed-tools: Bash(node packages/cli/dist/index.js:*)
---

Locate where something lives without grepping the whole tree. Quote the text.

!`node packages/cli/dist/index.js query $ARGUMENTS`

Use the ranked hits above (path:line + reason) to decide which files to open. Higher score = stronger match. If you need the full reading list for a task rather than a point lookup, use `/kawn-context` instead.
