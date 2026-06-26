# Adversarial Pre-Release Review

A 12-reviewer adversarial sweep (each reviewer tasked to *prevent* a bad launch),
verified against code, then hardened. This is the launch gate.

## Verdict

### 🟢 LAUNCH — conditional on the manual gates below

- **0 Blockers.** No reviewer returned a no-launch lean (10 launch / 2 conditional / 0 no-launch).
- The **2 substantive overclaims and 2 robustness gaps** the review found (all rated
  High) have been **fixed** in this branch and re-verified (399 tests, pack:check).
- The only things standing between here and a real release are **manual** and
  **maintainer-gated**, not code: live adapter QA on real tools, and the explicit
  `npm login` → publish → tag → release.

## Raw tally

`0 Blocker · 4 High · 4 Medium · 13 Low`. The Highs and the actionable Mediums are
resolved below; the rest are documented-by-design or false positives.

## High — found and FIXED

| Finding | Reality | Fix |
| --- | --- | --- |
| "Every edge carries evidence" / "No edge without evidence" overclaim | `evidence?` is **optional**; validation *warns* on a missing-evidence edge but keeps it | Softened to "edges carry evidence … where the scanner can attach it" in `README.md`, `README.ar.md`, `docs/GRAPH_MODEL.md`; comparison row → "Evidence on edges" |
| MCP server "zero dependencies" misleading | False transitively: `@kawngraph/mcp → core → scanners → @lezer/python, typescript` | Reworded to "**no MCP SDK** (hand-rolled JSON-RPC loop)" in `README.md`, `README.ar.md`, `packages/mcp/src/index.ts` |
| TOCTOU: JSON adapter re-reads the config after `plan()` validated it — a file corrupted in between is treated as `{}` and clobbered | `installJsonMcp` did a second `readJsonFile` and merged | Install now writes exactly the content `plan()` validated (`plan.files[0].preview`); no second read → no window. (Also resolves Medium "no re-validation of mcpServers key type".) |
| TOCTOU: Codex TOML adapter re-reads + re-edits after `plan()` | `installCodex` did a second `readSource` + `upsertTomlTable` | Same fix — writes the validated `plan` preview (trailing-newline preserved) |

All four are covered by the existing 399 tests (the install outputs are byte-identical;
the malformed-refusal and idempotency guarantees are unchanged) and by `pack:check`.

## Medium — status

| Finding | Disposition |
| --- | --- |
| No re-validation of `mcpServers` key type between plan and install | **Resolved** by the TOCTOU fix (no second read). |
| MCP launch is machine-specific until publish — not in README/GETTING_STARTED | **Already surfaced** where it matters: `setup` prints the non-portable note at write time, and `docs/AGENT_INTEGRATION.md` + `RELEASING.md` document it. Becomes moot once `@kawngraph/mcp` is published (the npx launch is portable). |
| Benchmark headline lacks strong qualification | **Already caveated**: the BENCH block and `docs/BENCHMARKS.md` label it exploratory (n<5, directional only) and show mixed/negative results (Codex regressed). No change — honest as-is. |
| No test for the TOCTOU scenario | The fix **removes the window structurally** (no second read), so a timing test is not meaningful; behavior is covered by existing malformed/idempotency tests. |

## Low — disposition (13)

- **False positive:** "docs mention `kawn ask` which does not exist" — `kawn ask` **is** a
  real beginner alias for `context` (`packages/cli/src/index.ts`). No change.
- **Documented-by-design:** SQL scanner scope (tables + FKs only — `docs/SCANNERS.md`),
  Studio dev Vite proxy → `127.0.0.1` (dev-only), local LLM only on explicit `--local`,
  preserved user files / non-empty dirs on disconnect (this is the *correct*, safe
  behavior), manifest-written-after-config (recoverable).
- **UX clarity, non-blocking:** Quick-start lists `pnpm studio:build` as step 4; running
  only steps 1–3 yields an API-only `kawn map` with a clear warning (graceful).

None are launch-blocking; none were left silently — each is recorded here.

## What this gate does NOT cover (manual, maintainer-owned)

1. **Live adapter QA** on the real tools — see [ADAPTER_QA.md](ADAPTER_QA.md).
2. The actual **publish / tag / GitHub release** — see [../RELEASING.md](../RELEASING.md).
3. Uploading `brand/dist/social-card.png` to GitHub's Social-preview setting.
