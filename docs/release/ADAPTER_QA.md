# Adapter QA

KawnGraph connects to coding agents through **adapters**. This document is the
release gate for those integrations. It has two parts:

1. **Automated coverage** — what the test suite already proves on every run.
2. **Manual live QA** — what a human must confirm against the *real* tool before
   relying on it. These cannot run in CI/headless and are **NOT** claimed as
   passing here; they are a checklist for the maintainer.

All eight adapters share two audited primitives — `mcpJsonFile` (JSON MCP configs)
and `makeOwnedFileAdapter` (KawnGraph-owned files) — so a guarantee proven for one
JSON/owned adapter holds for the others. Setup is always **reversible**, **atomic
with a backup**, **project-scoped**, and **never edits `CLAUDE.md` / `AGENTS.md`**.

---

## 1. Automated coverage (runs in `pnpm test` — 399 tests)

Proven by `tests/agentAdapters.test.ts` and `tests/agents.test.ts`:

| Guarantee | Test |
| --- | --- |
| All 8 adapters registered with stable ids + correct `supports.mcp` | `the adapter registry exposes 8 adapters …` |
| Claude writes `.mcp.json` `mcpServers.kawn` (stdio) | `claude install writes .mcp.json with a stdio mcpServers.kawn entry` |
| Cursor writes `.cursor/mcp.json` **without** a `type` field | `cursor install writes .cursor/mcp.json WITHOUT a type field` |
| Codex writes `.codex/config.toml` `[mcp_servers.kawn]` | `codex install writes .codex/config.toml with an [mcp_servers.kawn] table` |
| **Copilot** writes `.vscode/mcp.json` under top-level `servers` | `copilot writes .vscode/mcp.json under the top-level \`servers\` key` |
| **Gemini** writes `.gemini/settings.json` under `mcpServers`, no `type` | `gemini writes .gemini/settings.json under \`mcpServers\` with no type` |
| **Idempotency** — re-running setup changes nothing | `re-running setup is idempotent (plan unchanged, nothing rewritten)` |
| **Preserves** pre-existing servers + unrelated keys | `install preserves a pre-existing server and unrelated top-level keys` |
| **Backup** before edit | `disconnect backs up the file it edits before removing KawnGraph's entry` |
| **Uninstall leaves no trace** on a self-created file | `round-trip on a self-created file leaves no trace (file + empty dir removed)` |
| Keeps a non-empty agent dir with unrelated user files | `disconnect keeps a non-empty agent dir that holds unrelated user files` |
| **Ownership** — a foreign `kawn` entry blocks install unless `--force` | `a pre-existing foreign 'kawn' entry blocks install unless --force` |
| **Malformed** config is refused and left untouched | `a malformed JSON config is refused and left untouched` |
| Non-portable (machine-specific) launch is surfaced as a note | `a machine-specific (non-portable) launch is surfaced as a note` |
| Paths with spaces / non-ASCII | `setup works under a path with spaces and non-ASCII characters` |
| Legacy `athar` → `kawn` migration (replace, not duplicate) | `claude/cursor/codex setup migrates a legacy 'athar' entry to 'kawn'` |
| `doctor` PASS/FAIL health | `doctor reports node PASS and a FAIL when the graph is missing` |

`pack:check` additionally proves this end-to-end **from an installed npm tarball**:
`kawn setup --agent all` writes the Claude/Cursor/Codex configs, the installed
`@kawngraph/mcp` completes a real stdio `initialize` + `tools/list` handshake, and
`kawn disconnect codex` cleanly removes only KawnGraph's table.

**Local LLM fallback** (`tests/packCli.test.ts`): `kawn pack --local` with no model
configured, and with an unreachable endpoint, both fall back to the deterministic
pack and **never hang or fail** — Ollama/LM Studio are never required.

---

## 2. Manual live QA — maintainer checklist (NOT run here)

> Status legend: ☐ not yet run · ✅ verified on a real tool · ⚠️ works with a note.
> Run each in a throwaway clone after `kawn scan .`. Undo with the listed command
> and confirm `git status` is clean.

| Agent | Install | File + owned key | Verify it's live | Undo | Status |
| --- | --- | --- | --- | --- | --- |
| **Claude Code** | `kawn setup claude` | `.mcp.json` → `mcpServers.kawn` | open repo in Claude Code → MCP `kawn` loads → give a task → it calls `kawn_context` | `kawn disconnect claude` | ✅ live¹ |
| **Codex** | `kawn setup codex` | `.codex/config.toml` → `[mcp_servers.kawn]` | run `codex` → ask a task → `kawn` tools used | `kawn disconnect codex` | ✅ live² |
| **Cursor** | `kawn setup cursor` | `.cursor/mcp.json` → `mcpServers.kawn` | Cursor → Settings → MCP → `kawn` green → ask | `kawn disconnect cursor` | ☐ |
| **Copilot (VS Code)** | `kawn setup copilot` | `.vscode/mcp.json` → `servers.kawn` | VS Code → reload → Copilot **Agent** mode → Tools → enable `kawn` → ask | `kawn disconnect copilot` | ☐ |
| **Gemini CLI** | `kawn setup gemini` | `.gemini/settings.json` → `mcpServers.kawn` | `gemini` → `/mcp` (or `gemini mcp list`) shows `kawn` → ask | `kawn disconnect gemini` | ☐ |
| **Aider** | `kawn setup aider` | `.kawn/agent-context/kawn-context.md` | add `read: .kawn/agent-context/kawn-context.md` to `.aider.conf.yml` → start `aider` → file is in context | delete the file + the `read:` line | ☐ |
| **Generic** | `kawn setup generic` | `.kawn/agent-context/USING-KAWN.md` | paste the file into any assistant → it follows the KawnGraph instructions | delete the file | ☐ |
| **Local LLM** | `kawn setup local --provider ollama` (or `lmstudio`) | `.kawn/local-llm.json` | with the server running: `kawn pack "<task>" --local` condenses the pack; with it **off**: falls back, no error | delete `.kawn/local-llm.json` | ☐ |

### Live QA results — v0.1.0

The **MCP integration path was live-tested with Claude Code and Codex** (2026-06-27).
The other adapters are implemented and covered by config/unit tests, with live QA
pending on machines where those tools are installed.

- **¹ Claude Code — PASS.** In a live Claude Code session with the project's
  `.mcp.json` loaded, the `kawn` MCP server was connected and `kawn_context`
  ("explain the KawnGraph setup flow") returned a real Context Pack naming the
  correct files (`packages/cli/src/commands/setup.ts` · `packages/agents/src/setup.ts`
  · `packages/cli/src/index.ts`), confidence 0.7. Full chain verified: setup → config
  → server → tool call → useful retrieval.
- **² Codex — PASS.** `kawn setup codex` wrote `.codex/config.toml` `[mcp_servers.kawn]`;
  driving that **exact configured launch command** through a real JSON-RPC stdio
  exchange returned `serverInfo "kawn" v0.1.0`, advertised all four tools
  (`kawn_context`, `kawn_query`, `kawn_affected`, `kawn_changes`), and `kawn_context`
  returned the same correct setup files; `disconnect codex` cleaned up (clean tree).
  *Not* exercised: Codex's interactive chat UI / "trust project" prompt (manual step).
- **Cursor / Copilot / Gemini / Aider — config + unit tested, live QA not run here.**
  Same MCP/owned-file primitives as the two verified above; config shapes pinned by
  `tests/agentAdapters.test.ts`. Run the table above on a machine with each tool.
- **Generic** — deterministic export, covered by CLI/unit tests.
- **Local LLM** — graceful-fallback path tested (`tests/packCli.test.ts`); live run
  needs an actual Ollama/LM Studio server.

**Portability note (pre-publish):** until `@kawngraph/mcp` is published to npm, the
MCP launch written into configs is **machine-specific** (`node <abs path>` /
`kawn-mcp` on PATH) and setup says so. After publish, switch to the portable
`npx @kawngraph/mcp` launch (`publishedNpxLaunch` in `packages/agents/src/launch.ts`)
and re-run this checklist so teammates can use the committed configs as-is.

> Preview any install without writing: `kawn setup <agent> --dry-run`.
> See who is connected: `kawn agents status`. Full contract:
> [docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md).
