import {
  KawnGraph,
  KawnNode,
  ContextPack,
  ContextItem,
  ContextExclusion,
  ContextFreshness,
  ContextMode,
  NodeType,
  KAWN_VERSION,
} from "@kawngraph/shared";
import { rankContext, resolveMode, extractKeywords, RankedNode } from "./rankContext";
import { estimateTokens } from "./tokenBudget";
import { scoreRisks } from "../impact/riskScore";

export interface BuildContextOptions {
  budget?: number;
  mode?: ContextMode;
  maxDepth?: number;
  /** graph freshness to embed in the pack (CLI/MCP supply it; pure builds omit it) */
  freshness?: ContextFreshness;
}

const DEFAULT_BUDGET = 8000;
const RANK_LIMIT = 80;

type Section = "code" | "docs" | "tables" | "tests" | "skip";

function sectionFor(type: NodeType): Section {
  switch (type) {
    case "file":
    case "function":
    case "class":
    case "route":
    case "symbol":
    case "env":
      return "code";
    case "doc":
    case "section":
      return "docs";
    case "table":
    case "migration":
      return "tables";
    case "test":
      return "tests";
    default:
      return "skip"; // decision/image/diagram/package — not part of a read-this pack (yet)
  }
}

function toItem(r: RankedNode): ContextItem {
  const n = r.node;
  return {
    id: n.id,
    type: n.type,
    label: n.label,
    sourcePath: n.sourcePath,
    lineStart: n.lineStart,
    lineEnd: n.lineEnd,
    reason: r.reason,
    score: Math.round(r.score * 100) / 100,
    tier: r.tier,
    tokensEstimate: estimateTokens(n),
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Build a task-scoped, budget-bounded Context Pack. Layers stay in separate
 * buckets (code / docs / tables / tests) — nothing mixed blindly. Tables are
 * never dropped for budget (SQL is load-bearing); lower-ranked code/docs that
 * don't fit are surfaced in `excluded` with a reason, not silently lost.
 */
export function buildContextPack(graph: KawnGraph, task: string, opts: BuildContextOptions = {}): ContextPack {
  const budget = opts.budget ?? DEFAULT_BUDGET;
  // Resolve `auto` (and any request) to the concrete mode the pack actually used,
  // so the reported `mode` is never the ambiguous `auto`.
  const mode = resolveMode(task, opts.mode ?? "all");
  const ranked = rankContext(graph, task, { mode, maxDepth: opts.maxDepth ?? 2, limit: RANK_LIMIT });

  const code: ContextItem[] = [];
  const docs: ContextItem[] = [];
  const tableItems: ContextItem[] = [];
  const tests: ContextItem[] = [];
  for (const r of ranked) {
    const item = toItem(r);
    switch (sectionFor(r.node.type)) {
      case "code":
        code.push(item);
        break;
      case "docs":
        docs.push(item);
        break;
      case "tables":
        tableItems.push(item);
        break;
      case "tests":
        tests.push(item);
        break;
      default:
        break;
    }
  }

  const excluded: ContextExclusion[] = [];
  let used = 0;

  // Tables + tests are mandatory: SQL is never excluded by default, and tests are cheap.
  for (const t of tableItems) used += t.tokensEstimate;
  for (const t of tests) used += t.tokensEstimate;

  const mustRead: ContextItem[] = [];
  for (const item of code) {
    if (used + item.tokensEstimate <= budget) {
      mustRead.push(item);
      used += item.tokensEstimate;
    } else {
      excluded.push({ id: item.id, label: item.label, reason: `over budget (~${item.tokensEstimate} tok)` });
    }
  }

  const relatedDocs: ContextItem[] = [];
  for (const item of docs) {
    if (used + item.tokensEstimate <= budget) {
      relatedDocs.push(item);
      used += item.tokensEstimate;
    } else {
      excluded.push({ id: item.id, label: item.label, reason: `over budget (~${item.tokensEstimate} tok)` });
    }
  }

  const includedIds = new Set<string>([
    ...mustRead.map((i) => i.id),
    ...relatedDocs.map((i) => i.id),
    ...tableItems.map((i) => i.id),
    ...tests.map((i) => i.id),
  ]);
  const risks = scoreRisks(graph, includedIds);

  // Confidence = how much of the task vocabulary the included items actually
  // cover, plus a bump for being grounded in real code/tables (not just docs).
  const keywords = extractKeywords(task);
  const hay = [...mustRead, ...relatedDocs, ...tableItems, ...tests]
    .map((i) => `${i.label} ${i.sourcePath}`.toLowerCase())
    .join(" ");
  const matched = keywords.filter((k) => hay.includes(k)).length;
  const coverage = keywords.length > 0 ? matched / keywords.length : 0;
  const grounded = mustRead.length + tableItems.length > 0 ? 1 : 0;
  const confidence = round2(Math.max(0, Math.min(1, 0.2 + 0.6 * coverage + 0.2 * grounded)));

  const pack: ContextPack = {
    kawnVersion: KAWN_VERSION,
    generatedAt: new Date().toISOString(),
    task,
    mode,
    budget,
    tokensUsed: used,
    confidence,
    mustRead,
    relatedDocs,
    tables: tableItems,
    tests,
    risks,
    excluded,
  };
  if (opts.freshness) pack.freshness = opts.freshness;
  return pack;
}

/** Read-only graph query used by `kawn query` — mode-scoped, ranked node hits. */
export function queryGraph(
  graph: KawnGraph,
  query: string,
  mode: ContextMode,
  limit = 25,
): { node: KawnNode; score: number; reason: string }[] {
  return rankContext(graph, query, { mode, maxDepth: 1, limit }).map((r) => ({
    node: r.node,
    score: Math.round(r.score * 100) / 100,
    reason: r.reason,
  }));
}
