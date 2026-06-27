# Changelog

All notable changes to **KawnGraph** are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> `0.1.0` was the first public npm release; `0.1.1` was a post-publish fix.
> **`0.1.2` is the current version** (Studio + presentation; not yet published).

## [0.1.2]

### Added

- **Studio — constellation 2D Map.** The 2D Map is now a force-directed star-map:
  circular nodes coloured by layer (sized by degree), thin edges, pan/zoom/fit,
  hover highlight, search emphasis, and level-of-detail labels — replacing the old
  stacked React-Flow cards. A **"Show all"** control renders every filtered node,
  and **fair, layer-aware sampling** keeps the visible set colour-diverse instead of
  almost all `code`. (Impact/Flow and the 3D Universe are unchanged.)
- A **landing page** (Website badge) and an **npm** badge in the READMEs, and a full
  **language picker** (all 31 languages) on every README page.

### Changed

- Docs lead with **`npx kawngraph setup`** as the primary install path now that the
  package is published; building from source is framed as the contributor path.
- All 29 machine-assisted README translations refreshed to the current content.

### Fixed

- Translation page logos now adapt to GitHub's dark theme (the "Kawn" wordmark was
  invisible on dark).

## [0.1.1] — post-publish fix

### Fixed

- **Portable MCP launch — fixes `spawn kawn-mcp ENOENT` (esp. Windows).** After
  publishing `0.1.0`, a real smoke test found that `kawn setup` / `kawn check` could
  fail on a published install when npm's global-bin directory was not on `PATH`,
  because the MCP launch fell back to a bare `kawn-mcp` command (or an ephemeral
  local path). Setup now writes a **portable `npx -y @kawngraph/mcp@<version>`**
  launch for installed users — nothing has to be installed globally or on `PATH`. A
  monorepo checkout still launches the built server directly with `node`. Doctor's
  resolvability check and the setup notes were updated accordingly. Regression guard:
  `tests/launch.test.ts`.

## [0.1.0]

### Added

- **Layered, evidence-backed graph** — TypeScript/JavaScript and Python (via the
  pure-JS `@lezer/python`), SQL (tables + foreign keys), `package.json`
  (workspace deps), and Markdown, into `code`/`data`/`config`/`docs`/`test`
  layers. Every edge carries evidence (path + line range + snippet) and a
  confidence level; every node has a stable, content-addressable id.
- **Context Packs** — `kawn ask` / `kawn context "<task>" --budget N`:
  token-budgeted must-read files, related docs, tables, tests, risks, an excluded
  list, and a confidence score. Deterministic, no LLM.
- **Universal Context Protocol (UCP)** — agent-neutral pack export
  (`--format ucp` / `ucp-md`) with capability negotiation and a structural validator.
- **Impact & Git change analysis** — `kawn impact <symbol>` and
  `kawn changes` / `pr-impact` / `pr-context` (local git only).
- **Read-only MCP server** — stdio JSON-RPC, zero dependencies; tools
  `kawn_context`, `kawn_query`, `kawn_affected`, `kawn_changes`. Warns when stale,
  refuses an incompatible/malformed graph; never scans or writes.
- **Agent adapters** — one core graph, an adapter per tool: Claude Code, Codex,
  Cursor, GitHub Copilot, and Gemini CLI (MCP); Aider (context file); `generic`
  (Markdown/JSON export); and `local` (optional Ollama / LM Studio, never
  required). Reversible, project-scoped, atomic with backups; never edits
  `CLAUDE.md` / `AGENTS.md`. CLI: `kawn setup [<agent>]`, `setup local --provider`,
  `agents` / `agents status` / `agents uninstall`, `pack --format markdown|json`,
  `--local`.
- **KawnGraph Studio** — local, read-only graph explorer (`kawn map`): 2D graph,
  a scalable 3D "Universe" star-map, Context-Pack builder, impact / changes / bench
  views; English + Arabic (RTL).
- **Behavioral A/B benchmark** — local harness comparing the same agent on the
  same task with vs without KawnGraph; a committed, validated, sanitized artifact
  under `benchmarks/published/`. Exploratory (n<5/arm).
- **Docs, brand, i18n & community** — canonical README + first-class Arabic, 29
  machine-assisted translations (manifest-driven, parity-checked), a "universe"
  brand system, depth docs, a dated sourced comparison, and a full community
  surface (CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / SUPPORT / issue & PR
  templates / verification-only CI).

### Not yet built (roadmap)

- Opt-in, suggest-only hooks; the visual layer (image/OCR); semantic/AI
  enrichment; a runtime layer. All opt-in by design.

[0.1.2]: https://github.com/xd7fx/kawngraph/releases/tag/v0.1.2
[0.1.1]: https://github.com/xd7fx/kawngraph/releases/tag/v0.1.1
[0.1.0]: https://github.com/xd7fx/kawngraph/releases/tag/v0.1.0
