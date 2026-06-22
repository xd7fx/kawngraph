# Privacy & Security Model

> **One sentence:** KawnGraph reads your repository, writes a graph under `.kawn/`,
> and serves it back to your tools — **locally, with no network by default, no
> telemetry, and no internal LLM.** Nothing leaves your machine unless you
> explicitly opt in.

This document is the precise, per-layer account of **what is read, what is
written, and what never leaves the machine**. For reporting a security
vulnerability, see **[SECURITY.md](../SECURITY.md)**.

---

## The one boundary that defines everything

KawnGraph has four surfaces, and only **one** of them ever writes the graph or
edits a file. Keeping them separate is what makes the guarantees verifiable.

| Surface | Reads | Writes | Network |
| ------- | ----- | ------ | ------- |
| **Engine** (CLI: `kawn scan` / `kawn update`) | your repo files (bounded by size) + local git, read-only | `.kawn/` only | none by default |
| **MCP server** (`kawn`) | `.kawn/graph.json` + local git (read-only, for `kawn changes`) | **never** | none — stdio JSON-RPC only |
| **Agent Setup** (`kawn setup` / `connect` / `disconnect`) | existing agent config | one agent config file it owns (+ a backup) | none |
| **Studio** (`kawn map`) | `.kawn/graph.json` | **never** | local HTTP only (default `http://localhost:4173`) |

**Building the graph is always an explicit CLI step.** The MCP server and Studio
only ever *read* it. Nothing rebuilds the graph during an agent session, and
nothing in the read path ever writes.

---

## Data boundaries per layer

KawnGraph models five live layers: **code, data, config, docs, test.** (`visual`
is planned; `decision`/`runtime` are future.) The boundary is identical for every
layer — the table below states it concretely so there is no ambiguity about what
each scanner touches.

| Layer | What is **read** (input) | What is **written to `.kawn/`** (output) | What **never leaves the machine** |
| ----- | ------------------------ | ---------------------------------------- | --------------------------------- |
| **code** | TypeScript/JavaScript and Python source: files, top-level functions/classes, imports, calls, framework routes, tests. Methods/nested functions ride on their class/file as metadata; ambient declarations (`.d.ts`, `.pyi`) are never claimed. | Node IDs, edges, and **evidence** (source path + line range + a short snippet) for matched symbols. | Your full source. Only the structural facts and the cited snippet range are stored — never a copy of each file. |
| **data** | SQL files: tables, columns, foreign keys. | Table/column nodes and FK edges, with evidence. | The SQL beyond the cited snippet; **no database is ever connected to** — only SQL *text on disk* is parsed. |
| **config** | `package.json`: workspace packages and internal dependencies. | Package nodes and internal-dependency edges. | Anything outside the declared package/dependency structure. |
| **docs** | Markdown: headings/sections, linked to code, SQL, and routes. | Section nodes and doc→code/SQL/route edges, with evidence. | Prose beyond the cited snippet. |
| **test** | Test files (in TS/JS and Python). | Test nodes and edges to the code under test. | Source beyond the cited snippet. |

**Across every layer:**

- Reads are **bounded** — files above a size limit are skipped, and a per-file
  parse failure is isolated (it never aborts the scan or leaks a partial read
  elsewhere).
- The only directory KawnGraph writes during a scan is **`.kawn/`** (see below).
- Scanners are **deterministic and structural** — they parse syntax, they do not
  send your code anywhere and do not call a model. (Python uses `@lezer/python`, a
  pure-JS, error-tolerant parser — not a network service.)

---

## What lives in `.kawn/`

A scan/update writes only into `.kawn/` (which is git-ignored by default):

| File / dir | Written by | Contents |
| ---------- | ---------- | -------- |
| `.kawn/graph.json` | `kawn scan` / `update` | The layered graph: nodes (stable, content-addressable IDs), edges with evidence + confidence (`extracted` / `linked` / `semantic` / `manual`). |
| `.kawn/report.md` | `kawn scan` / `update` | A human-readable summary of the scan. |
| `.kawn/manifest.json` | `kawn scan` / `update` | Scan metadata used for freshness (e.g. the git HEAD scanned). |
| `.kawn/integrations.json` | `kawn setup` / `connect` | Manifest of connected agents: files touched, keys/tables owned, backups captured, launch command. |
| `.kawn/backups/<timestamp>__<path>` | Agent Setup | A timestamped copy of any agent config file *before* KawnGraph modifies it. |

All of this is **local**. Removing the directory simply discards the graph
(regenerate with `kawn scan`).

---

## No network by default

- During **scan** and **retrieval**, KawnGraph makes **no network calls**. It reads
  your repo and the local git database; it writes JSON under `.kawn/`. Nothing is
  uploaded.
- The **MCP server** is stdio JSON-RPC with **zero dependencies** — it speaks to
  the agent over stdin/stdout, not over a socket.
- **Studio** serves the graph over **local HTTP only** (default
  `http://localhost:4173`), for inspection in your own browser.

There is no API key requirement and no outbound endpoint in the default path.

---

## No internal LLM (enrichment is opt-in, local-first)

- Code, docs, and SQL are parsed **structurally**. The default graph is built
  **without any model**.
- AI/semantic **enrichment is opt-in and local-first** — it is not part of a
  default scan. Semantic edges carry the `semantic` confidence label so anything
  inferred (rather than extracted from syntax) is always distinguishable from
  ground truth.
- KawnGraph ships **no internal LLM** and contacts no model provider on your
  behalf in the default configuration.

---

## No telemetry. Query logging off by default.

- **No telemetry.** KawnGraph collects no usage analytics and phones nothing home.
- **No query logging by default.** Retrieval queries (`kawn ask`, `kawn query`,
  and the MCP tools) are **not recorded** by default — there is no query log
  written unless you explicitly turn one on.

---

## MCP is strictly read-only — and refuses untrusted graphs

The MCP server (`kawn`) exposes four tools — `kawn_context`, `kawn_query`,
`kawn_affected`, `kawn_changes` — and is **read-only**:

- It **never scans, rebuilds, or writes.** It reads `.kawn/graph.json` (and, only
  for `kawn_changes`, the local git database read-only).
- **Staleness is warned, never silently trusted, never blocked.** If the graph
  lags the working tree (`stale` / `possibly-stale`), the server prepends a note
  and **still serves** the pack, pointing you to `kawn update`. Read-only
  retrieval never blocks on mere lag.
- **Distrust is refused outright.** If the graph schema is `incompatible` with the
  running build, or the bytes are `malformed`, **every tool returns a structured
  error instead of serving** — so an agent never acts on a graph it cannot trust.
- It **never rebuilds the graph** to "fix" any of this; the remedy is always an
  explicit CLI step (`kawn update` / `kawn scan`).

---

## Integrations are reversible, project-scoped, atomic — and never touch your prose or globals

`kawn setup` / `connect` install a project-scoped MCP integration for the agents
it detects (Claude Code → `.mcp.json`; Cursor → `.cursor/mcp.json`; Codex →
`.codex/config.toml`). Every change is reversible by design:

- **Atomic writes.** Config is written to a temp sibling, fsync'd, then renamed
  over the target — a reader never sees a half-written file.
- **Backups.** Any file about to be modified is first copied to
  `.kawn/backups/<timestamp>__<path>`.
- **Structured editors, never string-bashing.** JSON via a JSON parser/writer;
  TOML via a table-aware editor that preserves comments and unrelated tables. A
  malformed existing config is treated as a **blocker**, not overwritten.
- **Ownership.** KawnGraph only ever replaces an entry named `kawn` that it created
  (recorded in `.kawn/integrations.json`) — or one you explicitly allow with
  `--force`. A foreign `kawn` entry blocks rather than being clobbered.
- **Never edits your prose files.** KawnGraph **never** modifies `CLAUDE.md` or
  `AGENTS.md`. The behavior change rides entirely on the MCP server's own
  advertised metadata.
- **Never global by default.** `--scope user` (global config) is **intentionally
  refused** by this release — KawnGraph never touches global agent configuration.
- **Clean round-trip.** `kawn disconnect` removes **only** KawnGraph's key/table
  (and any file/dir it created that is now empty), leaving everything else intact.

Preview the exact changes without writing anything:

```bash
kawn setup --dry-run     # print the plan + full-file previews, write nothing
```

Full integration contract: **[docs/AGENT_INTEGRATION.md](AGENT_INTEGRATION.md)**.

---

## Reporting a vulnerability

Please report security issues **privately**, not in a public issue. See
**[SECURITY.md](../SECURITY.md)** for the disclosure process.

---

## Related

- [README.md](../README.md) — project overview (see the *Privacy & security*
  section).
- [docs/AGENT_INTEGRATION.md](AGENT_INTEGRATION.md) — the reversible-integration
  contract and freshness model.
- [ARCHITECTURE.md](../ARCHITECTURE.md) — the data model, evidence, and confidence
  levels.
