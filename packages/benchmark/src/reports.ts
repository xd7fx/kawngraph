/**
 * Report generation: JSON (full, machine-readable), CSV (one row per run), and a
 * human-readable Markdown summary that aggregates the A/B arms across repeats.
 *
 * Everything written here passes through redaction again (defense in depth) and
 * lands under the gitignored `benchmark-results/` directory.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { deepRedact, redact } from "./redact";
import type {
  AgentKind,
  AgentReadiness,
  KawnPackMetrics,
  BenchmarkReport,
  BenchmarkRun,
  Condition,
  ScanCost,
} from "./types";

export interface WrittenReports {
  json: string;
  csv: string;
  md: string;
}

function stamp(iso: string): string {
  return iso.replace(/[:.]/g, "-");
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

// ---- small formatting helpers ---------------------------------------------
function pct(x: number | null): string {
  return x == null ? "n/a" : `${Math.round(x * 100)}%`;
}
function n1(x: number | null): string {
  return x == null ? "n/a" : (Math.round(x * 10) / 10).toString();
}
function ms(x: number | null): string {
  return x == null ? "n/a" : `${Math.round(x)} ms`;
}
function tok(x: number | null): string {
  return x == null ? "n/a" : Math.round(x).toString();
}

function mean(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function rate(values: Array<boolean | null | undefined>): number | null {
  const defined = values.filter((v): v is boolean => typeof v === "boolean");
  if (defined.length === 0) return null;
  return defined.filter(Boolean).length / defined.length;
}

/** Distribution of a numeric metric over ok runs. sd is the SAMPLE stddev (n−1), null when n<2. */
interface Stat {
  n: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  sd: number | null;
}

function stats(values: Array<number | null | undefined>): Stat {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) return { n, mean: null, median: null, min: null, max: null, sd: null };
  const meanV = xs.reduce((a, b) => a + b, 0) / n;
  const mid = Math.floor(n / 2);
  const median = n % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  const sd = n >= 2 ? Math.sqrt(xs.reduce((a, b) => a + (b - meanV) ** 2, 0) / (n - 1)) : null;
  return { n, mean: meanV, median, min: xs[0], max: xs[n - 1], sd };
}

function num0(x: number | null): string {
  return x == null ? "n/a" : String(Math.round(x));
}

/** Unitless spread annotation `(med …, lo–hi, sd …)`; empty when n<2 (no meaningful spread). */
function spread(s: Stat): string {
  if (s.n < 2) return "";
  const parts = [`med ${num0(s.median)}`, `${num0(s.min)}–${num0(s.max)}`];
  if (s.sd != null) parts.push(`sd ${num0(s.sd)}`);
  return ` (${parts.join(", ")})`;
}

// ---- aggregation -----------------------------------------------------------
interface SideAgg {
  nOk: number;
  nFail: number;
  kawnCalledRate: number | null;
  kawnFirstRate: number | null;
  meanToolCalls: number | null;
  meanSearches: number | null;
  meanDistinct: number | null;
  meanIrrelevant: number | null;
  meanPrecision: number | null;
  meanRecall: number | null;
  meanNamedGold: number | null;
  meanTtf: number | null;
  meanWall: number | null;
  meanInput: number | null;
  meanOutput: number | null;
  answerCorrectRate: number | null;
  testsPassedRate: number | null;
  // family C — e2e edit boundary. null for retrieval (no edits to grade).
  meanFilesChanged: number | null;
  meanFilesOutsideGold: number | null;
  /** fraction of e2e runs whose edits stayed entirely within the gold boundary */
  e2eCleanRate: number | null;
  // distributions for the headline numeric metrics (median/min/max/sd when n permits)
  wall: Stat;
  outTokens: Stat;
  inTokens: Stat;
  distinct: Stat;
  toolCalls: Stat;
  changed: Stat;
}

function aggregateSide(runs: BenchmarkRun[]): SideAgg {
  const ok = runs.filter((r) => r.ok && r.metrics);
  const m = ok.map((r) => r.metrics!);
  return {
    nOk: ok.length,
    nFail: runs.length - ok.length,
    kawnCalledRate: rate(m.map((x) => x.kawnCalled)),
    kawnFirstRate: rate(m.map((x) => x.kawnFirst)),
    meanToolCalls: mean(m.map((x) => x.toolCalls)),
    meanSearches: mean(m.map((x) => x.searches)),
    meanDistinct: mean(m.map((x) => x.distinctFilesOpened)),
    meanIrrelevant: mean(m.map((x) => x.irrelevantFilesOpened)),
    meanPrecision: mean(m.map((x) => x.precision)),
    meanRecall: mean(m.map((x) => x.recall)),
    meanNamedGold: mean(m.map((x) => x.namedGoldCount)),
    meanTtf: mean(m.map((x) => x.timeToFirstRelevantMs)),
    meanWall: mean(ok.map((r) => r.session.wallMs)),
    meanInput: mean(ok.map((r) => r.session.tokens.input)),
    meanOutput: mean(ok.map((r) => r.session.tokens.output)),
    answerCorrectRate: rate(m.map((x) => x.answerCorrect)),
    testsPassedRate: rate(m.map((x) => x.testsPassed)),
    // e2e edit boundary: mean filters nulls, so retrieval runs (filesChanged=null)
    // contribute nothing and these stay null when no e2e run is present.
    meanFilesChanged: mean(m.map((x) => x.filesChanged)),
    meanFilesOutsideGold: mean(m.map((x) => x.filesChangedOutsideGold)),
    // clean = stayed inside the gold boundary. null-boundary runs (retrieval, or
    // e2e tasks with no gold) are excluded by rate(), never counted as a 0.
    e2eCleanRate: rate(m.map((x) => (x.filesChangedOutsideGold == null ? null : x.filesChangedOutsideGold === 0))),
    wall: stats(ok.map((r) => r.session.wallMs)),
    outTokens: stats(ok.map((r) => r.session.tokens.output)),
    inTokens: stats(ok.map((r) => r.session.tokens.input)),
    distinct: stats(m.map((x) => x.distinctFilesOpened)),
    toolCalls: stats(m.map((x) => x.toolCalls)),
    changed: stats(m.map((x) => x.filesChanged)),
  };
}

function groupKey(r: BenchmarkRun): string {
  return `${r.projectId}\u0000${r.taskId}\u0000${r.agent}`;
}

// ---- CSV -------------------------------------------------------------------
const CSV_HEADER = [
  "project", "task", "agent", "condition", "repeat", "mode", "commit", "model",
  "ok", "failure", "kawn_called", "kawn_first", "kawn_order", "tool_calls",
  "searches", "distinct_files", "irrelevant_files", "relevant_hit", "gold_count", "named_gold",
  // families B/C: agent behavior — opened_precision / found_recall are about what
  // the AGENT did, never about KawnGraph's pack (see pack_* columns below).
  "opened_precision", "found_recall", "ttf_ms", "answer_correct", "tests_passed",
  // family C — e2e edit boundary (null/blank for retrieval): how many files the
  // agent changed and how many strayed outside the task's gold boundary.
  "files_changed", "files_outside_gold", "wall_ms",
  "duration_ms", "input_tokens", "output_tokens", "cache_read", "reasoning_tokens", "cost",
  // family A: KawnGraph Context Pack quality (WITH runs only; blank for control)
  "pack_files", "pack_gold_returned", "pack_gold_count", "pack_precision", "pack_recall",
  "pack_must_read", "pack_docs", "pack_tables", "pack_tests", "pack_tokens",
  "pack_excluded", "pack_confidence",
];

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(runs: BenchmarkRun[]): string {
  const rows = [CSV_HEADER.join(",")];
  for (const r of runs) {
    const m = r.metrics;
    const p = r.kawnPack;
    rows.push(
      [
        r.projectId, r.taskId, r.agent, r.condition, r.repeat, r.mode,
        r.commit ?? "", r.model ?? "", r.ok, redact(r.failure ?? ""),
        m?.kawnCalled ?? "", m?.kawnFirst ?? "", m?.kawnOrder ?? "",
        m?.toolCalls ?? "", m?.searches ?? "", m?.distinctFilesOpened ?? "",
        m?.irrelevantFilesOpened ?? "", m?.relevantHit ?? "", m?.goldCount ?? "",
        m?.namedGoldCount ?? "",
        m?.precision ?? "", m?.recall ?? "", m?.timeToFirstRelevantMs ?? "",
        m?.answerCorrect ?? "", m?.testsPassed ?? "",
        m?.filesChanged ?? "", m?.filesChangedOutsideGold ?? "", r.session.wallMs,
        r.session.durationMs ?? "", r.session.tokens.input ?? "",
        r.session.tokens.output ?? "", r.session.tokens.cacheRead ?? "",
        r.session.tokens.reasoning ?? "", r.session.cost ?? "",
        p?.filesReturned ?? "", p?.goldReturned ?? "", p?.goldCount ?? "",
        p?.packPrecision ?? "", p?.packRecall ?? "", p?.mustReadCount ?? "",
        p?.docsReturned ?? "", p?.tablesReturned ?? "", p?.testsReturned ?? "",
        p?.tokenEstimate ?? "", p?.excludedCount ?? "", p?.confidence ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return rows.join("\n") + "\n";
}

// ---- Markdown --------------------------------------------------------------
function sideColumn(label: string, a: SideAgg | undefined): string[] {
  if (!a) return [`${label}`, "no runs"];
  const lines = [
    `**${label}** (n=${a.nOk} ok${a.nFail ? `, ${a.nFail} failed` : ""})`,
    `KawnGraph auto-invoked: ${pct(a.kawnCalledRate)} (first move ${pct(a.kawnFirstRate)})`,
    `tool calls: ${n1(a.meanToolCalls)} · searches: ${n1(a.meanSearches)}`,
    `files opened: ${n1(a.meanDistinct)} (irrelevant ${n1(a.meanIrrelevant)})${spread(a.distinct)}`,
    `opened precision: ${pct(a.meanPrecision)} · files found (opened/named): ${pct(a.meanRecall)}`,
    `gold named in answer: ${n1(a.meanNamedGold)}`,
    `time→first relevant: ${ms(a.meanTtf)} · wall: ${ms(a.meanWall)}${spread(a.wall)}`,
    `tokens in/out: ${tok(a.meanInput)} / ${tok(a.meanOutput)}${spread(a.outTokens)}`,
    `answer correct: ${pct(a.answerCorrectRate)} · tests passed: ${pct(a.testsPassedRate)}`,
  ];
  // e2e only: report the change boundary. meanFilesChanged is null for retrieval
  // (no edits), so this line appears solely for sessions that actually edited.
  if (a.meanFilesChanged != null) {
    lines.push(
      `files changed: ${n1(a.meanFilesChanged)} (outside boundary ${n1(a.meanFilesOutsideGold)}) · clean edits: ${pct(a.e2eCleanRate)}`,
    );
  }
  return lines;
}

/**
 * Family A section — KawnGraph Context Pack quality. Agent-independent and identical
 * across repeats, so it is deduplicated to one row per project+task. Rendered as
 * its OWN section, deliberately apart from the agent A/B table, so pack recall is
 * never confused with agent-opened-file recall.
 */
function kawnPackSection(report: BenchmarkReport, L: string[]): void {
  const seen = new Map<string, { run: BenchmarkRun; pack: KawnPackMetrics }>();
  for (const r of report.runs) {
    if (!r.kawnPack) continue;
    const k = `${r.projectId}\u0000${r.taskId}`;
    if (!seen.has(k)) seen.set(k, { run: r, pack: r.kawnPack });
  }
  L.push(`## KawnGraph Context Pack quality (family A — what KawnGraph returns, before any agent acts)`);
  if (seen.size === 0) {
    L.push(`_no WITH-condition runs — KawnGraph pack not evaluated_`);
    L.push("");
    return;
  }
  L.push(
    `Deterministic from the graph; identical across agents and repeats. This is KawnGraph's OWN retrieval quality — distinct from what an agent then chose to open (see the A/B table below).`,
  );
  L.push("");
  L.push(`| project | task | files | gold found | pack recall | pack precision | code/docs/tables/tests | ~tokens | conf | excluded |`);
  L.push(`| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`);
  for (const { run, pack } of seen.values()) {
    const buckets = `${pack.mustReadCount}/${pack.docsReturned}/${pack.tablesReturned}/${pack.testsReturned}`;
    L.push(
      `| ${run.projectId} | ${run.taskId} | ${pack.filesReturned} | ${pack.goldReturned}/${pack.goldCount} | ${pct(pack.packRecall)} | ${pct(pack.packPrecision)} | ${buckets} | ${tok(pack.tokenEstimate)} | ${pack.confidence} | ${pack.excludedCount} |`,
    );
  }
  L.push("");
  for (const { run, pack } of seen.values()) {
    if (pack.goldCount === 0) continue;
    const ranks = pack.goldRanks
      .map((g) => `\`${g.file}\` ${g.rank == null ? "—(absent)" : `#${g.rank}`}`)
      .join(", ");
    L.push(`- **${run.projectId}/${run.taskId}** gold rank in pack: ${ranks}`);
  }
  L.push("");
}

// ---- executive summary (A/B deltas) ---------------------------------------
/** Group runs by project+task+agent, preserving first-seen order. */
function groupRuns(report: BenchmarkReport): Map<string, BenchmarkRun[]> {
  const groups = new Map<string, BenchmarkRun[]>();
  for (const r of report.runs) {
    const k = groupKey(r);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  return groups;
}

type MetricKind = "rate" | "num" | "ms" | "tok";
interface ExecMetric {
  label: string;
  kind: MetricKind;
  get: (a: SideAgg) => number | null;
  /** only render for e2e groups (edit-boundary outcomes) */
  e2e?: boolean;
}

const EXEC_METRICS: ExecMetric[] = [
  { label: "success rate", kind: "rate", get: (a) => (a.nOk + a.nFail > 0 ? a.nOk / (a.nOk + a.nFail) : null) },
  { label: "KawnGraph auto-invoked", kind: "rate", get: (a) => a.kawnCalledRate },
  { label: "files found (opened/named)", kind: "rate", get: (a) => a.meanRecall },
  { label: "opened precision", kind: "rate", get: (a) => a.meanPrecision },
  { label: "files opened", kind: "num", get: (a) => a.meanDistinct },
  { label: "tool calls", kind: "num", get: (a) => a.meanToolCalls },
  { label: "time to first relevant (ms)", kind: "ms", get: (a) => a.meanTtf },
  { label: "wall (ms)", kind: "ms", get: (a) => a.meanWall },
  { label: "output tokens", kind: "tok", get: (a) => a.meanOutput },
  { label: "answer correct", kind: "rate", get: (a) => a.answerCorrectRate },
  { label: "tests passed", kind: "rate", get: (a) => a.testsPassedRate, e2e: true },
  { label: "files changed", kind: "num", get: (a) => a.meanFilesChanged, e2e: true },
  { label: "outside boundary", kind: "num", get: (a) => a.meanFilesOutsideGold, e2e: true },
  { label: "clean edits", kind: "rate", get: (a) => a.e2eCleanRate, e2e: true },
];

function fmtVal(kind: MetricKind, x: number | null): string {
  return kind === "rate" ? pct(x) : kind === "ms" ? ms(x) : kind === "tok" ? tok(x) : n1(x);
}

function signed(x: number, digits = 0): string {
  const f = 10 ** digits;
  const v = Math.round(x * f) / f;
  return (v > 0 ? "+" : "") + v;
}

/** Absolute + relative delta cells (B−A). Rate deltas are percentage points. */
function deltaCells(kind: MetricKind, a: number | null, b: number | null): [string, string] {
  if (a == null || b == null) return ["n/a", "n/a"];
  const abs = b - a;
  if (kind === "rate") {
    const rel = a !== 0 ? `${signed((abs / Math.abs(a)) * 100)}%` : "—";
    return [`${signed(abs * 100)} pp`, rel];
  }
  const absStr = kind === "num" ? signed(abs, 1) : signed(abs);
  const rel = a !== 0 ? `${signed((abs / Math.abs(a)) * 100)}%` : "—";
  return [absStr, rel];
}

function executiveSummary(report: BenchmarkReport, L: string[]): void {
  L.push(`## Executive summary`);
  L.push("");
  L.push(
    `A/B is the SAME agent on the SAME task, with vs without KawnGraph. Δ is B−A (signed; not labeled good/bad — ` +
      `lower is better for some metrics, higher for others). Rate deltas are in percentage points (pp); Δ% is ` +
      `relative to the without-KawnGraph baseline. Aggregates use ok runs only. ` +
      `**n<5 per arm is exploratory — directional, not statistically significant.**`,
  );
  L.push("");

  const groups = groupRuns(report);
  let any = false;
  for (const [, runs] of groups) {
    const first = runs[0];
    const a = runs.filter((r) => r.condition === "without");
    const b = runs.filter((r) => r.condition === "with");
    const without = a.length ? aggregateSide(a) : undefined;
    const withh = b.length ? aggregateSide(b) : undefined;
    if ((without?.nOk ?? 0) === 0 && (withh?.nOk ?? 0) === 0) continue; // nothing scored
    any = true;

    const ns = [without?.nOk, withh?.nOk].filter((x): x is number => typeof x === "number");
    const minN = ns.length ? Math.min(...ns) : 0;
    const flag = minN < 5 ? " — exploratory (n<5/arm)" : "";
    L.push(`### ${first.projectId} — ${first.taskId} — ${first.agent} (${first.mode}) — n: A=${without?.nOk ?? 0} B=${withh?.nOk ?? 0}${flag}`);
    L.push(`| metric | A: without | B: with | Δ (B−A) | Δ% |`);
    L.push(`| --- | --- | --- | --- | --- |`);
    const isE2e = (without?.meanFilesChanged ?? withh?.meanFilesChanged) != null || first.mode === "e2e";
    for (const spec of EXEC_METRICS) {
      if (spec.e2e && !isE2e) continue;
      const av = without ? spec.get(without) : null;
      const bv = withh ? spec.get(withh) : null;
      if (av == null && bv == null) continue;
      const [dAbs, dRel] = deltaCells(spec.kind, av, bv);
      L.push(`| ${spec.label} | ${fmtVal(spec.kind, av)} | ${fmtVal(spec.kind, bv)} | ${dAbs} | ${dRel} |`);
    }
    L.push("");
  }
  if (!any) {
    L.push(`_no ok sessions to summarize — see failures below_`);
    L.push("");
  }
}

function toMarkdown(report: BenchmarkReport): string {
  const L: string[] = [];
  L.push(`# KawnGraph behavioral benchmark`);
  L.push("");
  L.push(`- KawnGraph version: ${report.kawnVersion}`);
  L.push(`- Created: ${report.createdAt}`);
  L.push(`- Seed: ${report.seed} · repeats: ${report.repeat} · mode: ${report.mode}`);
  L.push(`- Agents: ${report.agents.join(", ")}`);
  L.push(`- Environment: ${report.env.platform}, node ${report.env.node}`);
  L.push("");

  executiveSummary(report, L);

  L.push(`## Authentication readiness`);
  for (const r of report.readiness) {
    const status = !r.installed ? "MISSING" : r.authenticated === true ? "READY" : r.authenticated === false ? "NOT LOGGED IN" : "INSTALLED (auth unverified)";
    L.push(`- **${r.agent}**: ${status} — ${r.detail}${r.remediation ? ` _(${r.remediation})_` : ""}`);
  }
  L.push("");

  L.push(`## Graph scan cost (one-time setup, excluded from session timings)`);
  if (report.scanCosts.length === 0) {
    L.push(`_none_`);
  } else {
    L.push(`| project | scan time | nodes | edges | tracked files |`);
    L.push(`| --- | --- | --- | --- | --- |`);
    for (const s of report.scanCosts) {
      L.push(`| ${s.projectId} | ${ms(s.scanMs)} | ${s.nodes} | ${s.edges} | ${s.trackedFileCount} |`);
    }
  }
  L.push("");

  kawnPackSection(report, L);

  // group by project+task+agent, render WITHOUT vs WITH side by side
  const groups = groupRuns(report);

  L.push(`## Results (A: without KawnGraph  vs  B: with KawnGraph)`);
  L.push("");
  for (const [, runs] of groups) {
    const first = runs[0];
    const byCond = (c: Condition): SideAgg | undefined => {
      const sub = runs.filter((r) => r.condition === c);
      return sub.length ? aggregateSide(sub) : undefined;
    };
    L.push(`### ${first.projectId} — ${first.taskId} — ${first.agent} (${first.mode})`);
    if (first.commit) L.push(`commit \`${first.commit.slice(0, 8)}\`${first.model ? ` · model ${first.model}` : ""}`);
    L.push("");
    const without = sideColumn("A — WITHOUT KawnGraph", byCond("without"));
    const withh = sideColumn("B — WITH KawnGraph", byCond("with"));
    const rowCount = Math.max(without.length, withh.length);
    L.push(`| A — without KawnGraph | B — with KawnGraph |`);
    L.push(`| --- | --- |`);
    for (let i = 0; i < rowCount; i++) {
      L.push(`| ${without[i] ?? ""} | ${withh[i] ?? ""} |`);
    }
    L.push("");
  }

  const failures = report.runs.filter((r) => !r.ok);
  if (failures.length > 0) {
    L.push(`## Failed sessions (no metrics scored — by design)`);
    for (const f of failures) {
      L.push(`- ${f.agent}/${f.condition} · ${f.projectId}/${f.taskId} (repeat ${f.repeat}): ${redact(f.failure ?? "unknown")}`);
    }
    L.push("");
  }

  const notes = new Set(report.runs.map((r) => r.session.note).filter((x): x is string => !!x));
  if (notes.size > 0) {
    L.push(`## Notes`);
    for (const note of notes) L.push(`- ${note}`);
    L.push("");
  }

  return L.join("\n");
}

// ---- merge -----------------------------------------------------------------
/**
 * Combine several benchmark reports into one coherent report. A single full
 * campaign (repeat≥3 across several tasks/agents) far exceeds one process budget,
 * so it is run in cap-sized chunks; this stitches the chunks back into a single,
 * honestly-aggregated report (and will be how external/large projects are run).
 *
 * - `runs` are concatenated, then their 1-based `repeat` index is renumbered per
 *   (project,task,agent,condition) arm in stable order, so the merged dataset
 *   reads as one run rather than N chunks that each restarted at repeat 1.
 * - `scanCosts` dedup by project (the per-project scan is identical each chunk);
 *   `readiness`/`agents` are unioned; `mode` collapses to a single value or
 *   "mixed"; `repeat` reports the deepest per-arm sample count.
 * - Refuses to merge across KawnGraph versions — combining incompatible runs would
 *   misrepresent what was measured.
 *
 * Pure: it never reads or writes the filesystem and does not mutate its inputs.
 */
export function mergeReports(reports: BenchmarkReport[]): BenchmarkReport {
  if (reports.length === 0) throw new Error("mergeReports: nothing to merge (no reports given).");
  const versions = new Set(reports.map((r) => r.kawnVersion));
  if (versions.size > 1) {
    throw new Error(
      `mergeReports: refusing to merge across KawnGraph versions (${[...versions].join(", ")}). ` +
        `Re-run every chunk on one build so the combined report measures a single KawnGraph.`,
    );
  }

  // Concatenate, then renumber repeat per arm in stable (chunk, then in-chunk) order.
  const perArm = new Map<string, number>();
  const runs: BenchmarkRun[] = [];
  for (const rep of reports) {
    for (const run of rep.runs) {
      const arm = `${run.projectId}\u0000${run.taskId}\u0000${run.agent}\u0000${run.condition}`;
      const next = (perArm.get(arm) ?? 0) + 1;
      perArm.set(arm, next);
      runs.push({ ...run, repeat: next });
    }
  }

  const scanCosts: ScanCost[] = [];
  const seenScan = new Set<string>();
  for (const rep of reports) {
    for (const s of rep.scanCosts) {
      if (seenScan.has(s.projectId)) continue;
      seenScan.add(s.projectId);
      scanCosts.push(s);
    }
  }

  const readiness: AgentReadiness[] = [];
  const seenAgent = new Set<string>();
  for (const rep of reports) {
    for (const a of rep.readiness) {
      if (seenAgent.has(a.agent)) continue;
      seenAgent.add(a.agent);
      readiness.push(a);
    }
  }

  const agents = [...new Set(runs.map((r) => r.agent))] as AgentKind[];
  const modes = new Set(runs.map((r) => r.mode));
  // deepest per-arm sample count = the effective repeat depth after merging
  const repeat = perArm.size ? Math.max(...perArm.values()) : 0;

  return {
    kawnVersion: reports[0].kawnVersion,
    createdAt: new Date().toISOString(),
    seed: reports[0].seed,
    mode: modes.size === 1 ? [...modes][0] : "mixed",
    repeat,
    agents,
    readiness,
    scanCosts,
    runs,
    env: reports[0].env,
  };
}

/** Read a benchmark report JSON from disk (throws a clear error on malformed input). */
export function readReportFile(file: string): BenchmarkReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`not a readable benchmark report: ${file} (${(e as Error).message})`);
  }
  const r = parsed as Partial<BenchmarkReport>;
  if (!r || !Array.isArray(r.runs) || typeof r.kawnVersion !== "string") {
    throw new Error(`not a valid benchmark report (missing runs[]/kawnVersion): ${file}`);
  }
  return r as BenchmarkReport;
}

// ---- public API ------------------------------------------------------------
/**
 * Write JSON + CSV + Markdown for a report. All content is redacted. Returns
 * paths. `baseName` overrides the file stem (merged reports use `merged-…` so a
 * later `benchmark-*.json` glob never accidentally re-merges a merged report).
 */
export function writeReports(report: BenchmarkReport, outDir: string, baseName?: string): WrittenReports {
  ensureDir(outDir);
  const base = baseName ?? `benchmark-${stamp(report.createdAt)}`;
  const safe = deepRedact(report);
  const json = path.join(outDir, `${base}.json`);
  const csv = path.join(outDir, `${base}.csv`);
  const md = path.join(outDir, `${base}.md`);
  fs.writeFileSync(json, JSON.stringify(safe, null, 2) + "\n", "utf8");
  fs.writeFileSync(csv, toCsv(report.runs), "utf8");
  fs.writeFileSync(md, toMarkdown(report), "utf8");
  return { json, csv, md };
}

/** Persist one run's raw transcript (redacted again) under outDir/transcripts/. */
export function writeTranscript(outDir: string, run: BenchmarkRun, transcript: string): string {
  const dir = path.join(outDir, "transcripts");
  ensureDir(dir);
  const name = `${run.projectId}__${run.taskId}__${run.agent}__${run.condition}__r${run.repeat}`.replace(/[^A-Za-z0-9_.-]/g, "-");
  const file = path.join(dir, `${name}.txt`);
  fs.writeFileSync(file, redact(transcript), "utf8");
  return file;
}

// exported for tests
export { toCsv, toMarkdown, aggregateSide };
