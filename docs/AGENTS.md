# Agents — one project map, every coding agent

KawnGraph is **not tied to one AI coding tool.** It builds one evidence-backed
project graph, then serves the *same* Context Pack to every agent through a small
**adapter** per tool — never bespoke logic per tool.

```text
KawnGraph Core  →  Context Pack  →  Adapters  →  Claude · Codex · Cursor · Copilot · Gemini · Aider · Local LLM · any tool
```

Tools that speak **MCP** get the read-only KawnGraph server registered in their own
config. Tools that don't get a **context file** they read, or a **Markdown / JSON
export** of the same pack (`kawn pack`). Nothing here requires an LLM, the cloud,
API keys, or telemetry; every integration is project-scoped, backed up, and
reversible.

See the live matrix any time with **`kawn agents`** (`--json` for machine use).

## Matrix

| Agent | How | Install | Config file (KawnGraph owns) | Verify | Uninstall |
| --- | --- | --- | --- | --- | --- |
| **Claude Code** | MCP | `kawn setup claude` | `.mcp.json` → `mcpServers.kawn` | `kawn agents status` / `kawn check` | `kawn agents uninstall claude` |
| **Codex** | MCP | `kawn setup codex` | `.codex/config.toml` → `[mcp_servers.kawn]` | `kawn check` | `kawn agents uninstall codex` |
| **Cursor** | MCP | `kawn setup cursor` | `.cursor/mcp.json` → `mcpServers.kawn` | `kawn check` | `kawn agents uninstall cursor` |
| **GitHub Copilot** (VS Code) | MCP | `kawn setup copilot` | `.vscode/mcp.json` → `servers.kawn` | reload VS Code · `kawn agents status` | `kawn agents uninstall copilot` |
| **Gemini CLI** | MCP | `kawn setup gemini` | `.gemini/settings.json` → `mcpServers.kawn` | `gemini mcp list` · `kawn agents status` | `kawn agents uninstall gemini` |
| **Aider** | context file | `kawn setup aider` | `.kawn/agent-context/kawn-context.md` | `aider --read …` | `kawn agents uninstall aider` |
| **Generic / any tool** | export | `kawn setup generic` | `.kawn/agent-context/USING-KAWN.md` | `kawn pack "…" --format markdown` | `kawn agents uninstall generic` |
| **Local LLMs** (Ollama / LM Studio) | local-llm (optional) | `kawn setup local --provider ollama` | `.kawn/local-llm.json` | `kawn ask "…" --local` | `kawn agents uninstall local` |

`kawn setup` (no agent) auto-detects which of the MCP/context-file tools are used
here and wires them; `kawn setup all` wires all of them. `generic` and `local` are
**opt-in** — you name them explicitly.

---

## MCP tools — Claude Code, Codex, Cursor, Copilot, Gemini CLI

These register the **read-only** KawnGraph MCP server (tools `kawn_context`,
`kawn_query`, `kawn_affected`, `kawn_changes`). KawnGraph edits **only its own
entry** in the agent's project config — atomic write, timestamped backup,
structured edit (never string replacement), and clean removal. It never touches
`CLAUDE.md` / `AGENTS.md` or global/user config.

- **Claude Code** — `.mcp.json`, `mcpServers.kawn`, stdio `{type, command, args}`.
  Verified 2026-06-19 · <https://code.claude.com/docs/en/mcp.md>.
- **Codex** — `.codex/config.toml`, `[mcp_servers.kawn]`. Loads project servers
  only for *trusted* projects. Verified 2026-06-19 · <https://developers.openai.com/codex/mcp>.
- **Cursor** — `.cursor/mcp.json`, `mcpServers.kawn`, `{command, args}` (no `type`).
  Verified 2026-06-19 · <https://cursor.com/docs/context/mcp>.
- **GitHub Copilot (VS Code Agent Mode)** — `.vscode/mcp.json`, top-level key
  **`servers`** (not `mcpServers`), stdio `{type, command, args}`. Commit it to
  share with the team (VS Code ≥ 1.99). Verified 2026-06-24 ·
  <https://code.visualstudio.com/docs/agents/reference/mcp-configuration>.
- **Gemini CLI** — `.gemini/settings.json`, `mcpServers.kawn`, `{command, args}`.
  Verified 2026-06-24 · <https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md>.

> A published install writes a portable `npx -y @kawngraph/mcp` launch (it needs
> nothing on PATH). Only a monorepo checkout points at a locally-built server, which
> `kawn setup` flags as machine-specific.

## Aider — context file

Aider can act as an MCP client via `.aider.conf.yml`, but that config is YAML and
KawnGraph keeps a parser-free, zero-dependency promise — so rather than risk
mutating your YAML, it writes a context file Aider reads:

```bash
kawn setup aider
aider --read .kawn/agent-context/kawn-context.md
# or persist in .aider.conf.yml:  read: [.kawn/agent-context/kawn-context.md]
```

The file is a project map plus the `kawn pack` workflow; refresh it with
`kawn update && kawn setup aider`. Verified 2026-06-24 · <https://aider.chat/docs/>.

## Generic / any tool — Markdown & JSON export

For any tool (or just a chat box), export the same Context Pack on demand:

```bash
kawn pack "fix the OAuth callback" --format markdown   # ready-to-paste prompt
kawn pack "fix the OAuth callback" --format json       # programmatic tools
kawn pack "fix the OAuth callback" --format markdown --out context.md
```

`kawn setup generic` writes a short `USING-KAWN.md` describing this workflow.

## Local LLMs — Ollama / LM Studio (optional, never required)

KawnGraph **works fully without any LLM.** A local model can *optionally* condense
a pack — it is never used for scanning or required retrieval, and there is no
cloud, no API key, no telemetry.

```bash
kawn setup local --provider ollama      # records http://localhost:11434/v1
kawn setup local --provider lmstudio    # records http://localhost:1234/v1
kawn setup local --provider ollama --base-url http://localhost:11434/v1 --model llama3.1

kawn pack "fix auth" --format markdown --local      # condense via the local model
kawn ask  "fix auth" --local
```

This writes `.kawn/local-llm.json` (an OpenAI-compatible endpoint). `--local` calls
that endpoint; on **any** failure (no server, no model, timeout, bad response) it
silently falls back to the deterministic pack. Endpoints verified 2026-06-24 ·
Ollama <https://docs.ollama.com/api/openai-compatibility> · LM Studio
<https://lmstudio.ai/docs/developer/openai-compat>.

---

## Adding a new agent

Adapters implement one interface (`packages/agents/src/types.ts`):
`id`, `displayName`, `kind`, `supports` (mcp / slashCommands / contextFiles /
promptExport), `autoSelectable`, `configFormat`, and `detect / plan / install /
verify / uninstall`. MCP tools reuse `mcpJsonFile` (parameterized by the
server-map key) or the TOML helper; context-file / export / local adapters reuse
`makeOwnedFileAdapter`. Register it in `packages/agents/src/registry.ts` and add a
row here. Record the config format's **source URL and verification date** in code,
as every existing adapter does.
