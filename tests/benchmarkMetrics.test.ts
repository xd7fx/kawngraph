import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics } from "@athar/benchmark";
import type { NormalizedSession, TaskDef, ToolCall } from "@athar/benchmark";

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
