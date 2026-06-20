---
description: Build a token-budgeted Athar Context Pack for a task (the few files/docs/tables that matter)
argument-hint: "\"<task>\" [--budget N] [--mode code|docs|all]"
allowed-tools: Bash(node packages/cli/dist/index.js:*)
---

Build a task-scoped Context Pack instead of reading the whole repo. Quote the task.

!`node packages/cli/dist/index.js context $ARGUMENTS`

Now use the pack above as your reading list:
- Open the **MUST READ** files first — that's your working set.
- Treat **RELATED DOCS** as background and **TABLES** as the data contract.
- Honor every **RISK** (auth, tenant-isolation, data-write, schema) before changing anything.
- Don't read files outside the pack unless the task forces it.

If it reports `no .athar/graph.json`, run `/athar-scan` first.
