# KawnGraph — Troubleshooting

> Practical fixes for the problems you are most likely to hit. Every fix here is a
> real command. KawnGraph is **read-only at runtime** — building or refreshing the
> graph is always an explicit CLI step (`kawn scan` / `kawn update`), never
> something the MCP server or Studio does on its own.

KawnGraph is **not published to npm yet**, so run it from source. Throughout this
page, `kawn …` is shorthand for the from-source runner:

```bash
pnpm install && pnpm build      # once, after cloning (Node >= 18, pnpm)
pnpm kawn <command>             # e.g. pnpm kawn update
```

If you have wired up the CLI elsewhere you can use the bare `kawn` form. The
`npx kawngraph …` form only works **after npm publication**.

---

## The graph is reported stale

**Symptom.** An agent tool reply is prefixed with a banner such as
`[kawn] ⚠ STALE GRAPH: … ask the user to run kawn update`, or Studio / `kawn check`
notes the graph no longer matches the working tree.

**Why.** The graph in `.kawn/graph.json` is a snapshot. When git `HEAD` moves
since the last scan the status becomes `stale`; with no git / no manifest / a
dirty tree / a hand-edited graph it is `possibly-stale`. The MCP server **still
serves** the pack in both cases (read-only never blocks on mere lag) — it just
warns you.

**Fix.** Re-scan to refresh the snapshot:

```bash
pnpm kawn update            # re-scan after code changes (alias of scan)
```

`update` rewrites `.kawn/graph.json` + `.kawn/report.md`. A `possibly-stale`
note that mentions "no git" or "dirty tree" is expected on uncommitted work and
clears once you commit and/or re-`update`.

---

## The graph is incompatible or malformed (MCP refuses to serve)

**Symptom.** Every MCP tool returns a structured error (`isError`) labelled
`INCOMPATIBLE GRAPH` or `UNREADABLE GRAPH` instead of a Context Pack.

**Why.** Unlike staleness, KawnGraph never serves a graph it cannot **trust**.
`incompatible` means the graph schema differs from this build; `malformed` means
the bytes could not be parsed. The MCP server refuses outright rather than hand
an agent results from a graph that no longer matches the schema.

**Fix.** Rebuild the graph with the current CLI so its schema matches this build:

```bash
pnpm kawn scan             # full re-scan -> writes a fresh .kawn/graph.json
```

`scan` and `update` are equivalent here; either regenerates the graph. If it
still refuses afterward, confirm the CLI and MCP are from the **same build**
(re-run `pnpm build`).

---

## My coding agent is not auto-invoking KawnGraph

**Symptom.** The agent crawls the tree instead of calling `kawn_context` first.

**Checklist.**

1. **Is the project connected?** KawnGraph wires agents in via a project-scoped MCP
   integration, not by editing prose files. Verify and (re)install:

   ```bash
   pnpm kawn check            # graph freshness + which agents are connected
   pnpm kawn setup            # scan if needed, detect agents, install + verify retrieval
   ```

   `setup` finishes with a live `initialize` + `tools/list` handshake and a
   `kawn_context` smoke test, so a green finish means retrieval actually works.

2. **Did the agent pick up the new server?** Claude Code prompts each user once
   to approve a new project MCP server (in `.mcp.json`). Codex only loads project
   MCP servers for **trusted** projects. Approve / trust the project, then restart
   the agent session so it re-reads its MCP config.

3. **Expect behavior, not edits.** KawnGraph never modifies `CLAUDE.md`, `AGENTS.md`,
   or global settings. The nudge to "call `kawn_context` first" rides entirely on
   the MCP server's own advertised instructions and tool descriptions. If the
   agent still ignores it, that is a prompting/agent-behavior matter — the
   integration is correct as long as `kawn check` shows it connected.

See [AGENT_INTEGRATION.md](AGENT_INTEGRATION.md) for the exact files each agent
manages and the freshness model.

---

## Studio (the visual map) shows nothing / needs a UI build

**Symptom.** `kawn map` (alias of `kawn studio`) starts but the browser page is
empty, or the CLI prints:
`Studio frontend is not built — serving the API only. Build the UI with pnpm --filter @kawngraph/studio build.`

**Why.** Studio serves a prebuilt frontend from `apps/studio/dist`. If that
directory is missing, only the read-only API is served and there is no UI to render.

**Fix.** Build the UI, then launch:

```bash
pnpm studio:build          # builds apps/studio -> apps/studio/dist
pnpm kawn map              # open the read-only explorer
```

If the page loads but reports no data, you have **no graph yet** — the CLI also
prints `graph <status>: …` at startup. Build one first:

```bash
pnpm kawn scan
```

---

## The port is busy

**Symptom.** Studio cannot bind, or you want a specific port.

**Why.** Studio defaults to `127.0.0.1:4173` and automatically tries the next
ports (up to 10) on `EADDRINUSE`. Only if that whole range is taken does it fail:
`ports 4173–4182 are all in use. Free one or pass --port <n>.`

**Fix.** Pick a free port explicitly:

```bash
pnpm kawn map --port 5000
pnpm kawn map --port 5000 --no-open    # also skip auto-opening a browser
```

Studio is local-only and read-only; stop it with `Ctrl+C`.

---

## Windows: path and pnpm notes

- **Use `pnpm`, run from a built workspace.** After cloning, run
  `pnpm install && pnpm build` once. The from-source commands above
  (`pnpm kawn …`, `pnpm studio:build`) work the same on Windows.
- **Pass paths in quotes.** A repo path with spaces (common under
  `C:\Users\…\Desktop`) must be quoted:

  ```powershell
  pnpm kawn scan --root "C:\Users\you\My Project"
  ```

- **Forward or backslashes both work** for `--root`; the scanner normalizes path
  separators internally. Node `>= 18` is required (`pnpm kawn check` reports the
  detected runtime).
- **The data dir is `.kawn\`** in the project root (graph + report + backups).

---

## Python files are not parsed the way I expect

KawnGraph's Python scanner is deliberate about scope:

- **Top-level only.** It emits nodes for top-level functions and classes only.
  **Methods and nested functions are not separate nodes** — a method rides on its
  class as metadata (the same model as the TypeScript scanner). Imports, calls,
  and routes are resolved at module scope. So if you are looking for a method as
  its own node, that is expected behavior, not a miss.
- **`.pyi` stubs are ignored on purpose.** Stub files are ambient type
  declarations (the Python analogue of `.d.ts`) and are never claimed as source.
  Put the real definitions in `.py` files and re-scan:

  ```bash
  pnpm kawn update
  ```

The parser is pure-JS and error-tolerant (`@lezer/python`), so a syntactically
rough file degrades gracefully rather than aborting the whole scan.

---

## My SQL seems to be ignored

**SQL is never ignored by default** — there is no built-in rule that skips it.
The SQL scanner detects `*.sql` files and extracts `CREATE TABLE` definitions and
foreign-key `REFERENCES` relationships.

If a `.sql` file is missing from the graph, check, in order:

1. **A `.kawnignore` rule is catching it.** This optional file (newline-separated
   patterns, in the repo root) extends the defaults. A line matching your SQL
   path or its folder will exclude it. Remove or narrow that line.
2. **It lives under a default-skipped directory.** Scans skip `node_modules`,
   `.git`, `.kawn`, `.athar`, `dist`, `build`, `.next`, `out`, `coverage`,
   `.turbo`, `.cache`, `.vercel`, and `vendor` anywhere in the tree. A migration
   inside `dist/` or `vendor/`, for example, is skipped by design — move it or
   scan a path that includes it.
3. **The graph is just stale.** Re-scan after adding the file:

   ```bash
   pnpm kawn update
   ```

---

## `kawn setup` wrote nothing

This is often correct, but here is how to tell which case you are in:

- **Already connected.** `setup` is idempotent. On an already-wired project it
  prints `already connected — nothing to change` and writes nothing. Confirm with
  `pnpm kawn check`.
- **You ran a preview.** `--dry-run` prints the plan and the exact file previews
  but **writes nothing** by design:

  ```bash
  pnpm kawn setup --dry-run        # see exactly what would change
  ```

  Re-run without `--dry-run` to apply.
- **A non-TTY without `--yes`.** In CI / non-interactive shells, prompts
  **decline** rather than hang, so nothing is written. Pass `--yes`:

  ```bash
  pnpm kawn setup --agent all --yes
  ```

- **A blocker, not a write.** If an agent's config already has a **foreign** entry
  named `kawn`, or the config file is malformed, KawnGraph refuses to overwrite it
  and reports a blocker. Inspect the message; replace a known-safe foreign entry
  with `--force`, or fix the malformed file first.
- **Permissions.** If writes fail with `EACCES`/`EPERM`, the target config file or
  its directory is not writable — fix the file/dir permissions (or, on Windows,
  the read-only attribute) and re-run. Every real write is atomic and backs up any
  existing file to `.kawn/backups/<timestamp>__<path>` first, so retrying is safe.

Undo any integration cleanly with `pnpm kawn disconnect <claude|codex|cursor>`.

---

## Related

- [GETTING_STARTED.md](GETTING_STARTED.md) — install, scan, first Context Pack.
- [AGENT_INTEGRATION.md](AGENT_INTEGRATION.md) — how agents are wired in, the
  freshness model, and reversibility guarantees.
- [../README.md](../README.md) — project overview and quick start.
- [../ARCHITECTURE.md](../ARCHITECTURE.md) — data model, scanners, and pipeline.
