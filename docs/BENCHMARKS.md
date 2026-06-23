# Benchmarks

How KawnGraph measures its own value — the methodology, the metrics, and the honest results (positive, neutral, and negative).

> **Read this before quoting a number.** This is an **exploratory** campaign: 72 sessions were run, **12 were excluded for gold provenance** (the `code-symbol-extraction` cell — see [Gold validation](#gold-validation-12-excluded-for-provenance)), leaving **60 usable across 10 cells**, n=3 per arm. With n<5 per arm the per-cell results are **directional, not statistically significant**. Do not turn one task's result into a universal claim. KawnGraph is task-dependent.

The single source of truth for every number below is the committed, sanitized artifact:

- [`benchmarks/published/campaign-2026-06-20.summary.json`](../benchmarks/published/campaign-2026-06-20.summary.json) (machine-readable)
- [`benchmarks/published/campaign-2026-06-20.md`](../benchmarks/published/campaign-2026-06-20.md) (rendered)

The harness lives in [`packages/benchmark`](../packages/benchmark). The README's benchmark block is generated from the same artifact, so it can never drift. See also the project [README](../README.md).

---

## The A/B design

The harness runs **the same agent on the same task, with vs without KawnGraph**, and reports the signed difference. For each `project × task × agent`:

- **A = without** KawnGraph (control). **B = with** KawnGraph (treatment).
- Identical commit, prompt, model, permissions, timeout, and a clean worktree for both arms.
- A/B order is randomized per repeat; each condition is repeated `repeat` times (here, 3).
- **`retrieval`** sessions are read-only (find the right files/answer). **`e2e`** sessions edit a fresh copy of the project, and the **harness — not the agent — runs the task's test command** to grade the change.
- The one-time graph **scan is a setup cost recorded separately**, never folded into session timings.

Delta convention used everywhere: **Δ = B − A**. For "less is better" metrics (tool calls, wall time, tokens, time-to-first-relevant) a **negative Δ is the win**; for "more is better" metrics (recall, precision, correctness) a **positive Δ is the win**.

Source: [`packages/benchmark/src/runner.ts`](../packages/benchmark/src/runner.ts).

---

## Environment, campaign, and sample size

Pulled from the published artifact:

| Field | Value |
| --- | --- |
| KawnGraph version | `0.1.0` |
| Created | `2026-06-20T21:42:46.037Z` |
| Commit | `2de5ef48` |
| Seed | `1` |
| Repeats | `3` |
| Campaign mode | `mixed` (retrieval + e2e) |
| Agents | `claude`, `codex` |
| Environment | `win32/x64`, node `v22.15.0` |

### Sample size and statistical status

| Check | Value |
| --- | --- |
| Total runs | 72 |
| OK runs | 72 |
| Failed runs | 0 |
| Runs excluded for gold provenance | 12 |
| Usable runs | 60 |
| Usable cells (project × task × agent × mode) | 10 |
| Runs per arm (n) | 3 |
| Smallest sample per arm | 3 |
| Statistical status | **exploratory** (n<5/arm — directional, not significant) |

The campaign ran 72 sessions (12 cells × 2 arms × 3 repeats). After the gold-provenance exclusion below, **60 sessions across 10 cells** are usable. Every arm has n=3, which is **below the n≥5 threshold** the harness uses to flag a result as more than directional.

---

## Gold validation (12 excluded for provenance)

Before any aggregation, the publisher validates the campaign and records the result honestly. A "gold set" is the curated list of files a correct answer/edit must hit for a task.

| Check | Value |
| --- | --- |
| Total runs | 72 |
| Runs with invalid gold (`goldCount < 1`) | 0 |
| Runs excluded for gold provenance | 12 |
| Total excluded runs | 12 |
| Usable runs | 60 |
| Gold validation | all retained runs have a valid gold reference |

### Excluded cell: `code-symbol-extraction` (gold-provenance)

The campaign (commit `2de5ef48`) scored the `code-symbol-extraction` task against a gold list whose orchestrator entry was `packages/scanners/src/code/scancode.ts` — a file that **does not exist on disk under that name**; the real file is `scanCode.ts`. In the campaign pack that entry scored as **absent** (rank `null`). The harness even names this failure mode in `assertGoldExists` as "the `scancode.ts` class of bug."

The gold was **corrected afterward** in [`benchmarks/projects.json`](../benchmarks/projects.json) to the exact-case `scanCode.ts` (and the other four entries), but the 72 sessions were **neither rescored nor rerun** against the corrected gold. Because a corrected result cannot be proven, the whole cell (claude + codex, 12 sessions) is **excluded** and every downstream result is regenerated from the remaining 10 cells.

| Provenance fact | Value |
| --- | --- |
| Prior gold entry (campaign) | `packages/scanners/src/code/scancode.ts` (absent) |
| Actual file on disk | `packages/scanners/src/code/scanCode.ts` |
| Original campaign commit | `2de5ef48` |
| Original gold sha256 | `25b16c2ef4891155…` |
| Corrected gold sha256 | `f41e8cfdc6378b42…` |
| Rescored? | **no** |
| Rerun? | **no** |
| Action | cell excluded; all README/artifact results regenerated |

Three guards keep precision/recall honest going forward (see [`packages/benchmark/src/suites.ts`](../packages/benchmark/src/suites.ts) and [`scripts/benchmark-publish.mjs`](../scripts/benchmark-publish.mjs)):

- **`assertGoldExists`** — refuses to run a suite whose gold names files that no longer exist on disk (exactly the `scancode.ts` case above).
- **`assertGoldApproved`** — refuses to score machine-suggested gold that a human hasn't reviewed (`goldApproved: false`).
- **Publisher exclusion** — any `ok` run whose `goldCount < 1`, or any cell with a known gold-provenance defect, is **excluded and counted**, never silently kept.

Scoring against missing, draft, or mismatched gold would fabricate precision/recall, so each of these is a hard block rather than a warning.

---

## Graph scan cost (one-time, excluded from session timings)

| Project | Scan time | Nodes | Edges | Tracked files |
| --- | --- | --- | --- | --- |
| `nextjs-supabase` | 98 ms | 20 | 39 | 4 |
| `kawn-self` (KawnGraph's own repo) | 611 ms | 736 | 1770 | 140 |

---

## Metric definitions

Two strictly separated metric families, both pure and deterministic (no I/O). The distinction is deliberate: **a great Context Pack the agent ignores still scores high in family A and low in family B.** See [`packages/benchmark/src/metrics.ts`](../packages/benchmark/src/metrics.ts).

### Family A — KawnGraph Context Pack quality (no agent)

Scores the Context Pack `kawn_context` *would return* for a task, against the gold set, before any agent acts.

| Metric | Definition |
| --- | --- |
| **Context Pack precision** | gold files returned ÷ total files returned in the pack |
| **Context Pack recall** | gold files returned ÷ gold count |
| files returned / mustRead / docs / tables / tests | size + composition of the pack |
| token estimate | the pack's estimated token footprint |
| confidence | the pack's self-reported confidence |
| excluded | candidate items the pack dropped under budget |

### Families B/C — agent session behavior

Scores what the agent actually did in one session.

| Metric | Definition |
| --- | --- |
| **Task correctness** (`successRate`) | fraction of runs that completed ok |
| **Answer correct** | answer contains the task's expected mentions; **n/a** when the task defines no expected mentions |
| **Relevant files found (recall)** | gold "hits" ÷ gold count, where a hit is a gold file the agent **opened OR named in its final answer** |
| **Opened-file precision** | relevant files opened ÷ total distinct files opened (did it avoid noise?) |
| **Distinct files opened** | files touched by read / scoped-grep / edit / write calls |
| **Tool calls** | total tool calls in the session |
| **Time-to-first-relevant** | ms until the first call that touches a gold file |
| **Total wall time** | end-to-end session duration |
| **Input / output tokens** | per-session token usage |
| **Automatic KawnGraph invocation** | fraction of `with` runs where the agent called a `kawn_*` tool on its own (always 0 in the control arm) |
| **Tests passed** *(e2e only)* | harness-run test command exit status |
| **Files changed** *(e2e only)* | distinct files the edit touched |
| **Files outside boundary** *(e2e only)* | edits that strayed outside the gold boundary (0 = surgically clean); **n/a** when the task has no gold to judge against |

> Missing values are reported as **n/a**, never `0`. A `0` means "measured zero"; `n/a` means "not applicable / not measured."

---

## Outcome-label rule (deterministic)

Each cell gets one label, derived mechanically from the tool-call and wall-time deltas (see `outcomeLabel` in [`scripts/benchmark-publish.mjs`](../scripts/benchmark-publish.mjs)). It is intentionally conservative:

- **Regressed** — agent did more work: wall time up >5% **and** tool calls did not go down.
- **Improved** — agent did less work: wall time down >5% **and** tool calls did not go up.
- **Neutral** — changes are small or mixed.
- **Insufficient data** — an arm is missing or has no ok runs.

Because every cell is n<5/arm, these labels are **directional, not statistically significant**.

---

## Task-level findings (all 10 usable cells)

Every usable cell, both agents (the `code-symbol-extraction` cell is excluded for gold provenance, above). Tool-call and wall-time deltas are Δ = B − A (negative = KawnGraph reduced it). All values from the artifact; nothing typed from memory.

| Task | Agent | Mode | Outcome | Tool-call Δ | Wall-time Δ | n/arm |
| --- | --- | --- | --- | --- | --- | --- |
| context-pack-ranking | claude | retrieval | Neutral | −0.3 | +6233 ms | 3 |
| docs-to-code-linking | claude | retrieval | Neutral | −0.3 | +9578 ms | 3 |
| freshness-gate | claude | retrieval | **Improved** | −9.7 | −54575 ms | 3 |
| oauth-code-guard | claude | e2e | Neutral | −0.3 | +5917 ms | 3 |
| zid-oauth *(headline)* | claude | retrieval | Regressed | +0.3 | +7282 ms | 3 |
| context-pack-ranking | codex | retrieval | Regressed | +4.0 | +33333 ms | 3 |
| docs-to-code-linking | codex | retrieval | **Improved** | −0.7 | −4583 ms | 3 |
| freshness-gate | codex | retrieval | Neutral | 0.0 | −2135 ms | 3 |
| oauth-code-guard | codex | e2e | Regressed | 0.0 | +1453 ms | 3 |
| zid-oauth *(headline)* | codex | retrieval | Regressed | +5.3 | +4530 ms | 3 |

Across 10 usable cells: **2 Improved, 4 Neutral, 4 Regressed**. Codex saw more regressions than Claude in this campaign.

### Where KawnGraph clearly helped (positive)

**`freshness-gate` (claude, retrieval) — Improved.** The biggest single win:

| Metric | A: without | B: with | Δ (B−A) |
| --- | --- | --- | --- |
| Tool calls | 14.33 | 4.67 | −9.67 (−67%) |
| Total wall time | 135780 ms | 81205 ms | −54575 ms (−40%) |
| Distinct files opened | 4.33 | 2 | −2.33 |
| Opened-file precision | 47% | 100% | +53 pp |
| Time-to-first-relevant | 48366 ms | 34384 ms | −13982 ms |
| Answer correct | 0% | 67% | +67 pp |

On an unfamiliar multi-file discovery task, the agent did far less work and got more correct.

### Neutral / mixed

**`context-pack-ranking` and `docs-to-code-linking` (claude, retrieval) — Neutral.** Tool calls dipped slightly (−0.3 each) but wall time rose (+6.2 s, +9.6 s), so the conservative rule lands on Neutral. **`docs-to-code-linking` (codex)** flipped to Improved: −13345 ms time-to-first-relevant and −4583 ms wall, though input tokens rose +52%.

### Where KawnGraph added overhead (negative)

**`zid-oauth` — the headline task — Regressed for both agents.** This is the realistic external-project (`nextjs-supabase`) discovery task, and it is reported as the headline precisely so the honest cost is visible.

`zid-oauth` (codex, retrieval):

| Metric | A: without | B: with | Δ (B−A) |
| --- | --- | --- | --- |
| Tool calls | 2.67 | 8 | +5.33 (+200%) |
| Distinct files opened | 1 | 4.33 | +3.33 |
| Total wall time | 36420 ms | 40950 ms | +4530 ms (+12%) |
| Input tokens | 48642 | 67373 | +18732 (+38%) |
| Opened-file precision | 25% | 61% | +36 pp |
| Relevant files found (recall) | 80% | 87% | +7 pp |
| Task correctness | 100% | 100% | 0 |

Note the nuance: precision and recall *improved*, but the agent spent more calls, time, and tokens to get there — so by the work-done rule it Regressed. On already-focused single-file tasks (e.g. `oauth-code-guard`), the extra retrieval step is pure overhead.

The Context Pack itself (family A) was strong on this task regardless of agent behavior: **6 files returned, gold 5/5, recall 100%, precision 83%, ~3442 tokens.** That is the family-A vs family-B split in action — a good pack does not guarantee the agent uses it efficiently.

---

## Reproduce it

Requires Node ≥18 and pnpm. From a checkout (the package is **not published to npm yet**, so use the from-source path):

```bash
pnpm install && pnpm build
```

Run the benchmark (`bench` is the beginner alias for `benchmark`):

```bash
pnpm kawn bench
# or, equivalently:
pnpm kawn benchmark
```

Raw campaign output is written to a gitignored directory (it carries machine paths and full transcripts). To turn a raw campaign into the committed, sanitized artifact:

```bash
node scripts/benchmark-publish.mjs
# or point it at a specific merged campaign file:
node scripts/benchmark-publish.mjs <merged-campaign.json> --out benchmarks/published
```

This is a pure function of its input (no network, no `Date.now()` in the output), so re-running it on the same campaign yields the same artifact.

Regenerate the README benchmark block from the published artifact:

```bash
node scripts/readme-benchmark.mjs            # rewrite the block in README.md
node scripts/readme-benchmark.mjs --check    # exit 1 if README is out of date
node scripts/readme-benchmark.mjs --print    # print the block to stdout
```

The block is delimited by `<!-- BENCH:START -->` / `<!-- BENCH:END -->`. Benchmark numbers are English-canonical: translations embed the same block verbatim.

---

## Limitations

- **Exploratory only.** n=3 per arm (10 usable cells, 60 usable of 72 sessions — 12 excluded for gold provenance). With n<5/arm, no per-cell result is statistically significant — every label is directional. Do not present any single cell as a universal claim.
- **Two agents, one environment.** Only `claude` and `codex`, on `win32/x64` / node `v22.15.0`, at commit `2de5ef48`. Other agents, OSes, and models are untested here.
- **Two projects, twelve task families.** `kawn-self` (KawnGraph's own repo) and a `nextjs-supabase` sample. Results will differ on other codebases and task shapes.
- **Outcome labels are work-proxies.** "Improved/Regressed" key off tool calls and wall time. A task can improve *precision/recall* (a real quality gain) yet be labeled Regressed because it spent more calls/time — see `zid-oauth`. Read the per-metric table, not just the label.
- **KawnGraph is task-dependent.** It helped most on unfamiliar, multi-file *discovery* (`freshness-gate`) and added overhead on already-focused, single-file work. Codex saw more regressions than Claude in this campaign.
- **Scan cost is excluded from session timings** and reported separately. If you scan frequently, factor that one-time cost in yourself.
- **Wall time and tokens are environment-sensitive.** Network, model latency, and machine load move these numbers; treat absolute ms/token figures as illustrative, not portable.
