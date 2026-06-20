import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, computeAtharPack, gradeChangeBoundary } from "@athar/benchmark";
import type { NormalizedSession, TaskDef, ToolCall } from "@athar/benchmark";
import type { AtharGraph, AtharNode, Layer, NodeType } from "@athar/shared";

function session(tools: ToolCall[], answer = ""): NormalizedSession {
  return {
    agent: "claude",
    condition: "with",
    ok: true,
    wallMs: 1000,
    durationMs: null,
    tools,
    tokens: { input: null, output: null, cacheRead: null, cacheCreate: null },
    numTurns: null,
    answer,
    cost: null,
  };
}

const athar = (atMs: number): ToolCall => ({ name: "mcp__athar__athar_context", kind: "athar", athar: true, atMs });
const read = (file: string, atMs: number): ToolCall => ({ name: "Read", kind: "read", athar: false, file, atMs });

test("computes precision, recall, athar order, and time-to-first-relevant", () => {
  const s = session(
    [athar(100), read("src/lib/oauth.ts", 1200), read("src/x.ts", 1500)],
    "Relevant files: src/lib/oauth.ts and src/server/repositories/storetokens.ts handle it.",
  );
  const task: TaskDef = {
    id: "t",
    prompt: "p",
    gold: ["src/lib/oauth.ts", "src/server/repositories/storetokens.ts", "docs/zid-oauth-core.md"],
    expectMentions: ["storetokens"],
  };
  const m = computeMetrics(s, task);

  assert.equal(m.atharCalled, true);
  assert.equal(m.atharFirst, true);
  assert.equal(m.atharOrder, 0);
  assert.equal(m.distinctFilesOpened, 2, "athar call opens no file");
  assert.equal(m.irrelevantFilesOpened, 1, "src/x.ts is off-gold");
  assert.equal(m.goldCount, 3);
  assert.equal(m.relevantHit, 2, "one opened gold + one gold named in the answer");
  assert.equal(m.precision, 0.5, "1 relevant / 2 opened");
  assert.ok(Math.abs((m.recall ?? -1) - 2 / 3) < 1e-9, "2 hits / 3 gold");
  assert.equal(m.timeToFirstRelevantMs, 1200, "first call touching a gold file");
  assert.equal(m.answerCorrect, true);
  assert.equal(m.testsPassed, null, "the runner fills testsPassed, not computeMetrics");
});

test("atharFirst is false when Athar is not the opening move", () => {
  const m = computeMetrics(session([read("src/a.ts", 10), athar(20)]), { id: "t", prompt: "p", gold: ["src/a.ts"] });
  assert.equal(m.atharCalled, true);
  assert.equal(m.atharFirst, false);
  assert.equal(m.atharOrder, 1);
});

test("no tools → precision null, recall 0 against a non-empty gold, no athar", () => {
  const m = computeMetrics(session([]), { id: "t", prompt: "p", gold: ["src/a.ts", "src/b.ts"] });
  assert.equal(m.distinctFilesOpened, 0);
  assert.equal(m.precision, null, "precision undefined when nothing was opened");
  assert.equal(m.recall, 0, "0 of 2 gold hit");
  assert.equal(m.atharCalled, false);
  assert.equal(m.atharFirst, false);
  assert.equal(m.atharOrder, null);
  assert.equal(m.timeToFirstRelevantMs, null);
});

test("recall is null (n/a) when the task has no gold set", () => {
  const m = computeMetrics(session([read("src/z.ts", 5)]), { id: "t", prompt: "p", gold: [] });
  assert.equal(m.goldCount, 0);
  assert.equal(m.recall, null);
  assert.equal(m.precision, 0, "0 relevant / 1 opened");
});

test("answerCorrect is null when the task defines no expected anchors", () => {
  const m = computeMetrics(session([], "anything"), { id: "t", prompt: "p", gold: ["src/a.ts"] });
  assert.equal(m.answerCorrect, null);
});

test("searches counts grep and glob calls only", () => {
  const tools: ToolCall[] = [
    { name: "Grep", kind: "grep", athar: false, atMs: 1 },
    { name: "Glob", kind: "glob", athar: false, atMs: 2 },
    { name: "Read", kind: "read", athar: false, file: "src/a.ts", atMs: 3 },
  ];
  const m = computeMetrics(session(tools), { id: "t", prompt: "p", gold: [] });
  assert.equal(m.searches, 2);
});

// ---------------------------------------------------------------------------
// §4 — correctness eval hardening. A gold file NAMED (not opened) must be matched
// by normalized path, separator-agnostic and suffix-aware. The old code did a raw
// `answer.includes(goldPosixPath)`, so a Windows-separator or absolute path slipped
// through and silently under-counted recall. These lock that fix.
// ---------------------------------------------------------------------------

test("a gold file named with backslashes or an absolute path still counts as found", () => {
  const task: TaskDef = {
    id: "t",
    prompt: "p",
    gold: ["src/lib/oauth.ts", "src/server/repositories/storetokens.ts"],
  };
  // Nothing opened; both gold files are only NAMED in prose — one with Windows
  // separators, one as an absolute path with a repo prefix. A raw substring check
  // against the posix-relative gold (the old bug) would miss both.
  const answer =
    "The flow lives in src\\lib\\oauth.ts and tokens are persisted by " +
    "C:\\work\\repo\\src\\server\\repositories\\storetokens.ts.";
  const m = computeMetrics(session([], answer), task);

  assert.equal(m.namedGoldCount, 2, "both gold files recognized despite separators / prefix");
  assert.equal(m.relevantHit, 2, "named gold is a hit even with nothing opened");
  assert.equal(m.recall, 1, "2 found / 2 gold");
  assert.equal(m.precision, null, "nothing opened → opened precision is n/a, not 0");
});

test("namedGoldCount counts only gold files, distinct from other paths named", () => {
  const task: TaskDef = { id: "t", prompt: "p", gold: ["src/lib/oauth.ts"] };
  const m = computeMetrics(
    session([], "See src/lib/oauth.ts, src/other/thing.ts and package.json."),
    task,
  );
  assert.equal(m.namedGoldCount, 1, "only the one gold file counts, not the other named paths");
});

// ---------------------------------------------------------------------------
// §4 — e2e change boundary (gradeChangeBoundary). Pure: counts distinct changed
// files and how many fall outside the task's gold boundary; n/a when no gold.
// ---------------------------------------------------------------------------

test("gradeChangeBoundary counts changes and flags edits outside the gold boundary", () => {
  const task: TaskDef = { id: "t", prompt: "p", gold: ["src/a.ts", "src/b.ts"] };

  const within = gradeChangeBoundary({ modified: ["src/a.ts"], added: ["src/b.ts"], removed: [] }, task);
  assert.equal(within.filesChanged, 2);
  assert.equal(within.filesChangedOutsideGold, 0, "every edit stayed inside the boundary");

  const strayed = gradeChangeBoundary(
    { modified: ["src/a.ts"], added: ["src/unrelated.ts"], removed: ["README.md"] },
    task,
  );
  assert.equal(strayed.filesChanged, 3);
  assert.equal(strayed.filesChangedOutsideGold, 2, "unrelated.ts + readme.md strayed outside gold");
});

test("gradeChangeBoundary reports outside-gold as n/a (not 0) when the task has no gold", () => {
  const r = gradeChangeBoundary({ modified: ["x.ts"], added: [], removed: [] }, { id: "t", prompt: "p", gold: [] });
  assert.equal(r.filesChanged, 1);
  assert.equal(r.filesChangedOutsideGold, null, "no gold boundary → n/a, never a misleading 0");
});

test("gradeChangeBoundary is separator-agnostic and de-dupes a file changed twice", () => {
  const task: TaskDef = { id: "t", prompt: "p", gold: ["src/a.ts"] };
  // same file appears via different separators + in two buckets → one distinct change
  const r = gradeChangeBoundary({ modified: ["src\\a.ts"], added: ["src/a.ts"], removed: [] }, task);
  assert.equal(r.filesChanged, 1, "normalized + de-duplicated to a single file");
  assert.equal(r.filesChangedOutsideGold, 0);
});

// ---------------------------------------------------------------------------
// Family A — Athar Context Pack quality (computeAtharPack)
//
// This measures what Athar's MCP *would return* for a task, with no agent in the
// loop. It must stay strictly separate from the agent-behavior recall above:
// a pack the agent ignores still scores high here and low there.
// ---------------------------------------------------------------------------

function node(id: string, type: NodeType, layer: Layer, label: string, sourcePath: string): AtharNode {
  return { id, type, layer, label, sourcePath };
}

function graphOf(nodes: AtharNode[]): AtharGraph {
  return {
    atharVersion: "test",
    generatedAt: new Date().toISOString(),
    root: "/proj",
    stats: { nodes: nodes.length, edges: 0, byLayer: {}, byType: {}, byEdgeType: {} },
    nodes,
    edges: [],
  };
}

// A tiny graph whose nodes match the task keywords by label/path, so the ranker
// surfaces them deterministically (no edges → score is pure keyword strength).
const PACK_GRAPH = graphOf([
  node("f_oauth", "file", "code", "oauth.ts", "src/lib/oauth.ts"),
  node("f_route", "file", "code", "route.ts", "src/app/zid/callback/route.ts"),
  node("d_flow", "doc", "docs", "OAuth flow", "docs/oauth-flow.md"),
  node("t_tokens", "table", "data", "tokens", "db/schema.sql"),
  node("x_test", "test", "test", "oauth.test.ts", "tests/oauth.test.ts"),
  node("f_util", "file", "code", "util.ts", "src/unrelated/util.ts"),
]);

const PACK_TASK: TaskDef = {
  id: "pack",
  prompt: "oauth callback route and token storage",
  // third gold file is intentionally absent from the graph (Athar can't return it)
  gold: ["src/lib/oauth.ts", "src/app/zid/callback/route.ts", "src/missing/ghost.ts"],
};

test("computeAtharPack scores the pack Athar returns, with gold ranks and bucket counts", () => {
  const p = computeAtharPack(PACK_GRAPH, PACK_TASK);

  assert.equal(p.filesReturned, 5, "every keyword-matched file; the unrelated util.ts is excluded");
  assert.equal(p.goldReturned, 2, "oauth.ts + route.ts surfaced; ghost.ts is absent from the graph");
  assert.equal(p.goldCount, 3);
  assert.ok(Math.abs((p.packRecall ?? -1) - 2 / 3) < 1e-9, "pack recall = 2/3 gold returned");
  assert.ok(Math.abs((p.packPrecision ?? -1) - 2 / 5) < 1e-9, "pack precision = 2 gold / 5 files");

  assert.equal(p.mustReadCount, 2, "two code files");
  assert.equal(p.docsReturned, 1);
  assert.equal(p.tablesReturned, 1);
  assert.equal(p.testsReturned, 1);
  assert.ok(p.tokenEstimate > 0, "the pack has a token estimate");
  assert.ok(p.confidence > 0 && p.confidence <= 1);

  const rank = (f: string): number | null => p.goldRanks.find((g) => g.file === f)?.rank ?? null;
  assert.equal(rank("src/app/zid/callback/route.ts"), 1, "the strongest keyword match ranks first");
  assert.equal(rank("src/lib/oauth.ts"), 2);
  assert.equal(rank("src/missing/ghost.ts"), null, "a gold file not in the pack has no rank, not 0");
});

test("Athar pack recall is NOT the agent's opened-file recall (the whole point of §2)", () => {
  const pack = computeAtharPack(PACK_GRAPH, PACK_TASK);
  // the agent opened only ONE of the two gold files Athar surfaced, and named none
  const agent = computeMetrics(session([read("src/lib/oauth.ts", 100)]), PACK_TASK);

  assert.ok(Math.abs((pack.packRecall ?? -1) - 2 / 3) < 1e-9, "Athar returned 2/3 of gold");
  assert.ok(Math.abs((agent.recall ?? -1) - 1 / 3) < 1e-9, "the agent only acted on 1/3");
  assert.ok(
    (pack.packRecall ?? 0) > (agent.recall ?? 0),
    "a strong pack the agent ignored still scores high for Athar but low for the agent",
  );
});

test("computeAtharPack is deterministic and reports n/a (not 0) when gold is empty", () => {
  const a = computeAtharPack(PACK_GRAPH, PACK_TASK);
  const b = computeAtharPack(PACK_GRAPH, PACK_TASK);
  assert.deepEqual(a, b, "same graph + task → identical pack metrics, repeat after repeat");

  const noGold = computeAtharPack(PACK_GRAPH, { id: "n", prompt: "oauth", gold: [] });
  assert.equal(noGold.goldCount, 0);
  assert.equal(noGold.packRecall, null, "no gold → recall n/a, never a misleading 0");
  assert.ok(noGold.filesReturned >= 1, "the pack still returned files even without a gold set");
});
