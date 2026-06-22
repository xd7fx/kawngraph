<!--
Thanks for contributing to KawnGraph — one project universe, every coding agent.
Please read CONTRIBUTING.md before opening this PR, especially the privacy review.
Fill in the sections below and check every box that applies. Delete any that don't.
-->

## Summary

<!-- What does this PR change, and why? Keep it focused. -->

## Linked issue

<!-- e.g. "Closes #123" / "Refs #123". If there's no issue, say why. -->

Closes #

## Type of change

<!-- Check all that apply. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Scanner change (new/updated scanner — see [docs/SCANNERS.md](../docs/SCANNERS.md))
- [ ] Studio / UI change (the read-only Vite + React app under `apps/studio`)
- [ ] Docs only
- [ ] Refactor / chore / tooling (no behavior change)

## Checklist

<!-- Run all four checks before opening: pnpm build && pnpm test && pnpm typecheck && pnpm pack:check -->

- [ ] **Tests added/updated** for the change, and `pnpm test` passes locally.
- [ ] `pnpm pack:check` passes **if packaging is affected** (any package's `files`, `bin`, exports, or `package.json` — see [CONTRIBUTING.md](../CONTRIBUTING.md)).
- [ ] **Docs updated** where behavior, commands, or flags changed (`README.md` / `README.ar.md` and the relevant file under [`docs/`](../docs)).
- [ ] **Privacy review** (every change must pass — see [docs/PRIVACY.md](../docs/PRIVACY.md) and [CONTRIBUTING.md](../CONTRIBUTING.md)):
  - [ ] No new network calls during scan or retrieval (no network by default).
  - [ ] No telemetry, no query logging added by default.
  - [ ] The MCP server stays **read-only** (it never scans, rebuilds, or writes the graph).
  - [ ] No LLM is invoked by default (AI enrichment stays opt-in and local-first).
- [ ] **Screenshots / GIF attached** for any Studio (UI) change, covering both light and dark themes if visuals changed.
- [ ] **Benchmark numbers regenerated from the artifact, not hand-edited**, if benchmarks were touched — the README block is produced by `scripts/readme-benchmark.mjs` from [`benchmarks/published/campaign-2026-06-20.summary.json`](../benchmarks/published/campaign-2026-06-20.summary.json). See [docs/BENCHMARKS.md](../docs/BENCHMARKS.md).

## Screenshots / GIF (UI changes only)

<!-- Required for any Studio change. Show before/after if relevant; include light and dark themes. -->

## Notes for reviewers

<!-- Anything else: trade-offs, follow-ups, areas you want extra eyes on. -->
