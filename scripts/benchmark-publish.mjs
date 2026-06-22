#!/usr/bin/env node
/*
 * benchmark-publish.mjs — turn a raw local A/B campaign into a committed,
 * sanitized, KawnGraph-branded research artifact.
 *
 * Why this exists
 * ---------------
 * The raw campaign under benchmark-results/ is gitignored: it carries machine
 * paths, auth-readiness probes, and full tool transcripts. The README cites
 * numbers, so those numbers need ONE auditable source that is safe to commit and
 * regenerated deterministically — not hand-typed (which drifts and invites
 * cherry-picking).
 *
 * What it does
 * ------------
 *  1. Reads a merged campaign report (the raw JSON the harness wrote).
 *  2. Normalizes legacy `athar*` keys → `kawn*` (the on-disk artifact predates
 *     the rename; the code is already kawn-branded).
 *  3. VALIDATES the campaign and records the result honestly:
 *       - every run must be `ok` (failed runs score no metrics, by design);
 *       - every run's gold reference must be valid (goldCount >= 1) — runs with
 *         an empty/invalid gold set are EXCLUDED and counted, never silently kept;
 *       - the smallest per-arm sample size is reported, and n<5/arm is flagged
 *         exploratory (directional, not statistically significant).
 *  4. Aggregates each task×agent×mode cell into A (without) vs B (with KawnGraph)
 *     means + signed deltas, mirroring packages/benchmark reports.ts arithmetic
 *     (mean over ok runs; rates as fractions; Δ = B − A).
 *  5. Derives a per-cell outcome label (Improved / Neutral / Regressed /
 *     Insufficient data) from a deterministic, documented rule.
 *  6. Writes a SANITIZED summary.json + a human-readable .md to
 *     benchmarks/published/ — no transcripts, no absolute paths, no auth probes.
 *
 * Usage:
 *   node scripts/benchmark-publish.mjs [sourceJson] [--out benchmarks/published]
 *
 * Determinism: pure function of the input file. No network, no Date.now() in the
 * output (createdAt is copied from the source campaign).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE = join(
  ROOT,
  "benchmark-results",
  "campaign-final",
  "merged-2026-06-20T21-42-46-037Z.json",
);

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
let source = DEFAULT_SOURCE;
let outDir = join(ROOT, "benchmarks", "published");
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--out") outDir = argv[++i];
  else if (!argv[i].startsWith("--")) source = argv[i];
}

// ---- legacy key normalization (athar* → kawn*) -----------------------------
function normalizeReport(raw) {
  const m = (x) => {
    if (!x || typeof x !== "object") return x;
    const o = { ...x };
    if ("atharCalled" in o) o.kawnCalled = o.atharCalled;
    if ("atharFirst" in o) o.kawnFirst = o.atharFirst;
    if ("atharOrder" in o) o.kawnOrder = o.atharOrder;
    return o;
  };
  return {
    kawnVersion: raw.kawnVersion ?? raw.atharVersion ?? "unknown",
    createdAt: raw.createdAt,
    seed: raw.seed,
    mode: raw.mode,
    repeat: raw.repeat,
    agents: raw.agents ?? [],
    scanCosts: raw.scanCosts ?? [],
    env: raw.env ?? {},
    // `athar-self` is the internal label for KawnGraph's own repo used as a
    // benchmark target; rename to `kawn-self` so the published artifact carries
    // no legacy brand. This is a cosmetic project label, never a metric.
    runs: (raw.runs ?? []).map((r) => ({
      ...r,
      projectId: r.projectId === "athar-self" ? "kawn-self" : r.projectId,
      metrics: m(r.metrics),
      kawnPack: r.kawnPack ?? r.atharPack ?? null,
    })),
  };
}

// ---- stats (mirror packages/benchmark/src/reports.ts) ----------------------
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
function mean(values) {
  const xs = values.filter(isNum);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
function rate(values) {
  const xs = values.filter((v) => typeof v === "boolean");
  return xs.length ? xs.filter(Boolean).length / xs.length : null;
}
const round = (x, d = 0) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

// metric specs: how each headline metric is read + formatted + compared
const METRICS = [
  { key: "successRate", label: "task correctness", kind: "rate", get: (s) => s.successRate },
  { key: "kawnAutoInvoked", label: "automatic KawnGraph invocation", kind: "rate", get: (s) => s.kawnCalledRate },
  { key: "filesFound", label: "relevant files found (recall)", kind: "rate", get: (s) => s.meanRecall },
  { key: "openedPrecision", label: "opened-file precision", kind: "rate", get: (s) => s.meanPrecision },
  { key: "filesOpened", label: "distinct files opened", kind: "num", get: (s) => s.meanDistinct },
  { key: "toolCalls", label: "tool calls", kind: "num", get: (s) => s.meanToolCalls },
  { key: "timeToFirstRelevantMs", label: "time to first relevant file", kind: "ms", get: (s) => s.meanTtf },
  { key: "wallMs", label: "total wall time", kind: "ms", get: (s) => s.meanWall },
  { key: "inputTokens", label: "input tokens", kind: "tok", get: (s) => s.meanInput },
  { key: "outputTokens", label: "output tokens", kind: "tok", get: (s) => s.meanOutput },
  { key: "answerCorrect", label: "answer correct", kind: "rate", get: (s) => s.answerCorrectRate },
  { key: "testsPassed", label: "tests passed", kind: "rate", get: (s) => s.testsPassedRate, e2e: true },
  { key: "filesChanged", label: "files changed", kind: "num", get: (s) => s.meanFilesChanged, e2e: true },
  { key: "outsideBoundary", label: "files outside boundary", kind: "num", get: (s) => s.meanFilesOutsideGold, e2e: true },
];

function aggregateSide(runs) {
  const ok = runs.filter((r) => r.ok && r.metrics);
  const m = ok.map((r) => r.metrics);
  return {
    nOk: ok.length,
    nFail: runs.length - ok.length,
    successRate: runs.length ? ok.length / runs.length : null,
    kawnCalledRate: rate(m.map((x) => x.kawnCalled)),
    meanRecall: mean(m.map((x) => x.recall)),
    meanPrecision: mean(m.map((x) => x.precision)),
    meanDistinct: mean(m.map((x) => x.distinctFilesOpened)),
    meanToolCalls: mean(m.map((x) => x.toolCalls)),
    meanTtf: mean(m.map((x) => x.timeToFirstRelevantMs)),
    meanWall: mean(ok.map((r) => r.session?.wallMs)),
    meanInput: mean(ok.map((r) => r.session?.tokens?.input)),
    meanOutput: mean(ok.map((r) => r.session?.tokens?.output)),
    answerCorrectRate: rate(m.map((x) => x.answerCorrect)),
    testsPassedRate: rate(m.map((x) => x.testsPassed)),
    meanFilesChanged: mean(m.map((x) => x.filesChanged)),
    meanFilesOutsideGold: mean(m.map((x) => x.filesChangedOutsideGold)),
    // family A — KawnGraph pack quality (WITH only; identical across repeats)
    pack: packOf(ok),
  };
}

function packOf(okRuns) {
  const p = okRuns.find((r) => r.kawnPack)?.kawnPack;
  if (!p) return null;
  return {
    filesReturned: p.filesReturned,
    goldReturned: p.goldReturned,
    goldCount: p.goldCount,
    packRecall: p.packRecall,
    packPrecision: p.packPrecision,
    mustRead: p.mustReadCount,
    docs: p.docsReturned,
    tables: p.tablesReturned,
    tests: p.testsReturned,
    tokenEstimate: p.tokenEstimate,
    confidence: p.confidence,
    excluded: p.excludedCount,
  };
}

function deltas(side, kind, get) {
  const a = side.without ? get(side.without) : null;
  const b = side.with ? get(side.with) : null;
  if (a == null && b == null) return { without: null, with: null, deltaAbs: null, deltaPct: null, kind };
  const deltaAbs = a != null && b != null ? b - a : null;
  const deltaPct = a != null && b != null && a !== 0 ? (deltaAbs / Math.abs(a)) * 100 : null;
  const d = kind === "num" ? 2 : kind === "rate" ? 4 : 1;
  return {
    without: round(a, kind === "rate" ? 4 : d),
    with: round(b, kind === "rate" ? 4 : d),
    deltaAbs: round(deltaAbs, d),
    deltaPct: round(deltaPct, 1),
    kind,
  };
}

/**
 * Deterministic outcome label for a cell. Conservative on purpose:
 *  - Regressed  : agent did MORE work (tool calls up AND wall time up >5%).
 *  - Improved   : agent did LESS work (tool calls down AND wall time down >5%),
 *                 OR a clear discovery win (auto-invoked and recall not worse and
 *                 wall down >5%).
 *  - Neutral    : changes are small / mixed.
 *  - Insufficient data : a side is missing or has no ok runs.
 * Every cell here is n<5/arm, so the label is DIRECTIONAL, not significant.
 */
function outcomeLabel(cell) {
  const a = cell.metrics;
  const wall = a.wallMs, tc = a.toolCalls;
  if (!cell.nWith || !cell.nWithout) return "Insufficient data";
  if (wall.deltaPct == null || tc.deltaAbs == null) return "Insufficient data";
  const wallDown = wall.deltaPct <= -5;
  const wallUp = wall.deltaPct >= 5;
  const tcDown = tc.deltaAbs < 0;
  const tcUp = tc.deltaAbs > 0;
  if (wallUp && tcUp) return "Regressed";
  if (wallDown && tcDown) return "Improved";
  if (wallDown && !tcUp) return "Improved";
  if (wallUp && !tcDown) return "Regressed";
  return "Neutral";
}

// ---- main ------------------------------------------------------------------
const raw = JSON.parse(readFileSync(source, "utf8"));
const report = normalizeReport(raw);

// VALIDATE
const total = report.runs.length;
const failed = report.runs.filter((r) => !r.ok);
const invalidGold = report.runs.filter((r) => r.ok && !(r.metrics && r.metrics.goldCount >= 1));
const excludedKeys = new Set([...failed, ...invalidGold].map((r) => r));
const usable = report.runs.filter((r) => r.ok && r.metrics && r.metrics.goldCount >= 1);

// group into cells (project|task|agent|mode)
const cellsMap = new Map();
for (const r of usable) {
  const k = `${r.projectId} ${r.taskId} ${r.agent} ${r.mode}`;
  (cellsMap.get(k) ?? cellsMap.set(k, []).get(k)).push(r);
}

let minArm = Infinity;
const cells = [];
for (const [k, runs] of cellsMap) {
  const [projectId, taskId, agent, mode] = k.split(" ");
  const without = runs.filter((r) => r.condition === "without");
  const withh = runs.filter((r) => r.condition === "with");
  minArm = Math.min(minArm, without.length, withh.length);
  const side = { without: aggregateSide(without), with: aggregateSide(withh) };
  const isE2e = mode === "e2e";
  const metrics = {};
  for (const spec of METRICS) {
    if (spec.e2e && !isE2e) continue;
    metrics[spec.key] = { label: spec.label, ...deltas(side, spec.kind, spec.get) };
  }
  const cell = {
    projectId,
    taskId,
    agent,
    mode,
    nWithout: without.length,
    nWith: withh.length,
    exploratory: Math.min(without.length, withh.length) < 5,
    pack: side.with.pack,
    metrics,
  };
  cell.outcome = outcomeLabel(cell);
  cells.push(cell);
}
// stable order: agent, then project, then task, then mode
cells.sort(
  (a, b) =>
    a.agent.localeCompare(b.agent) ||
    a.projectId.localeCompare(b.projectId) ||
    a.taskId.localeCompare(b.taskId) ||
    a.mode.localeCompare(b.mode),
);

const commits = [...new Set(report.runs.map((r) => r.commit).filter(Boolean))];

// flagship headline cell per agent: the realistic external-project discovery task.
const HEADLINE_TASK = { projectId: "nextjs-supabase", taskId: "zid-oauth", mode: "retrieval" };
for (const c of cells) {
  c.headline =
    c.projectId === HEADLINE_TASK.projectId &&
    c.taskId === HEADLINE_TASK.taskId &&
    c.mode === HEADLINE_TASK.mode;
}

const summary = {
  schema: "kawngraph.benchmark.published/v1",
  generatedBy: "scripts/benchmark-publish.mjs",
  source: basename(source),
  kawnVersion: report.kawnVersion,
  createdAt: report.createdAt,
  commit: commits.length === 1 ? commits[0] : commits,
  seed: report.seed,
  repeat: report.repeat,
  mode: report.mode,
  agents: report.agents,
  env: report.env,
  validation: {
    totalRuns: total,
    okRuns: report.runs.filter((r) => r.ok).length,
    failedRuns: failed.length,
    runsWithInvalidGold: invalidGold.length,
    excludedRuns: excludedKeys.size,
    usableRuns: usable.length,
    minSamplePerArm: Number.isFinite(minArm) ? minArm : 0,
    exploratory: Number.isFinite(minArm) ? minArm < 5 : true,
    goldValidation: invalidGold.length === 0 ? "all runs have a valid gold reference" : `${invalidGold.length} run(s) excluded for invalid gold`,
    note: "n<5 per arm is exploratory — directional, not statistically significant. A/B is the SAME agent on the SAME task, with vs without KawnGraph. Δ = B − A.",
  },
  // safe subset of scan cost: project id + numbers only (no paths)
  scanCosts: report.scanCosts.map((s) => ({
    projectId: s.projectId === "athar-self" ? "kawn-self" : s.projectId,
    scanMs: s.scanMs,
    nodes: s.nodes,
    edges: s.edges,
    trackedFileCount: s.trackedFileCount,
  })),
  headlineTask: HEADLINE_TASK,
  cells,
};

mkdirSync(outDir, { recursive: true });
const date = report.createdAt.slice(0, 10);
const jsonPath = join(outDir, `campaign-${date}.summary.json`);
const mdPath = join(outDir, `campaign-${date}.md`);
writeFileSync(jsonPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
writeFileSync(mdPath, renderMarkdown(summary), "utf8");

console.log(`[benchmark-publish] source: ${basename(source)}`);
console.log(
  `[benchmark-publish] validated: ${summary.validation.usableRuns}/${summary.validation.totalRuns} runs usable, ` +
    `${summary.validation.excludedRuns} excluded, minArm=${summary.validation.minSamplePerArm} (${summary.validation.exploratory ? "exploratory" : "n>=5"})`,
);
console.log(`[benchmark-publish] wrote ${jsonPath}`);
console.log(`[benchmark-publish] wrote ${mdPath}`);

// ---- markdown rendering ----------------------------------------------------
function fmt(kind, x) {
  if (x == null) return "n/a";
  if (kind === "rate") return `${Math.round(x * 100)}%`;
  if (kind === "ms") return `${Math.round(x)} ms`;
  if (kind === "tok") return Math.round(x).toString();
  return (Math.round(x * 10) / 10).toString();
}
function fmtDelta(kind, m) {
  if (m.deltaAbs == null) return "n/a";
  const sign = (v) => (v > 0 ? "+" : "") + v;
  if (kind === "rate") {
    const pp = Math.round(m.deltaAbs * 100);
    return `${sign(pp)} pp`;
  }
  if (kind === "ms") return `${sign(Math.round(m.deltaAbs))} ms`;
  if (kind === "tok") return `${sign(Math.round(m.deltaAbs))}`;
  return `${sign(Math.round(m.deltaAbs * 10) / 10)}`;
}

function renderMarkdown(s) {
  const L = [];
  L.push(`# KawnGraph behavioral benchmark — published campaign`);
  L.push("");
  L.push(`> Generated by \`${s.generatedBy}\` from \`${s.source}\`. Do not edit by hand.`);
  L.push("");
  L.push(`- KawnGraph version: \`${s.kawnVersion}\``);
  L.push(`- Created: ${s.createdAt}`);
  L.push(`- Commit: \`${Array.isArray(s.commit) ? s.commit.map((c) => c.slice(0, 8)).join(", ") : String(s.commit).slice(0, 8)}\``);
  L.push(`- Seed: ${s.seed} · repeats: ${s.repeat} · mode: ${s.mode}`);
  L.push(`- Agents: ${s.agents.join(", ")}`);
  L.push(`- Environment: ${s.env.platform}, node ${s.env.node}`);
  L.push("");
  L.push(`## Validation`);
  L.push("");
  L.push(`| check | value |`);
  L.push(`| --- | --- |`);
  L.push(`| total runs | ${s.validation.totalRuns} |`);
  L.push(`| ok runs | ${s.validation.okRuns} |`);
  L.push(`| failed runs | ${s.validation.failedRuns} |`);
  L.push(`| runs with invalid gold (excluded) | ${s.validation.runsWithInvalidGold} |`);
  L.push(`| usable runs | ${s.validation.usableRuns} |`);
  L.push(`| smallest sample per arm | ${s.validation.minSamplePerArm} |`);
  L.push(`| statistical status | ${s.validation.exploratory ? "exploratory (n<5/arm — directional)" : "n≥5/arm"} |`);
  L.push(`| gold validation | ${s.validation.goldValidation} |`);
  L.push("");
  L.push(`> ${s.validation.note}`);
  L.push("");

  L.push(`## Graph scan cost (one-time, excluded from session timings)`);
  L.push("");
  L.push(`| project | scan time | nodes | edges | tracked files |`);
  L.push(`| --- | --- | --- | --- | --- |`);
  for (const c of s.scanCosts) {
    L.push(`| ${c.projectId} | ${c.scanMs} ms | ${c.nodes} | ${c.edges} | ${c.trackedFileCount} |`);
  }
  L.push("");

  // per-agent headline + every cell
  for (const agent of s.agents) {
    const agentCells = s.cells.filter((c) => c.agent === agent);
    if (!agentCells.length) continue;
    L.push(`## ${agent} — A/B by task`);
    L.push("");
    for (const c of agentCells) {
      L.push(
        `### ${c.projectId} — ${c.taskId} (${c.mode})${c.headline ? " — headline" : ""} — n: A=${c.nWithout} B=${c.nWith}${c.exploratory ? " — exploratory (n<5/arm)" : ""}`,
      );
      L.push(`Outcome: **${c.outcome}**`);
      L.push("");
      L.push(`| metric | A: without | B: with | Δ (B−A) |`);
      L.push(`| --- | --- | --- | --- |`);
      for (const [, m] of Object.entries(c.metrics)) {
        L.push(`| ${m.label} | ${fmt(m.kind, m.without)} | ${fmt(m.kind, m.with)} | ${fmtDelta(m.kind, m)} |`);
      }
      L.push("");
      if (c.pack) {
        L.push(
          `KawnGraph pack (family A — what KawnGraph returns, before any agent acts): ` +
            `${c.pack.filesReturned} files · gold ${c.pack.goldReturned}/${c.pack.goldCount} · ` +
            `recall ${fmt("rate", c.pack.packRecall)} · precision ${fmt("rate", c.pack.packPrecision)} · ` +
            `~${c.pack.tokenEstimate} tokens · confidence ${c.pack.confidence}.`,
        );
        L.push("");
      }
    }
  }

  L.push(`## Task-level findings (all cells)`);
  L.push("");
  L.push(`| task family | agent | mode | outcome | tool-call Δ | wall-time Δ | n/arm | notes |`);
  L.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
  for (const c of s.cells) {
    const tc = c.metrics.toolCalls;
    const wall = c.metrics.wallMs;
    const n = Math.min(c.nWithout, c.nWith);
    L.push(
      `| ${c.taskId} | ${c.agent} | ${c.mode} | ${c.outcome} | ${fmtDelta("num", tc)} | ${fmtDelta("ms", wall)} | ${n} | ${c.exploratory ? "exploratory" : ""} |`,
    );
  }
  L.push("");
  return L.join("\n");
}
