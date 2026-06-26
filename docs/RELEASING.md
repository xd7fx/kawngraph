# Releasing KawnGraph

This is the **Release Candidate** runbook: how to take the verified monorepo to a
public `npm` + GitHub release. Nothing here publishes anything by itself — every
irreversible step is an explicit command you run.

> **Current state:** packaging is publish-ready and proven by a dry run (see
> Phase 1). The two remaining human gates are **live adapter QA** (Phase 2) and
> **the actual publish/tag/release** (Phase 3).

---

## One-command gate

```bash
pnpm release:check    # build → test → pack:check → publish --dry-run (publishes nothing)
```

Green means: every package compiles, all tests pass, the **whole tarball closure
installs into a throwaway consumer and the installed CLI + MCP server work**, and
a recursive `publish --dry-run` is clean. Run this before every release.

---

## Phase 1 — Packaging (done)

- **Shape:** one monorepo, **multiple published packages** — the `kawngraph` CLI
  plus its `@kawngraph/*` dependency closure (`shared`, `scanner-sdk`, `scanners`,
  `core`, `context-protocol`, `mcp`, `agents`, `studio-server`, `benchmark`).
  `npx kawngraph` pulls the CLI and resolves that closure from the registry.
- **`workspace:*` is resolved automatically** by pnpm at publish time — verified:
  a packed `@kawngraph/agents` tarball carries `@kawngraph/core: "0.1.0"` etc., not
  `workspace:*`.
- Every publishable package: `private` removed, `publishConfig.access: "public"`,
  `repository` / `homepage` / `bugs` / `license: MIT` set. Each tarball ships only
  `dist/` + `LICENSE` + `package.json`. The **root** stays `private` (never published).

Nothing to do here unless a new package is added (give it the same metadata).

---

## Phase 2 — Live adapter QA

Unit tests prove the **config we write** is correct and the MCP handshake works.
This phase proves each real tool **loads** that config and the agent actually pulls
a Context Pack. Run each in a throwaway clone, from a graph you built once:

```bash
kawn scan .            # build .kawn/graph.json once
```

Every `setup` is reversible — undo with the listed `disconnect`/file delete and
re-check `git status`.

| Tool | Setup | Writes | Verify it's live | Undo |
| --- | --- | --- | --- | --- |
| **Claude Code** | `kawn setup claude` | `.mcp.json` | open the repo in Claude Code → it loads the `kawn` MCP server → give a task → confirm it calls `kawn_context` | `kawn disconnect claude` |
| **Codex** | `kawn setup codex` | `.codex/config.toml` `[mcp_servers.kawn]` | run `codex` in the repo → ask a task → confirm the `kawn` tools appear/are used | `kawn disconnect codex` |
| **Cursor** | `kawn setup cursor` | `.cursor/mcp.json` | Cursor → Settings → MCP → `kawn` shows green → ask a task in chat | `kawn disconnect cursor` |
| **Copilot (VS Code)** | `kawn setup copilot` | `.vscode/mcp.json` | VS Code → Copilot **Agent** mode → Tools → enable `kawn` → ask a task | `kawn disconnect copilot` |
| **Gemini CLI** | `kawn setup gemini` | `.gemini/settings.json` (`mcpServers`) | run `gemini` → `/mcp` lists `kawn` → ask a task | `kawn disconnect gemini` |
| **Aider** | `kawn setup aider` | `.kawn/agent-context/kawn-context.md` | add `read: .kawn/agent-context/kawn-context.md` to `.aider.conf.yml`, start `aider`, confirm the file is in context | delete the file / `.aider.conf.yml` line |

> Use `kawn setup --dry-run` first to preview the exact file diff, and
> `kawn agents status` to see who is connected.

**Record results** in a short table (tool · version · worked? · note) and paste
the genuinely-working set into the README "Connect it to your agent" section.
Anything that needs a manual step (e.g. Aider's `read:` line, Copilot's agent-mode
toggle) is a **note**, not a failure.

---

## Phase 3 — Release

### Prerequisites (one-time)

- `npm login` with the account that owns (or will create) the **`@kawngraph`** scope.
- Confirm the unscoped name is free: `npm view kawngraph` should 404.
- If 2FA is on, have an OTP ready (`pnpm -r publish --otp=<code>`), or use a
  granular automation token.
- `brand/dist/social-card.png` rendered (`node brand/render.mjs`) — upload it under
  GitHub → Settings → General → **Social preview**.

### Publish

```bash
pnpm release:check                 # must be green
pnpm release:publish               # = pnpm -r publish --access public --no-git-checks
#                                   publishes the closure in dependency order
```

Smoke-test the real thing from a clean directory:

```bash
cd $(mktemp -d) && npx kawngraph@latest setup --dry-run
```

### Post-publish

1. **README:** remove the "not published / `npx` unavailable" caveat in
   `README.md` **and** `README.ar.md`, then re-stamp translations:
   `node scripts/check-readme-translations.mjs --write`.
2. **MCP launch:** switch the written config from the local-node command to the
   portable `npx @kawngraph/mcp` launch (`publishedNpxLaunch` in
   `packages/agents/src/launch.ts`).
3. **Tag + GitHub release:**
   ```bash
   git tag -a v0.1.0 -m "KawnGraph v0.1.0"
   git push origin v0.1.0
   gh release create v0.1.0 --title "KawnGraph v0.1.0" --notes-file CHANGELOG.md
   ```
4. Move the `CHANGELOG.md` `[Unreleased]` section under a dated `## [0.1.0]` heading.

### Rollback

`npm deprecate '@kawngraph/*@0.1.0' "…"` / `npm unpublish` is only possible within
72h and is disruptive — prefer publishing a `0.1.1` patch over unpublishing.
