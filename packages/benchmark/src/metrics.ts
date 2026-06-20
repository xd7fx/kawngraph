/**
 * Turn one {@link NormalizedSession} into {@link RunMetrics} against a task's gold
 * set. Pure and deterministic — no I/O — so it is trivially unit-testable.
 *
 * Definitions:
 *   - "opened" = distinct files touched by read/grep(scoped)/edit/write calls.
 *   - precision = relevant opened / total opened (focus: did it avoid noise?).
 *   - recall    = relevant hit / gold count, where a "hit" is a gold file the agent
 *     either opened OR named in its final answer (retrieval deliverable).
 *   - time-to-first-relevant = ms to the first call that touched a gold file.
 */
import type { NormalizedSession, RunMetrics, TaskDef } from "./types";
import { norm } from "./normalize";

const FILE_KINDS = new Set(["read", "grep", "edit", "write"]);

export function computeMetrics(session: NormalizedSession, task: TaskDef): RunMetrics {
  const gold = new Set(task.gold.map(norm));
  const goldCount = gold.size;

  const opened = new Set<string>();
  for (const t of session.tools) {
    if (t.file && FILE_KINDS.has(t.kind)) opened.add(t.file);
  }
  const distinctFilesOpened = opened.size;
  const openedRelevant = [...opened].filter((f) => gold.has(f));
  const irrelevantFilesOpened = distinctFilesOpened - openedRelevant.length;

  const answer = session.answer.toLowerCase();
  const mentioned = [...gold].filter((g) => g.length > 0 && answer.includes(g));
  const hitSet = new Set<string>([...openedRelevant, ...mentioned]);
  const relevantHit = hitSet.size;

  const searches = session.tools.filter((t) => t.kind === "grep" || t.kind === "glob").length;

  const atharOrder = session.tools.findIndex((t) => t.athar);
  const atharCalled = atharOrder >= 0;
  const atharFirst = session.tools.length > 0 && session.tools[0].athar === true;

  let timeToFirstRelevantMs: number | null = null;
  for (const t of session.tools) {
    if (t.file && gold.has(t.file) && typeof t.atMs === "number") {
      timeToFirstRelevantMs = t.atMs;
      break;
    }
  }

  let answerCorrect: boolean | null = null;
  if (task.expectMentions && task.expectMentions.length > 0) {
    answerCorrect = task.expectMentions.every((m) => answer.includes(m.toLowerCase()));
  }

  return {
    atharCalled,
    atharFirst,
    atharOrder: atharCalled ? atharOrder : null,
    toolCalls: session.tools.length,
    searches,
    distinctFilesOpened,
    irrelevantFilesOpened,
    relevantHit,
    goldCount,
    precision: distinctFilesOpened > 0 ? openedRelevant.length / distinctFilesOpened : null,
    recall: goldCount > 0 ? relevantHit / goldCount : null,
    timeToFirstRelevantMs,
    answerCorrect,
    testsPassed: null,
  };
}
