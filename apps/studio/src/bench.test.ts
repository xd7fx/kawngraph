/**
 * Headless unit tests for the Bench aggregation + honest formatting core.
 *
 * These run under the root `node --test` harness (compiled by
 * apps/studio/tsconfig.test.json). They lock down the two properties that make
 * the Bench view trustworthy: the six families stay separable, and a missing
 * value is ALWAYS "n/a" — never silently rendered as 0.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXPLORATORY_THRESHOLD,
  fmtDelta,
  fmtMetric,
  mean,
  rate,
  summarizeBench,
} from "./lib/bench";
import type {
  BenchPackMetrics,
  BenchReport,
  BenchRun,
  BenchRunMetrics,
  BenchSession,
  BenchTokenUsage,
} from "./types";

// ---- fixtures --------------------------------------------------------------

function tokens(p: Partial<BenchTokenUsage> = {}): BenchTokenUsage {
  return { input: null, output: null, cacheRead: null, cacheCreate: null, reasoning: null, ...p };
}

function session(p: Partial<BenchSession> = {}): BenchSession {
  return {
    agent: "claude",
    condition: "with",
    ok: true,
    wallMs: 1000,
    durationMs: 900,
    tokens: tokens(),
    numTurns: 3,
    cost: null,
    ...p,
  };
}

function metrics(p: Partial<BenchRunMetrics> = {}): BenchRunMetrics {
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

function run(p: Partial<BenchRun> = {}): BenchRun {
  const cond = p.condition ?? "with";
  return {
    projectId: "proj",
    taskId: "task",
    agent: "claude",
    condition: cond,
    repeat: 0,
    mode: "retrieval",
    commit: null,
    model: null,
    ok: true,
    metrics: metrics(),
    session: session({ condition: cond }),
    startedAt: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

function report(runs: BenchRun[], extra: Partial<BenchReport> = {}): BenchReport {
  return {
    kawnVersion: "1.0.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    seed: 1,
    mode: "mixed",
    repeat: 3,
    agents: ["claude"],
    readiness: [],
    scanCosts: [],
    runs,
    env: { platform: "test", node: "v22" },
    ...extra,
  };
}

const PACK: BenchPackMetrics = {
  filesReturned: 5,
  goldReturned: 2,
  goldCount: 3,
  packPrecision: 0.4,
  packRecall: 0.6666,
  goldRanks: [],
  mustReadCount: 3,
  docsReturned: 1,
  tablesReturned: 0,
  testsReturned: 1,
  tokenEstimate: 1200,
  excludedCount: 0,
  confidence: 0.8,
};

// ---- mean / rate -----------------------------------------------------------

test("mean ignores null/undefined/non-finite and is null when none remain", () => {
  assert.equal(mean([2, 4, null, undefined, NaN]), 3);
  assert.equal(mean([null, undefined]), null);
  assert.equal(mean([]), null);
});

test("rate ignores non-booleans and is null when none remain", () => {
  assert.equal(rate([true, false, null]), 0.5);
  assert.equal(rate([true, true]), 1);
  assert.equal(rate([null, undefined]), null);
});

// ---- honest formatting (n/a, never 0) --------------------------------------

test("fmtMetric renders a missing value as n/a, never 0", () => {
  assert.equal(fmtMetric("tok", null), "n/a");
  assert.equal(fmtMetric("tok", undefined), "n/a");
  assert.equal(fmtMetric("num", NaN), "n/a");
  assert.equal(fmtMetric("rate", null), "n/a");
  // A genuine zero is distinct from a missing value and must survive.
  assert.equal(fmtMetric("tok", 0), "0");
  assert.equal(fmtMetric("rate", 0), "0%");
  assert.equal(fmtMetric("rate", 0.5), "50%");
  assert.equal(fmtMetric("ms", 1500), "1,500 ms");
  assert.equal(fmtMetric("num", 2.345), "2.3");
});

test("fmtDelta is signed (with − without) and n/a if either side is missing", () => {
  assert.equal(fmtDelta("rate", null, 0.5), "n/a");
  assert.equal(fmtDelta("rate", 0.5, null), "n/a");
  assert.equal(fmtDelta("rate", 0.25, 0.75), "+50 pp");
  assert.equal(fmtDelta("tok", 100, 60), "-40");
  assert.equal(fmtDelta("ms", 100, 100), "0 ms");
  assert.equal(fmtDelta("num", 1, 2.5), "+1.5");
});

// ---- summarizeBench: family separation -------------------------------------

test("summarizeBench groups by project+task+agent with without/with arms", () => {
  const runs = [
    run({ condition: "without", repeat: 0, metrics: metrics({ toolCalls: 10 }) }),
    run({ condition: "without", repeat: 1, metrics: metrics({ toolCalls: 20 }) }),
    run({ condition: "with", repeat: 0, metrics: metrics({ toolCalls: 4, kawnCalled: true }) }),
    run({ condition: "with", repeat: 1, metrics: metrics({ toolCalls: 6, kawnCalled: true }) }),
  ];
  const s = summarizeBench(report(runs));
  assert.equal(s.groups.length, 1);
  const g = s.groups[0];
  assert.equal(g.without?.meanToolCalls, 15);
  assert.equal(g.with?.meanToolCalls, 5);
  assert.equal(g.with?.kawnCalledRate, 1);
  assert.equal(g.without?.kawnCalledRate, 0);
  assert.equal(s.totalRuns, 4);
  assert.equal(s.okRuns, 4);
});

test("exploratory flag is set when an arm has fewer than the threshold ok runs", () => {
  assert.ok(EXPLORATORY_THRESHOLD > 2);
  const s = summarizeBench(report([run({ condition: "with" }), run({ condition: "without" })]));
  assert.equal(s.groups[0].exploratory, true);
  assert.equal(s.limitations.anyExploratory, true);
});

test("family A pack rows are deduped to one per project+task (first seen wins)", () => {
  const runs = [
    run({ condition: "with", kawnPack: PACK }),
    run({ condition: "with", repeat: 1, kawnPack: { ...PACK, mustReadCount: 9 } }),
  ];
  const s = summarizeBench(report(runs));
  assert.equal(s.packRows.length, 1);
  assert.equal(s.packRows[0].pack.mustReadCount, 3);
});

test("family D missing token data aggregates to null (renders n/a), never 0", () => {
  const s = summarizeBench(report([run({ condition: "with", session: session({ tokens: tokens() }) })]));
  const g = s.groups[0];
  assert.equal(g.with?.meanInput, null);
  assert.equal(g.with?.meanOutput, null);
  assert.equal(fmtMetric("tok", g.with?.meanInput), "n/a");
});

test("e2eCleanRate excludes null gold-boundary runs instead of counting them as 0", () => {
  const runs = [
    run({ mode: "e2e", condition: "with", repeat: 0, metrics: metrics({ filesChanged: 3, filesChangedOutsideGold: 0 }) }),
    run({ mode: "e2e", condition: "with", repeat: 1, metrics: metrics({ filesChanged: 2, filesChangedOutsideGold: 2 }) }),
    run({ mode: "e2e", condition: "with", repeat: 2, metrics: metrics({ filesChanged: 1, filesChangedOutsideGold: null }) }),
  ];
  const s = summarizeBench(report(runs));
  const g = s.groups[0];
  // Two defined boundaries (clean=0, dirty=2) → 0.5; the null-boundary run is excluded, not a 0.
  assert.equal(g.with?.e2eCleanRate, 0.5);
  assert.equal(g.isE2e, true);
});

test("limitations surface failures, notes, and unverified auth (kept visible)", () => {
  const runs = [
    run({ ok: true, session: session({ note: "small sample" }) }),
    run({ ok: false, failure: "timeout", repeat: 1, metrics: null }),
  ];
  const rep = report(runs, {
    readiness: [
      { agent: "codex", installed: true, binPath: "/x", authenticated: "unknown", detail: "could not confirm" },
      { agent: "claude", installed: true, binPath: "/y", authenticated: true, detail: "ok" },
    ],
  });
  const s = summarizeBench(rep);
  assert.equal(s.limitations.failures.length, 1);
  assert.equal(s.limitations.failures[0].reason, "timeout");
  assert.deepEqual(s.limitations.notes, ["small sample"]);
  assert.equal(s.limitations.unverifiedAuth.length, 1);
  assert.equal(s.limitations.unverifiedAuth[0].agent, "codex");
  assert.equal(s.okRuns, 1);
  assert.equal(s.totalRuns, 2);
});
