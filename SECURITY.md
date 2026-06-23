# Security Policy

Thanks for helping keep **KawnGraph** safe. KawnGraph is a **local-first** developer
tool: it scans the repository on your machine, writes a graph to a local `.kawn/`
directory, and can serve that graph read-only over a localhost web server (Studio)
and a read-only stdio MCP server. There is no hosted service and no telemetry — see
[docs/PRIVACY.md](docs/PRIVACY.md). That shapes the threat model below.

## Supported versions

KawnGraph is **pre-1.0 and under active development**. Only the latest `0.1.x`
line receives fixes; there are no backports to older snapshots.

| Version | Supported |
| --- | --- |
| `0.1.x` (latest, pre-release) | Yes — security fixes land here |
| anything older | No |

The project is **not yet published to npm** (the CLI package is `private`), so today
you run it from source (Node >= 18 + pnpm): `pnpm install && pnpm build`, then
`pnpm kawn <cmd>`. Until a published release exists, "supported" means the current
`main` / latest `0.1.x` source.

## Reporting a vulnerability — privately

**Please do not open a public GitHub issue, pull request, or discussion for a
suspected vulnerability.** Public reports expose other users before a fix is ready.

Report privately through **GitHub's private vulnerability reporting**:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability** (this opens a private GitHub Security Advisory
   draft, visible only to you and the maintainers).
3. Include enough to reproduce: affected version/commit, OS and Node version, the
   command(s) you ran, what you expected, what happened, and a minimal proof of
   concept if you have one.

This repository does not publish a security contact email — use GitHub's private
reporting flow above so the report stays confidential and tracked.

If GitHub private reporting is not available to you for some reason, please open a
**minimal, non-sensitive** issue that only requests a private channel — do **not**
include exploit details in it.

## Scope

KawnGraph runs locally and, by design, does **no network calls during scan or
retrieval**, ships **no internal LLM** in any default path (AI enrichment is opt-in
and local-first), and keeps the **MCP server read-only**. Reports that respect that
threat model are most useful.

### Threat model (what the tool actually does)

- **Reads your repository.** Scanners parse local source/docs/data files to build the
  graph. They isolate per-file failures and respect bounded file sizes.
- **Writes `.kawn/`.** The graph (`graph.json`) and report (`report.md`) are written
  into the project's local `.kawn/` directory.
- **Serves a localhost server.** `kawn map` / `kawn studio` runs a **local,
  read-only** Studio server (default port `4173`) that exposes the already-built graph.
- **Registers MCP integration files.** `kawn setup` writes reversible, project-scoped
  files (`.mcp.json`, `.cursor/mcp.json`, `.codex/config.toml`) with atomic writes,
  timestamped backups, and a `.kawn/integrations.json` manifest; reversible via
  `kawn disconnect`. It never edits `CLAUDE.md` / `AGENTS.md` and never touches global
  config by default.
- **Serves a read-only MCP server.** The `kawn` stdio MCP server only reads the graph;
  it never scans, rebuilds, writes, or edits code.

### In scope

- Code execution, path traversal, or writes **outside** the project root or `.kawn/`
  triggered by scanning, building, or serving the graph.
- A crafted repository file (source, config, `package.json`, SQL, Markdown) that causes
  the scanner to crash the whole run, hang, exhaust resources, or escape its bounds
  instead of isolating the failure.
- The localhost Studio server or `/api/*` endpoints performing any **write**, mutating
  the repo or graph, or exposing files outside the intended graph data.
- The MCP server performing any write/scan/rebuild, or serving an incompatible/malformed
  graph it should refuse.
- Agent setup writing outside its declared, reversible files, corrupting existing config,
  failing to back up, or being non-reversible by `kawn disconnect`.
- Any **unexpected network call, telemetry, or query logging** in a default code path
  (these are explicit non-features — see [docs/PRIVACY.md](docs/PRIVACY.md)).
- Secret/credential leakage introduced by KawnGraph beyond what already exists in your
  repository.

### Out of scope

- Secrets that **already live in your repository** appearing in the graph or report —
  KawnGraph reads what is on disk; manage repo secrets with your normal tooling.
- Risks from running KawnGraph on an **untrusted repository** that you would also incur
  by opening it in your editor or running its build (KawnGraph itself does not execute
  your project's code, but reading hostile input is inherently risky).
- Exposure caused by **you** binding the localhost Studio server to a public interface,
  reverse-proxying it, or sharing your `.kawn/` directory.
- Vulnerabilities in **third-party dependencies, agents (Claude Code / Codex / Cursor),
  Node.js, or your OS** — report those upstream (we will still update our pins).
- Missing hardening for the **planned/future** layers (`visual`, `decision`, `runtime`)
  that are not yet implemented.
- Social engineering, physical access, and denial of service against the host machine
  itself.

## Response expectations

This is a volunteer, **pre-1.0** project, so responses are **best-effort** rather than
SLA-backed. We aim to acknowledge a valid private report, work with you to confirm and
assess it, and fix accepted issues in the latest `0.1.x` line. Timelines depend on
severity and maintainer availability.

## Coordinated disclosure

Please give us a reasonable chance to fix and release before any public disclosure. We
prefer to publish a GitHub Security Advisory once a fix is available, and — with your
permission — to credit you. Please do not exploit an issue beyond what is needed to
demonstrate it, and avoid accessing or modifying data that is not yours.

---

See also: [README.md](README.md) · [CONTRIBUTING.md](CONTRIBUTING.md) ·
[docs/PRIVACY.md](docs/PRIVACY.md)
