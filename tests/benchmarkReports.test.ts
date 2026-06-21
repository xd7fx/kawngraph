import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { toCsv, toMarkdown, aggregateSide, writeReports, mergeReports, readReportFile } from "@kawngraph/benchmark";
import type {
  AgentReadiness,
  KawnPackMetrics,
  BenchmarkReport,
  BenchmarkRun,
  NormalizedSession,
  RunMetrics,
  ScanCost,
} from "@kawngraph/benchmark";
import { mkTmp } from "./helpers";

const SECRET = "sk-ant-oat01-ABCDEFGH12345678";

const CSV_HEADER =
  "project,task,agent,condition,repeat,mode,commit,model,ok,failure,kawn_called,kawn_first," +
  "kawn_order,tool_calls,searches,distinct_files,irrelevant_files,relevant_hit,gold_count,named_gold," +
  "opened_precision,found_recall,ttf_ms,answer_correct,tests_passed,files_changed,files_outside_gold,wall_ms,duration_ms," +
  "input_tokens,output_tokens,cache_read,reasoning_tokens,cost," +
  "pack_files,pack_gold_returned,pack_gold_count,pack_precision,pack_recall," +
  "pack_must_read,pack_docs,pack_tables,pack_tests,pack_tokens,pack_excluded,pack_confidence";

function metrics(p: Partial<RunMetrics> = {}): RunMetrics {
  return {
    kawnCalled: false,
    kawnFirst: false,
    kawnOrder: null,
    toolCalls: 0,
    searches: 0,
    distinctFilesOpened: 0,
    irrelevantFilesOpened: 0,
    relevantHit: 0,
    goldCount: 0,
    precision: null,
    recall: null,
    timeToFirstRelevantMs: null,
    namedGoldCount: 0,
    answerCorrect: null,
    testsPassed: null,
    filesChanged: null,
    filesChangedOutsideGold: null,
    ...p,
  };
}

function sess(p: Partial<NormalizedSession> = {}): NormalizedSession {
  return {
    agent: "claude",
    condition: "with",
    ok: true,
    wallMs: 1000,
    durationMs: null,
    tools: [],
    tokens: { input: null, output: null, cacheRead: null, cacheCreate: null },
    numTurns: null,
    answer: "",
    cost: null,
    ...p,
  };
}

function run(p: Partial<BenchmarkRun> = {}): BenchmarkRun {
  const base: BenchmarkRun = {
    projectId: "demo",
    taskId: "t1",
    agent: "claude",
    condition: "with",
    repeat: 1,
    mode: "retrieval",
    commit: "0123456789abcdef0123456789abcdef01234567",
    model: null,
    ok: true,
    metrics: metrics(),
    session: sess(),
    startedAt: "2026-01-01T00:00:00.000Z",
  };
  return { ...base, ...p };
}

function makeReport(p: Partial<BenchmarkReport> = {}): BenchmarkReport {
  const readiness: AgentReadiness = {
    agent: "claude",
    installed: true,
    binPath: "/usr/bin/claude",
    authenticated: true,
    detail: "ready",
  };
  const scan: ScanCost = { projectId: "demo", scanMs: 1200, nodes: 10, edges: 5, trackedFileCount: 4 };
  return {
    kawnVersion: "0.1.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    seed: 1,
    mode: "retrieval",
    repeat: 3,
    agents: ["claude"],
    readiness: [readiness],
    scanCosts: [scan],
    runs: [run()],
    env: { platform: "test/x64", node: "v22" },
    ...p,
  };
}

// ---------------------------------------------------------------------------
// aggregateSide: per-arm means/rates over ok runs only.
// ---------------------------------------------------------------------------

test("aggregateSide averages ok runs and excludes failed ones", () => {
  const r1 = run({
    metrics: metrics({ kawnCalled: true, precision: 0.5, distinctFilesOpened: 2 }),
    session: sess({ wallMs: 1000, tokens: { input: 100, output: 50, cacheRead: null, cacheCreate: null } }),
  });
  const r2 = run({
    metrics: metrics({ kawnCalled: true, precision: 1.0, distinctFilesOpened: 4 }),
    session: sess({ wallMs: 2000, tokens: { input: 200, output: 100, cacheRead: null, cacheCreate: null } }),
  });
  const rf = run({ ok: false, metrics: null, session: sess({ ok: false, wallMs: 0 }) });

  const agg = aggregateSide([r1, r2, rf]);
  assert.equal(agg.nOk, 2);
  assert.equal(agg.nFail, 1);
  assert.equal(agg.kawnCalledRate, 1);
  assert.equal(agg.meanPrecision, 0.75);
  assert.equal(agg.meanDistinct, 3);
  assert.equal(agg.meanWall, 1500);
  assert.equal(agg.meanInput, 150);
});

function pack(p: Partial<KawnPackMetrics> = {}): KawnPackMetrics {
  return {
    filesReturned: 5,
    goldReturned: 2,
    goldCount: 3,
    packPrecision: 2 / 5,
    packRecall: 2 / 3,
    goldRanks: [
      { file: "src/lib/oauth.ts", rank: 2 },
      { file: "src/app/callback/route.ts", rank: 1 },
      { file: "src/missing/ghost.ts", rank: null },
    ],
    mustReadCount: 2,
    docsReturned: 1,
    tablesReturned: 1,
    testsReturned: 1,
    tokenEstimate: 3200,
    excludedCount: 4,
    confidence: 0.8,
    ...p,
  };
}

// ---------------------------------------------------------------------------
// CSV: stable schema (B/C + family-A pack columns), escaping, and redaction.
// ---------------------------------------------------------------------------

test("toCsv emits the stable header, one row per run, escaped + redacted", () => {
  const ok = run({
    metrics: metrics({ kawnCalled: true, toolCalls: 3, precision: 0.5, recall: 0.66 }),
    kawnPack: pack(),
    session: sess({ wallMs: 1234, tokens: { input: 100, output: 40, cacheRead: 10, cacheCreate: null, reasoning: 7 } }),
  });
  const failed = run({
    condition: "without",
    ok: false,
    metrics: null,
    failure: `HTTP 401, token ${SECRET} invalid`,
    session: sess({ ok: false, wallMs: 5 }),
  });

  const csv = toCsv([ok, failed]);
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], CSV_HEADER, "header schema is stable (B/C metrics + family-A pack columns)");
  assert.equal(lines.length, 3, "header + 2 data rows");
  assert.equal(lines[0].split(",").length, lines[1].split(",").length, "every data row has exactly the header's columns");
  assert.ok(csv.includes('"HTTP 401, token ***REDACTED*** invalid"'), "comma-bearing failure is quoted + redacted");
  assert.ok(!csv.includes("ABCDEFGH"), "no token survives in the CSV");
});

// ---------------------------------------------------------------------------
// Markdown: all sections render; secrets in failures are redacted.
// ---------------------------------------------------------------------------

test("toMarkdown renders every section and redacts secrets", () => {
  const report = makeReport({
    runs: [
      run({ condition: "without" }),
      run({ condition: "with", session: sess({ note: "Codex adapter is best-effort (unverified)." }) }),
      run({ condition: "with", ok: false, metrics: null, repeat: 2, failure: `boom ${SECRET}` }),
    ],
  });
  const md = toMarkdown(report);

  assert.match(md, /# KawnGraph behavioral benchmark/);
  assert.match(md, /## Authentication readiness/);
  assert.match(md, /## Graph scan cost/);
  assert.ok(md.includes("## Results (A: without KawnGraph"), "A/B results header");
  assert.ok(md.includes("### demo — t1 — claude (retrieval)"), "per-group heading");
  assert.match(md, /## Failed sessions/);
  assert.match(md, /## Notes/);
  assert.ok(md.includes("Codex adapter is best-effort"), "honesty note surfaced");
  assert.ok(!md.includes("ABCDEFGH"), "token in a failure is redacted in the markdown");
});

test("toMarkdown renders the KawnGraph Context Pack section separate from agent recall", () => {
  const report = makeReport({
    runs: [
      run({ condition: "without" }),
      run({ condition: "with", kawnPack: pack() }),
    ],
  });
  const md = toMarkdown(report);

  assert.ok(md.includes("## KawnGraph Context Pack quality"), "family A has its own section");
  assert.ok(md.includes("pack recall"), "pack recall is labeled as the pack's, not the agent's");
  assert.ok(md.includes("files found (opened/named)"), "agent recall is relabeled, never called 'KawnGraph recall'");
  assert.ok(md.includes("gold rank in pack"), "per-gold rank within the pack is reported");
  assert.ok(md.includes("—(absent)"), "a gold file missing from the pack is shown as absent, not rank 0");
});

test("toMarkdown notes when no WITH run produced an KawnGraph pack", () => {
  const report = makeReport({ runs: [run({ condition: "without", kawnPack: null })] });
  const md = toMarkdown(report);
  assert.ok(md.includes("KawnGraph pack not evaluated"), "absence of pack data is stated, not faked");
});

// ---------------------------------------------------------------------------
// Statistics — distributions (median/min/max/sample stddev) + executive deltas.
// ---------------------------------------------------------------------------

test("aggregateSide reports per-metric distributions (median/min/max/sample stddev)", () => {
  const mk = (wall: number, opened: number) =>
    run({ metrics: metrics({ distinctFilesOpened: opened }), session: sess({ wallMs: wall }) });
  const agg = aggregateSide([mk(1000, 2), mk(2000, 4), mk(3000, 6)]);

  assert.deepEqual(
    { n: agg.wall.n, mean: agg.wall.mean, median: agg.wall.median, min: agg.wall.min, max: agg.wall.max, sd: agg.wall.sd },
    { n: 3, mean: 2000, median: 2000, min: 1000, max: 3000, sd: 1000 },
    "wall distribution: sample stddev uses n−1",
  );
  assert.equal(agg.distinct.median, 4);
  assert.equal(agg.distinct.sd, 2);

  // a single run has no spread → stddev is null, never a misleading 0
  const one = aggregateSide([mk(1500, 3)]);
  assert.equal(one.wall.n, 1);
  assert.equal(one.wall.sd, null, "n<2 → stddev n/a, not 0");
  assert.equal(one.wall.median, 1500);
});

test("toMarkdown renders an executive summary with signed A/B deltas and an exploratory flag", () => {
  const report = makeReport({
    runs: [
      run({ condition: "without", metrics: metrics({ recall: 0.5, distinctFilesOpened: 8 }), session: sess({ condition: "without", wallMs: 1000 }) }),
      run({ condition: "without", metrics: metrics({ recall: 0.5, distinctFilesOpened: 8 }), session: sess({ condition: "without", wallMs: 1000 }) }),
      run({ condition: "with", metrics: metrics({ kawnCalled: true, recall: 1.0, distinctFilesOpened: 4 }), session: sess({ wallMs: 500 }) }),
      run({ condition: "with", metrics: metrics({ kawnCalled: true, recall: 1.0, distinctFilesOpened: 4 }), session: sess({ wallMs: 500 }) }),
    ],
  });
  const md = toMarkdown(report);
  assert.ok(md.includes("## Executive summary"), "executive summary section is present");
  assert.ok(md.includes("exploratory (n<5/arm)"), "small-n groups are flagged exploratory");
  // recall 50% → 100%: +50 percentage points, +100% relative
  assert.match(md, /files found \(opened\/named\) \| 50% \| 100% \| \+50 pp \| \+100% \|/);
  // wall 1000 → 500 ms: −500 absolute, −50% relative
  assert.match(md, /wall \(ms\) \| 1000 ms \| 500 ms \| -500 \| -50% \|/);
  // a rate whose baseline is 0 cannot have a relative %, shown as "—"
  assert.match(md, /KawnGraph auto-invoked \| 0% \| 100% \| \+100 pp \| — \|/);
});

test("the executive summary shows edit-boundary rows only for e2e", () => {
  const e2e = makeReport({
    mode: "e2e",
    runs: [run({ mode: "e2e", condition: "with", metrics: metrics({ testsPassed: true, filesChanged: 2, filesChangedOutsideGold: 0 }) })],
  });
  const md = toMarkdown(e2e);
  const exec = md.slice(md.indexOf("## Executive summary"), md.indexOf("## Authentication"));
  assert.ok(exec.includes("| tests passed |"), "e2e exec shows tests passed");
  assert.ok(exec.includes("| files changed |"), "e2e exec shows the change count");
  assert.ok(exec.includes("| clean edits |"), "e2e exec shows the clean-edit rate");

  const retr = toMarkdown(makeReport({ runs: [run({ condition: "with" })] }));
  const rexec = retr.slice(retr.indexOf("## Executive summary"), retr.indexOf("## Authentication"));
  assert.ok(!rexec.includes("| files changed |"), "retrieval exec omits edit-boundary rows");
});

// ---------------------------------------------------------------------------
// Family C — e2e edit boundary aggregates only over runs that actually edited.
// ---------------------------------------------------------------------------

test("aggregateSide summarizes the e2e change boundary and clean-edit rate", () => {
  const clean = run({
    mode: "e2e",
    metrics: metrics({ filesChanged: 2, filesChangedOutsideGold: 0, namedGoldCount: 1 }),
  });
  const messy = run({
    mode: "e2e",
    metrics: metrics({ filesChanged: 4, filesChangedOutsideGold: 2, namedGoldCount: 0 }),
  });
  const agg = aggregateSide([clean, messy]);
  assert.equal(agg.meanFilesChanged, 3, "(2 + 4) / 2");
  assert.equal(agg.meanFilesOutsideGold, 1, "(0 + 2) / 2");
  assert.equal(agg.e2eCleanRate, 0.5, "one of two stayed inside the boundary");
  assert.equal(agg.meanNamedGold, 0.5);
});

test("aggregateSide leaves e2e boundary fields null for retrieval-only runs", () => {
  const agg = aggregateSide([run({ mode: "retrieval", metrics: metrics({ recall: 1 }) })]);
  assert.equal(agg.meanFilesChanged, null, "retrieval has no edits to grade");
  assert.equal(agg.meanFilesOutsideGold, null);
  assert.equal(agg.e2eCleanRate, null, "no edit boundary → n/a, never a misleading 0%");
});

test("toMarkdown shows the change-boundary line for e2e and hides it for retrieval", () => {
  const e2e = makeReport({
    mode: "e2e",
    runs: [
      run({ mode: "e2e", condition: "with", metrics: metrics({ filesChanged: 2, filesChangedOutsideGold: 0 }) }),
    ],
  });
  assert.ok(toMarkdown(e2e).includes("files changed:"), "e2e renders the edit boundary");
  assert.ok(toMarkdown(e2e).includes("clean edits:"), "e2e renders the clean-edit rate");

  const retrieval = makeReport({ runs: [run({ mode: "retrieval", condition: "with" })] });
  assert.ok(!toMarkdown(retrieval).includes("files changed:"), "retrieval omits the edit boundary");
});

// ---------------------------------------------------------------------------
// writeReports: writes JSON+CSV+MD, all deep-redacted, under outDir.
// ---------------------------------------------------------------------------

test("writeReports writes three redacted files and returns their paths", () => {
  const outDir = mkTmp("kawn-bench-out-");
  try {
    const report = makeReport({
      runs: [run({ session: sess({ answer: `the secret is ${SECRET} ok` }) })],
    });
    const w = writeReports(report, outDir);
    assert.ok(fs.existsSync(w.json) && fs.existsSync(w.csv) && fs.existsSync(w.md), "all three files exist");

    const json = fs.readFileSync(w.json, "utf8");
    assert.ok(!json.includes("ABCDEFGH"), "token never reaches the written JSON");
    assert.ok(json.includes("***REDACTED***"), "redaction marker present");
    const parsed = JSON.parse(json) as BenchmarkReport;
    assert.ok(parsed.runs[0].session.answer.includes("***REDACTED***"), "answer field is redacted in place");
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// mergeReports: stitch chunked runs into one report without fabricating data.
// ---------------------------------------------------------------------------

test("mergeReports concatenates runs and renumbers repeat per arm", () => {
  const a = makeReport({ runs: [run({ repeat: 1, condition: "with" }), run({ repeat: 1, condition: "without" })] });
  const b = makeReport({ runs: [run({ repeat: 1, condition: "with" }), run({ repeat: 1, condition: "without" })] });

  const m = mergeReports([a, b]);
  assert.equal(m.runs.length, 4, "all runs from both chunks survive");

  const withReps = m.runs.filter((r) => r.condition === "with").map((r) => r.repeat).sort();
  const withoutReps = m.runs.filter((r) => r.condition === "without").map((r) => r.repeat).sort();
  assert.deepEqual(withReps, [1, 2], "the WITH arm is renumbered 1..2 across chunks");
  assert.deepEqual(withoutReps, [1, 2], "the WITHOUT arm is renumbered independently");
  assert.equal(m.repeat, 2, "report.repeat reflects the deepest per-arm sample count");
});

test("mergeReports unions agents/readiness, dedups scanCosts, and marks mixed modes", () => {
  const claudeReadiness: AgentReadiness = { agent: "claude", installed: true, binPath: "/c", authenticated: true, detail: "ok" };
  const codexReadiness: AgentReadiness = { agent: "codex", installed: true, binPath: "/x", authenticated: true, detail: "ok" };
  const a = makeReport({
    mode: "retrieval",
    agents: ["claude"],
    readiness: [claudeReadiness],
    scanCosts: [{ projectId: "demo", scanMs: 1, nodes: 1, edges: 1, trackedFileCount: 1 }],
    runs: [run({ agent: "claude", mode: "retrieval" })],
  });
  const b = makeReport({
    mode: "e2e",
    agents: ["codex"],
    readiness: [codexReadiness],
    scanCosts: [{ projectId: "demo", scanMs: 999, nodes: 9, edges: 9, trackedFileCount: 9 }],
    runs: [run({ agent: "codex", mode: "e2e" })],
  });

  const m = mergeReports([a, b]);
  assert.deepEqual([...m.agents].sort(), ["claude", "codex"], "agents union derives from runs");
  assert.deepEqual(m.readiness.map((r) => r.agent).sort(), ["claude", "codex"], "readiness union by agent");
  assert.equal(m.scanCosts.length, 1, "scanCosts deduped by projectId");
  assert.equal(m.scanCosts[0].scanMs, 1, "first chunk's scan wins on dedup");
  assert.equal(m.mode, "mixed", "differing modes collapse to a single 'mixed' label");
});

test("mergeReports preserves a single shared mode and first-report metadata", () => {
  const a = makeReport({ mode: "retrieval", seed: 7, kawnVersion: "0.1.0", runs: [run({ mode: "retrieval" })] });
  const b = makeReport({ mode: "retrieval", seed: 99, runs: [run({ mode: "retrieval" })] });

  const m = mergeReports([a, b]);
  assert.equal(m.mode, "retrieval", "a shared mode is kept, not relabeled 'mixed'");
  assert.equal(m.seed, 7, "seed comes from the first chunk");
  assert.equal(m.kawnVersion, "0.1.0");
  assert.ok(typeof m.createdAt === "string" && m.createdAt.length > 0, "merged report is stamped fresh");
});

test("mergeReports refuses empty input and version mismatches (never silently averages)", () => {
  assert.throws(() => mergeReports([]), /nothing to merge/);
  assert.throws(
    () => mergeReports([makeReport({ kawnVersion: "0.1.0" }), makeReport({ kawnVersion: "0.2.0" })]),
    /across KawnGraph versions/,
    "merging different KawnGraph builds is rejected, not blended",
  );
});

// ---------------------------------------------------------------------------
// readReportFile + baseName: disk round-trip and merged-* naming.
// ---------------------------------------------------------------------------

test("readReportFile round-trips a written report and rejects malformed input", () => {
  const outDir = mkTmp("kawn-bench-read-");
  try {
    const w = writeReports(makeReport(), outDir);
    const back = readReportFile(w.json);
    assert.equal(back.kawnVersion, "0.1.0");
    assert.ok(Array.isArray(back.runs) && back.runs.length === 1, "runs survive the round-trip");

    const bad = path.join(outDir, "bad.json");
    fs.writeFileSync(bad, "{ not json", "utf8");
    assert.throws(() => readReportFile(bad), /not a readable benchmark report/);

    const incomplete = path.join(outDir, "incomplete.json");
    fs.writeFileSync(incomplete, JSON.stringify({ kawnVersion: "0.1.0" }), "utf8");
    assert.throws(() => readReportFile(incomplete), /missing runs\[\]\/kawnVersion/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("writeReports honors an explicit baseName (merged-* outputs) and round-trips", () => {
  const outDir = mkTmp("kawn-bench-base-");
  try {
    const merged = mergeReports([makeReport()]);
    const w = writeReports(merged, outDir, "merged-XYZ");
    assert.ok(w.json.endsWith("merged-XYZ.json"), "json uses the explicit base name");
    assert.ok(w.csv.endsWith("merged-XYZ.csv"), "csv uses the explicit base name");
    assert.ok(w.md.endsWith("merged-XYZ.md"), "md uses the explicit base name");
    assert.equal(readReportFile(w.json).runs.length, merged.runs.length, "merged JSON reads back intact");
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
