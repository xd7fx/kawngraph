import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { toCsv, toMarkdown, aggregateSide, writeReports } from "@athar/benchmark";
import type {
  AgentReadiness,
  BenchmarkReport,
  BenchmarkRun,
  NormalizedSession,
  RunMetrics,
  ScanCost,
} from "@athar/benchmark";
import { mkTmp } from "./helpers";

const SECRET = "sk-ant-oat01-ABCDEFGH12345678";

const CSV_HEADER =
  "project,task,agent,condition,repeat,mode,commit,model,ok,failure,athar_called,athar_first," +
  "athar_order,tool_calls,searches,distinct_files,irrelevant_files,relevant_hit,gold_count,precision," +
  "recall,ttf_ms,answer_correct,tests_passed,wall_ms,duration_ms,input_tokens,output_tokens,cost";

function metrics(p: Partial<RunMetrics> = {}): RunMetrics {
  return {
    atharCalled: false,
    atharFirst: false,
    atharOrder: null,
    toolCalls: 0,
    searches: 0,
    distinctFilesOpened: 0,
    irrelevantFilesOpened: 0,
    relevantHit: 0,
    goldCount: 0,
    precision: null,
    recall: null,
    timeToFirstRelevantMs: null,
    answerCorrect: null,
    testsPassed: null,
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
    atharVersion: "0.1.0",
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
    metrics: metrics({ atharCalled: true, precision: 0.5, distinctFilesOpened: 2 }),
    session: sess({ wallMs: 1000, tokens: { input: 100, output: 50, cacheRead: null, cacheCreate: null } }),
  });
  const r2 = run({
    metrics: metrics({ atharCalled: true, precision: 1.0, distinctFilesOpened: 4 }),
    session: sess({ wallMs: 2000, tokens: { input: 200, output: 100, cacheRead: null, cacheCreate: null } }),
  });
  const rf = run({ ok: false, metrics: null, session: sess({ ok: false, wallMs: 0 }) });

  const agg = aggregateSide([r1, r2, rf]);
  assert.equal(agg.nOk, 2);
  assert.equal(agg.nFail, 1);
  assert.equal(agg.atharCalledRate, 1);
  assert.equal(agg.meanPrecision, 0.75);
  assert.equal(agg.meanDistinct, 3);
  assert.equal(agg.meanWall, 1500);
  assert.equal(agg.meanInput, 150);
});

// ---------------------------------------------------------------------------
// CSV: stable 29-column schema, escaping, and redaction.
// ---------------------------------------------------------------------------

test("toCsv emits the stable header, one row per run, escaped + redacted", () => {
  const ok = run({
    metrics: metrics({ atharCalled: true, toolCalls: 3, precision: 0.5, recall: 0.66 }),
    session: sess({ wallMs: 1234, tokens: { input: 100, output: 40, cacheRead: null, cacheCreate: null } }),
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
  assert.equal(lines[0], CSV_HEADER, "header schema is stable (29 columns)");
  assert.equal(lines.length, 3, "header + 2 data rows");
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

  assert.match(md, /# Athar behavioral benchmark/);
  assert.match(md, /## Authentication readiness/);
  assert.match(md, /## Graph scan cost/);
  assert.ok(md.includes("## Results (A: without Athar"), "A/B results header");
  assert.ok(md.includes("### demo — t1 — claude (retrieval)"), "per-group heading");
  assert.match(md, /## Failed sessions/);
  assert.match(md, /## Notes/);
  assert.ok(md.includes("Codex adapter is best-effort"), "honesty note surfaced");
  assert.ok(!md.includes("ABCDEFGH"), "token in a failure is redacted in the markdown");
});

// ---------------------------------------------------------------------------
// writeReports: writes JSON+CSV+MD, all deep-redacted, under outDir.
// ---------------------------------------------------------------------------

test("writeReports writes three redacted files and returns their paths", () => {
  const outDir = mkTmp("athar-bench-out-");
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
