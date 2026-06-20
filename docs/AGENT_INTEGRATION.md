# Athar — Agent Session Integration

> One command connects a project to your coding agents, so the agent retrieves a
> small, evidence-backed **Context Pack** instead of crawling the whole tree.

This document is the contract for how Athar wires itself into agent sessions:
the commands, the exact files each adapter manages (with the verified config
format and the date it was checked), what changes inside a session, the
freshness model, and the safety guarantees that keep every change reversible.

---

## The four surfaces

Athar is one product with four distinct surfaces. Keeping them separate is what
makes the safety guarantees legible.

| Surface | Package | What it does | Writes? |
| ------- | ------- | ------------ | ------- |
| **Engine** | `@athar/core` + `@athar/scanners` | Scans the repo, builds `.athar/graph.json`, ranks context, computes impact/flow. The only part that ever *builds* the graph. | Writes `.athar/` (graph, report) — only via the CLI. |
| **MCP** | `@athar/mcp` | A zero-dependency stdio JSON-RPC server that serves the graph to agents (`athar_context`, `athar_query`, `athar_affected`). **Strictly read-only.** | Never. Reads `.athar/graph.json`. |
| **Agent Setup** | `@athar/agents` | Detects agents and installs/removes reversible, project-scoped MCP integrations. The only part that edits agent config files. | Only the agent config file it owns (+ a backup), never source, never `CLAUDE.md`/`AGENTS.md`. |
| **Studio** | `@athar/studio-server` + `apps/studio` | A local, read-only graph explorer for humans. **Optional** — agents use MCP directly; Studio is for inspection. | Never. |

The boundary that matters most: **building the graph is always an explicit CLI
step** (`athar scan` / `athar update`). The MCP server and Studio only ever read
it. Nothing rebuilds the graph during an agent session.

---

## One-command setup

```bash
# scan if needed, detect agents, install integrations, verify retrieval works
athar setup

# non-interactive (required in CI), every supported agent
athar setup --agent all --yes

# preview the exact file changes, write nothing
athar setup --dry-run
```

`athar setup [path]` runs this sequence:

1. **Ensure a graph exists.** If `.athar/graph.json` is missing it offers to
   `scan` (asked once; skipped with `--yes`; on a non-TTY it never hangs and
   proceeds without scanning, warning that agents get no context until you run
   `athar scan`). If the graph exists but is stale, it says so and continues.
2. **Plan (no writes).** Each selected adapter produces a whole-file preview of
   what it would write, the key/table it owns, and any notes or blockers.
3. **Confirm.** Skipped with `--yes`. On a non-TTY without `--yes` it declines
   rather than blocking, so CI is deterministic.
4. **Install + verify.** Writes atomically (backing up any existing file first),
   then launches the real MCP server and runs a live `initialize` + `tools/list`
   handshake — plus an `athar_context` retrieval smoke test when a graph exists.

`athar connect <agent> [path]` is the same flow scoped to a single agent.

### Flags

| Flag | Effect |
| ---- | ------ |
| `--agent auto\|all\|claude\|codex\|cursor` | Selection. `auto` (default) picks the agents detected in the project; `all` targets every supported agent. |
| `--scope project\|user` | `project` (default) writes repo-local config the team shares. `user` (global) is **intentionally refused** by this release — Athar never touches global config. |
| `--yes` | Assume yes — fully non-interactive. Required in CI. |
| `--force` | Replace a pre-existing **non-Athar** entry of the same name (otherwise that's a blocker). |
| `--dry-run` | Print the plan and exact file previews; write nothing. |
| `--json` | Emit a stable machine-readable result (plan or report) on stdout. |

---

## Supported agents and the exact files they manage

Each adapter owns **one key or table in one file**. It never edits the agent's
prose instruction files (`CLAUDE.md`, `AGENTS.md`) and never touches unrelated
configuration. Formats were verified against the official documentation on the
date shown; the source and date are also recorded in code and surfaced by
`athar agents`.

| Agent | File (project scope) | Athar owns | Entry shape | Verified format source | Verified |
| ----- | -------------------- | ---------- | ----------- | ---------------------- | -------- |
| **Claude Code** | `.mcp.json` (repo root) | `mcpServers.athar` | `{ "type": "stdio", "command", "args", "env" }` | <https://code.claude.com/docs/en/mcp.md> | 2026-06-19 |
| **Cursor** | `.cursor/mcp.json` | `mcpServers.athar` | `{ "command", "args", "env" }` (no `type`) | <https://cursor.com/docs/context/mcp> | 2026-06-19 |
| **Codex** | `.codex/config.toml` | `[mcp_servers.athar]` | TOML table: `command`, `args`, optional `env` | <https://developers.openai.com/codex/mcp> | 2026-06-19 |

`athar agents` prints this table for the current install, including the resolved
launch command and whether each agent is currently connected.

**Per-agent notes**

- **Claude Code** — committing `.mcp.json` shares the server with the team;
  Claude prompts each user once to approve a new project MCP server. Detection
  also treats `.claude/` or `CLAUDE.md` as "Claude is used here," but Athar
  writes only `.mcp.json`.
- **Cursor** — same JSON shape as Claude Desktop, minus the `type` field, under
  `.cursor/mcp.json`.
- **Codex** — only loads project MCP servers for **trusted** projects, and the
  closest config (root → cwd) wins; `setup` surfaces this as a note. Athar edits
  only its own `[mcp_servers.athar]` table as a text block, preserving comments
  and unrelated tables. An *inline* `mcp_servers.athar = {…}` definition is left
  untouched and reported as a blocker rather than rewritten.

---

## What changes inside an agent session

The goal is that the agent reaches for Athar **automatically**, without anyone
editing prose instruction files. Two mechanisms, both inside the MCP protocol:

1. **Server-level instructions.** On `initialize`, the server advertises a short
   (<2 KB) instruction block telling the agent to call `athar_context` *first*
   for a task, to use `athar_query`/`athar_affected` for lookups and impact, and
   that the server is read-only — if a result is stale, ask the user to run
   `athar update`.
2. **Sharpened tool descriptions.** Each tool's description states what it
   returns, when to use it, and that it is **read-only**. `athar_context` is
   explicitly the one to call FIRST.

Athar does **not** modify `CLAUDE.md`, `AGENTS.md`, global agent settings, or
install lifecycle hooks. The behavior change rides entirely on the MCP server's
own advertised metadata — which is exactly the channel MCP provides for it.

---

## Freshness model

The graph is a snapshot. Athar tracks whether it still matches the working tree
and routes the response by **who is asking**:

| Status | Meaning | What the CLI does | What MCP does |
| ------ | ------- | ----------------- | ------------- |
| `fresh` | git HEAD matches the scan + clean tree | silent | silent |
| `possibly-stale` | no git, no manifest, dirty tree, or hand-edited graph | shows an info note | prepends a soft note, **still serves** the pack |
| `stale` | git HEAD moved since the scan | suggests `athar update` | prepends a prominent ⚠ banner, **still serves** the pack |
| `incompatible` / `malformed` | graph schema ≠ this build / unreadable bytes | suggests `athar update` | **refuses to serve** — every tool returns a structured error (`isError` + `structuredContent`) pointing to `athar update` |
| `missing` | no `.athar/graph.json` | suggests `athar scan` | errors toward `athar scan` (no banner) |

Two hard rules: **MCP never rebuilds the graph**, and it **never serves results
it cannot trust.** Mere *lag* (`stale` / `possibly-stale`) is warned but served —
read-only never blocks on staleness. *Distrust* (`incompatible` / `malformed`) is
refused outright, so an agent never acts on a graph that no longer matches the
schema. Either way the fix is an explicit CLI step. A short cache avoids
re-shelling git on bursts of calls.

---

## Reversibility and safety

Every write is reversible, and `disconnect` is a clean round-trip.

- **Atomic writes.** Config is written to a temp sibling, fsync'd, then renamed
  over the target — a reader never sees a half-written file.
- **Backups.** Any file Athar is about to modify is copied to
  `.athar/backups/<timestamp>__<path>` first.
- **Structured editors, never string-bashing.** JSON files go through a JSON
  parser/writer; `.codex/config.toml` is edited with a table-aware TOML editor
  that preserves comments and unrelated tables. A malformed existing config is a
  **blocker**, not something Athar overwrites.
- **Ownership.** Athar only ever replaces an entry named `athar` that it created
  (recorded in the manifest) — or that you explicitly allow with `--force`. A
  foreign `athar` entry blocks until you pass `--force`.
- **Integration manifest.** `.athar/integrations.json` records each connected
  agent: the files touched, the keys/tables owned, the backups captured, and the
  exact launch command. `disconnect` uses it to remove **only** Athar's entry —
  and still works without it, by recognizing Athar-owned entries by name, so
  losing local state never strands you.
- **Clean removal.** `disconnect` deletes only Athar's key/table, preserving
  everything else. If Athar created the file and it's now empty, the file (and a
  self-created `.cursor/`/`.codex/` dir, if empty) is removed too.

```bash
athar disconnect codex          # remove only Athar's [mcp_servers.athar], keep the rest
athar status                    # graph freshness + which agents are connected
```

---

## Health check — `athar doctor`

A read-only audit. It never scans, never writes the graph, never edits config —
it only reports, with the one safe command that fixes each problem.

```bash
athar doctor            # human-readable, exits non-zero on any FAIL
athar doctor --json     # stable JSON for CI
athar doctor --skip-probe   # skip the live MCP handshake (faster)
```

Checks: Node runtime (≥18), graph presence + freshness, MCP server resolvable,
a live MCP handshake + retrieval smoke test, which agents are detected and
whether Athar is connected, and whether each manifest-recorded launch target
still resolves. Each check is `PASS` / `WARN` / `FAIL`.

**Exit code:** `0` when there are no failing checks, `1` otherwise. `WARN` does
not fail the command — so "no agent detected yet" or "not portable until
published" won't break CI, but a missing graph or a broken handshake will.

---

## Non-interactive / CI behavior

- `--yes` is required to make changes without a TTY; without it, on a non-TTY,
  prompts decline rather than hang.
- `--json` output is stable and machine-readable on `setup`, `connect`,
  `disconnect`, `doctor`, `status`, and `agents`.
- Commands are **idempotent**: re-running `setup` on an already-connected
  project reports "already connected — nothing to change" and writes nothing.
- `doctor` exits non-zero on failure, so it drops straight into a CI gate.

---

## Behavioral evaluation — does the agent actually reach for Athar?

Wiring the MCP server in is necessary but not sufficient. The real question is
behavioral: when you hand an agent a normal repository task, does it
**automatically** call `athar_context` first, and does that change the outcome?
`scripts/agent-eval.mjs` answers it with a **real agent session**, not a protocol
handshake or a simulated client.

```bash
pnpm agent:eval                       # real `claude` session, WITH vs WITHOUT Athar
pnpm agent:eval -- --agent both       # also probe for a Codex CLI
pnpm agent:eval -- --project <path> --task "<task>" --gold "a.ts,b.ts"
```

What it does, end to end:

1. Stages an **isolated copy** of the project (excluding `.athar/`, `node_modules`,
   `.git`, build output, and any existing agent config) and runs `athar scan` on it,
   so the only difference between the two runs is whether Athar is reachable.
2. Runs the actual `claude` CLI twice — once with an MCP config exposing the Athar
   server, once with an empty one — using `-p --output-format stream-json`, and
   **parses the agent's own tool-call stream**.
3. Reports, per condition: whether Athar was auto-invoked (and whether it was the
   *first* move), the ordered list of tools used, distinct files opened,
   precision/recall against a gold set of relevant files, wall-clock time, and
   token usage from the agent's own accounting.

**It is deliberately honest.** If the CLI is missing, unauthenticated, or returns
an API error, the harness **fails loudly** (non-zero exit) and reports the real
reason — it never fabricates metrics for a session that did not really run.

**Known environment limit.** Inside a managed Claude Code session the spawned
`claude` subprocess has no standalone credentials (`ANTHROPIC_API_KEY` is unset
and auth is host-managed), so both runs return **HTTP 401** and the harness exits
non-zero with that message and **no numbers** — by design. Run it in a terminal
where `claude` is logged in (or a real `ANTHROPIC_API_KEY` is exported) to get
actual comparison numbers. The Codex CLI is probed too, but the stream parser
currently targets Claude Code's `stream-json`; a Codex parser must be wired before
its numbers can be trusted, and the harness says so rather than guessing.

Because auto-invocation can only be *measured* in an authenticated terminal, any
further tuning of the server instructions or tool descriptions is gated on this
harness's output — not on guesswork.

---

## Portability caveat (honest status)

Until `@athar/mcp` is published to npm, `setup` writes a launch command that
points at the **locally resolved** server (e.g. `node …/packages/mcp/dist/
index.js`). That works on this machine but is not portable across machines, and
both `setup` and `doctor` say so (a `WARN`, not a failure). Publishing to npm —
which enables a portable `npx`-style command — is a separate, explicitly
approved step, not part of this integration work.

---

## Related

- [packages/mcp/README.md](../packages/mcp/README.md) — the MCP server itself.
- [ARCHITECTURE.md](../ARCHITECTURE.md) — data model, pipeline, and the
  `@athar/agents` design.
- [README.md](../README.md) — project overview and quick start.
