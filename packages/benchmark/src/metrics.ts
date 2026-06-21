/**
 * Two strictly separated metric families, both pure and deterministic (no I/O):
 *
 *   - {@link computeKawnPack} (family A) scores KawnGraph's Context Pack itself —
 *     what the MCP *would return* for a task — against the gold set. No agent.
 *   - {@link computeMetrics} (families B/C) scores one agent SESSION: what the
 *     agent actually opened, searched, and answered.
 *
 * The distinction is the whole point: agent-opened-file recall is NOT KawnGraph
 * recall. A great pack the agent ignores still scores high in A and low in B.
 *
 * computeMetrics definitions:
 *   - "opened" = distinct files touched by read/grep(scoped)/edit/write calls.
 *   - precision = relevant opened / total opened (focus: did it avoid noise?).
 *   - recall    = relevant hit / gold count, where a "hit" is a gold file the agent
 *     either opened OR named in its final answer (retrieval deliverable).
 *   - time-to-first-relevant = ms to the first call that touched a gold file.
 */
import { buildContextPack } from "@kawngraph/core";
import type { KawnGraph } from "@kawngraph/shared";
import type { KawnPackMetrics, ChangeSet, NormalizedSession, RunMetrics, TaskDef } from "./types";
import { norm } from "./normalize";

const FILE_KINDS = new Set(["read", "grep", "edit", "write"]);

// A path-like token in prose: a run of path chars containing a dot + extension.
const PATH_TOKEN_RE = /[A-Za-z0-9_./\\@-]+\.[A-Za-z0-9]+/g;

/**
 * Extract the distinct, normalized file paths an answer NAMES. Robust where a raw
 * `answer.includes(goldPath)` is not: it normalizes separators (so `src\lib\x.ts`
 * is matched, not silently missed), strips wrapping punctuation/quotes, and — via
 * {@link answerNames} — lets a longer cited path (absolute or repo-prefixed) still
 * match a repo-relative gold file by path suffix.
 */
export function namedFiles(answer: string): Set<string> {
  const out = new Set<string>();
  for (const m of answer.matchAll(PATH_TOKEN_RE)) {
    const cleaned = m[0].replace(/^[("'`]+/, "").replace(/[).,;:!?'"`]+$/, "");
    const n = norm(cleaned);
    if (n.length > 0) out.add(n);
  }
  return out;
}

/** True when `named` contains `gold` exactly or as the suffix of a longer path. */
function answerNames(named: Set<string>, gold: string): boolean {
  if (gold.length === 0) return false;
  for (const f of named) {
    if (f === gold || f.endsWith("/" + gold)) return true;
  }
  return false;
}

/**
 * Family C — grade an e2e change set against the task's gold boundary (the files a
 * correct edit may touch). Pure. `filesChangedOutsideGold` is the count of edits
 * that strayed outside that boundary (0 = surgically clean); it is null when the
 * task has no gold set to judge against — never a misleading 0.
 */
export function gradeChangeBoundary(
  changed: ChangeSet,
  task: TaskDef,
): { filesChanged: number; filesChangedOutsideGold: number | null } {
  const distinct = new Set([...changed.modified, ...changed.added, ...changed.removed].map(norm));
  const gold = new Set(task.gold.map(norm));
  if (gold.size === 0) return { filesChanged: distinct.size, filesChangedOutsideGold: null };
  let outside = 0;
  for (const f of distinct) if (!gold.has(f)) outside += 1;
  return { filesChanged: distinct.size, filesChangedOutsideGold: outside };
}

/**
 * Family A — KawnGraph Context Pack quality. Pure: builds the SAME pack KawnGraph's MCP
 * `kawn_context` would return for this task, then scores it against the gold
 * set. No agent, no transcript — this isolates KawnGraph's retrieval, deliberately
 * kept separate from the agent-behavior recall in {@link computeMetrics}.
 */
export function computeKawnPack(graph: KawnGraph, task: TaskDef): KawnPackMetrics {
  const pack = buildContextPack(graph, task.prompt);
  const gold = new Set(task.gold.map(norm));

  // Every cited item, highest score first, collapsed to distinct files. A file's
  // rank is fixed the first time it appears (1-based) across all buckets.
  const items = [...pack.mustRead, ...pack.relatedDocs, ...pack.tables, ...pack.tests].sort(
    (a, b) => b.score - a.score,
  );
  const rankOf = new Map<string, number>();
  for (const item of items) {
    const f = norm(item.sourcePath);
    if (!rankOf.has(f)) rankOf.set(f, rankOf.size + 1);
  }

  const filesReturned = rankOf.size;
  const goldRanks = [...gold].map((file) => ({ file, rank: rankOf.get(file) ?? null }));
  const goldReturned = goldRanks.filter((g) => g.rank != null).length;
  const goldCount = gold.size;

  return {
    filesReturned,
    goldReturned,
    goldCount,
    packPrecision: filesReturned > 0 ? goldReturned / filesReturned : null,
    packRecall: goldCount > 0 ? goldReturned / goldCount : null,
    goldRanks,
    mustReadCount: pack.mustRead.length,
    docsReturned: pack.relatedDocs.length,
    tablesReturned: pack.tables.length,
    testsReturned: pack.tests.length,
    tokenEstimate: pack.tokensUsed,
    excludedCount: pack.excluded.length,
    confidence: pack.confidence,
  };
}

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

  // Files the answer NAMES — matched by normalized path (separator-agnostic,
  // suffix-aware), not a raw substring that misses `src\lib\x.ts` or absolute paths.
  const answer = session.answer.toLowerCase();
  const named = namedFiles(session.answer);
  const mentioned = [...gold].filter((g) => answerNames(named, g));
  const hitSet = new Set<string>([...openedRelevant, ...mentioned]);
  const relevantHit = hitSet.size;

  const searches = session.tools.filter((t) => t.kind === "grep" || t.kind === "glob").length;

  const kawnOrder = session.tools.findIndex((t) => t.kawn);
  const kawnCalled = kawnOrder >= 0;
  const kawnFirst = session.tools.length > 0 && session.tools[0].kawn === true;

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
    kawnCalled,
    kawnFirst,
    kawnOrder: kawnCalled ? kawnOrder : null,
    toolCalls: session.tools.length,
    searches,
    distinctFilesOpened,
    irrelevantFilesOpened,
    relevantHit,
    goldCount,
    precision: distinctFilesOpened > 0 ? openedRelevant.length / distinctFilesOpened : null,
    recall: goldCount > 0 ? relevantHit / goldCount : null,
    timeToFirstRelevantMs,
    namedGoldCount: mentioned.length,
    answerCorrect,
    testsPassed: null,
    // e2e-only; the runner fills these from a filesystem diff (see gradeChangeBoundary)
    filesChanged: null,
    filesChangedOutsideGold: null,
  };
}
