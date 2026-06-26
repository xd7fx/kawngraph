# Contributing to KawnGraph

Thanks for helping build **KawnGraph** — *one project universe, every coding agent*. This guide covers local setup, the conventions we hold to, and the **privacy review** every change must pass.

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md). To report a security issue privately, see [SECURITY.md](SECURITY.md) — please do not open a public issue for vulnerabilities.

For the big picture, start with the [README](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Prerequisites

- **Node.js >= 18** (the repo is exercised on Node 22; see `engines` in [`package.json`](package.json))
- **pnpm** — this is a pnpm workspace ([`pnpm-workspace.yaml`](pnpm-workspace.yaml))

KawnGraph is published on npm (`npx kawngraph …` for users), but **contributors work from source**: build the monorepo once, then use `pnpm kawn …` against your local changes.

## Setup (tested commands)

```bash
pnpm install && pnpm build
```

This installs all workspace dependencies and runs the composite TypeScript build (`tsc -b`) across every package.

Run the test suite (Node's built-in `node:test`):

```bash
pnpm test
```

> `pnpm test` runs `pretest` first, which compiles the packages, the `tests/` project, and the Studio test project before executing `tests/dist/*.test.js`.

Type-check without producing a fresh build artifact assumption:

```bash
pnpm typecheck
```

Verify the npm packaging surface (what would ship in each package's `files`):

```bash
pnpm pack:check
```

Run all four before opening a PR. From source you can invoke the CLI directly, e.g.:

```bash
pnpm kawn help
pnpm kawn check        # alias of doctor/status
```

## Project layout

This is a monorepo. Packages live under `packages/*`, the read-only Studio web app under `apps/studio`, tests under `tests/`, and maintenance scripts under `scripts/`.

| Path | What it is |
| --- | --- |
| `packages/shared` | Shared types and utilities |
| `packages/scanner-sdk` | The contract scanners implement (detect → scan → finalize) |
| `packages/scanners` | Built-in scanner plugins (TS/JS, Python, SQL, package.json, Markdown) |
| `packages/context-protocol` | Universal Context Pack (UCP) shaping |
| `packages/core` | Graph build, query, context, affected, diff/changes |
| `packages/cli` | The `kawn` CLI (binary names `kawn` + `kawngraph`) |
| `packages/mcp` | Read-only stdio MCP server (`kawn`) |
| `packages/agents` | Agent setup/integration (Claude Code, Codex, Cursor) |
| `packages/studio-server` | Local server backing the Studio app |
| `packages/benchmark` | Local A/B benchmark harness |
| `apps/studio` | Vite + React graph viewer (read-only) |
| `docs/` | Documentation (see [AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md), [SCANNERS.md](docs/SCANNERS.md)) |
| `benchmarks/published/` | Committed, sanitized benchmark artifacts |
| `scripts/` | Packaging, benchmark, and docs maintenance scripts |

See [ARCHITECTURE.md](ARCHITECTURE.md) for how these fit together.

## Conventions

- **TypeScript everywhere.** Match the surrounding code style. `pnpm typecheck` must pass with no errors.
- **Conventional commits.** Format: `type(scope): subject`.
  - Types: `feat`, `fix`, `docs`, `test`, `perf`, `refactor` (also `chore`, `build`, `ci` where appropriate).
  - Scopes mirror the area touched, e.g. `studio`, `scanner`, `context`, `cli`, `mcp`, `core`, `agents`, `benchmark`.
  - Examples (from this repo's history):
    - `feat(studio): functional Changes view + read-only /api/changes endpoint`
    - `perf(studio): off-thread graph layout + summary-first cancellable load`
- **Evidence-backed and deterministic.** Every edge carries evidence (source path + line range + snippet) and a confidence level (`extracted` | `linked` | `semantic` | `manual`). Every node has a stable, content-addressable ID. The same input must always produce the same graph — no timestamps, randomness, or environment-dependent ordering in graph or report output.
- **No regressions to privacy defaults.** See the privacy review below.

## Privacy review (every PR must pass)

KawnGraph's core promise is **local-first, no surprises**. Reviewers check every PR against these invariants. A change that breaks one of them will not be merged unless it is an explicit, documented, opt-in feature behind a flag:

- **No new network calls** during scan or retrieval. No network by default — the graph is built and queried entirely on the local machine.
- **No telemetry.** No usage reporting, no phone-home, no query logging by default.
- **MCP stays read-only.** The `kawn` MCP server only reads the graph over stdio. It never scans, rebuilds, writes, or edits code. Building/refreshing the graph is always an explicit CLI step (`kawn scan` / `kawn update`).
- **No LLM by default.** There is no internal LLM. AI enrichment is opt-in and local-first; it must never be wired into a default code path.

If your change *needs* one of the above, call it out explicitly in the PR description so reviewers can evaluate the opt-in design.

## Adding or modifying a scanner plugin

Scanners are versioned plugins that follow `detect → scan → finalize`, are deterministic, isolate per-file failures, register explicitly, and respect bounded file sizes. The built-in plugins live in `packages/scanners/src/plugins/`.

Read **[docs/SCANNERS.md](docs/SCANNERS.md)** before adding or changing one — it documents the SDK contract, registration, evidence/confidence requirements, and the two deliberate omissions (methods/nested functions ride on their parent as metadata and are never separate nodes; ambient declarations like `.d.ts` / `.pyi` are never claimed).

Every scanner change should ship with tests under `tests/` and keep output deterministic.

## Running and regenerating benchmarks (honestly)

The benchmark is a **local A/B harness**: it runs the *same* agent on the *same* task **with vs without** KawnGraph and compares tool-call and wall-time deltas.

- The committed, sanitized, validated artifact is `benchmarks/published/campaign-2026-06-20.summary.json` (and `.md`). It is **exploratory** (n<5 per arm → directional, not statistically significant) and reports neutral and regressed cells honestly. Do not hand-edit it.
- The README benchmark block is generated from that artifact by `scripts/readme-benchmark.mjs` (delimited by `<!-- BENCH:START -->` / `<!-- BENCH:END -->`). To refresh or check it:

  ```bash
  node scripts/readme-benchmark.mjs           # rewrite the block in README.md
  node scripts/readme-benchmark.mjs --check    # exit 1 if README is out of date
  ```

- A raw campaign is turned into a publishable artifact deterministically by `scripts/benchmark-publish.mjs`.

**Honesty rules:** never type a benchmark number from memory or by hand — regenerate it from the published artifact. Never cherry-pick: present improved, neutral, and regressed outcomes together. KawnGraph is task-dependent (it helps most on unfamiliar multi-file discovery and can add overhead on already-focused single-file tasks).

## Internationalization

KawnGraph ships English and Arabic UI and docs. If you touch user-facing strings or want to add a language, read **[docs/i18n/TRANSLATING.md](docs/i18n/TRANSLATING.md)**. Benchmark numbers are English-canonical and must be embedded verbatim in translations — never silently change them.

## Submitting a pull request

1. Branch off `main`.
2. Make focused, evidence-backed, deterministic changes.
3. Run `pnpm build`, `pnpm typecheck`, `pnpm test`, and `pnpm pack:check`.
4. Use a conventional commit message with the right scope.
5. In the PR description, confirm the privacy review invariants still hold (or document the opt-in if not).

Thank you for contributing.
