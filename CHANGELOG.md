# Changelog

All notable changes to **KawnGraph** are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Nothing is released to npm yet. Everything below is the pre-1.0 **development
> baseline** (`v0.1.0`, unpublished). Until then, run from source — see
> [README](README.md#quick-start).

## [Unreleased]

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
- npm publication (`kawngraph` is `private`); `npx kawngraph` becomes available
  only after publication.

[Unreleased]: https://github.com/xd7fx/kawngraph/commits/main
