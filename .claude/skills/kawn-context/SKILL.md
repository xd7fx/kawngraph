---
name: kawn-context
description: Use BEFORE starting any non-trivial coding task in this repo to load a token-efficient KawnGraph Context Pack — the few files, docs, and tables that matter — instead of reading the whole tree. Triggers when the user asks to implement, fix, refactor, debug, or understand a feature and you are not already certain which files are involved.
---

# KawnGraph Context Pack

This repo ships **KawnGraph**, an Agent Context Graph. Before exploring the codebase
by hand, load a task-scoped map: read the few files that matter, not the repo.

## When to reach for this
- The user asks to fix / add / refactor / understand something and you don't already know the exact files.
- You're about to grep or open many files just to orient yourself.
- You're about to change shared code and need the blast radius.

## How to get the pack

**Prefer the MCP tools** if the `kawn` MCP server is connected (see `.mcp.json`):
- `kawn_context` — `task` = the user's task; optional `budget`, `mode` (code|docs|all).
- `kawn_query` — locate a specific symbol/table/route.
- `kawn_affected` — what depends on a symbol, before you change it.

**Otherwise use the CLI** from the repo root:
```
node packages/cli/dist/index.js context "<task>" --budget 8000
node packages/cli/dist/index.js query "<text>" --mode all
node packages/cli/dist/index.js affected <symbol>
```
If either reports `no .kawn/graph.json`, run `node packages/cli/dist/index.js scan .` once (or `/kawn-scan`), then retry.

## How to use the pack
1. **MUST READ** = your working set. Open those first (paths include line numbers).
2. **RELATED DOCS** = background; **TABLES** = the data contract.
3. **RISKS** (auth, tenant-isolation, data-write, referential-integrity, schema) — verify each before changing related code.
4. **EXCLUDED** tells you what was intentionally left out for budget — the boundary of scope.
5. Don't read files outside the pack unless the task forces it. If you discover the map is wrong, re-scan.

Keep the loop tight: **pack → read only what it lists → change → done.**
