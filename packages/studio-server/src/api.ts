import { KawnGraph, ContextMode } from "@kawngraph/shared";
import {
  buildContextPack,
  queryGraph,
  affected,
  affectedFiles,
  flowBetween,
  MAX_FLOW_NODES,
  gitChangedFiles,
  analyzeChangeImpact,
  GitError,
} from "@kawngraph/core";

/** Thrown for invalid client input; mapped to HTTP 400 by the server. */
export class BadRequest extends Error {}

// ---- strict output / input limits (a local tool is still untrusted input) ----
const QUERY_LIMIT_MAX = 200;
const QUERY_LIMIT_DEFAULT = 50;
const CONTEXT_BUDGET_MAX = 200_000;
const CONTEXT_BUDGET_MIN = 1;
const AFFECTED_DEPTH_MAX = 24;
const AFFECTED_DEPTH_DEFAULT = 6;
const TOP_CONNECTED = 12;
const MAX_QUERY_LEN = 2000;
const CHANGE_DEPTH_MAX = 24;
const CHANGE_DEPTH_DEFAULT = 6;
const CHANGE_NODES_MAX = 1000;
const CHANGE_NODES_DEFAULT = 500;
const MAX_REF_LEN = 200;

type Body = Record<string, unknown>;

function reqString(body: Body, key: string): string {
  const v = body[key];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new BadRequest(`\`${key}\` (non-empty string) is required`);
  }
  if (v.length > MAX_QUERY_LEN) throw new BadRequest(`\`${key}\` is too long (max ${MAX_QUERY_LEN} chars)`);
  return v;
}

/** Like reqString but accepts the first of several aliases (e.g. symbol|query). */
function reqStringAny(body: Body, keys: string[]): string {
  for (const key of keys) {
    const v = body[key];
    if (typeof v === "string" && v.trim().length > 0) {
      if (v.length > MAX_QUERY_LEN) throw new BadRequest(`\`${key}\` is too long (max ${MAX_QUERY_LEN} chars)`);
      return v;
    }
  }
  throw new BadRequest(`\`${keys[0]}\` (non-empty string) is required`);
}

function optMode(body: Body): ContextMode {
  const v = body.mode;
  return v === "code" || v === "docs" || v === "all" ? v : "all";
}

function clampInt(value: unknown, min: number, max: number, dflt: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/** Optional, bounded git-ref string (base/head). Empty/absent -> undefined. */
function optRef(body: Body, key: string): string | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new BadRequest(`\`${key}\` must be a string`);
  if (v.length > MAX_REF_LEN) throw new BadRequest(`\`${key}\` is too long (max ${MAX_REF_LEN} chars)`);
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Graph overview for the toolbar + an at-a-glance summary, all bounded. */
export function apiSummary(graph: KawnGraph): unknown {
  const degree = new Map<string, number>();
  for (const e of graph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const topConnected = [...graph.nodes]
    .map((n) => ({ id: n.id, label: n.label, type: n.type, layer: n.layer, degree: degree.get(n.id) ?? 0 }))
    .sort((a, b) => b.degree - a.degree || (a.id < b.id ? -1 : 1))
    .slice(0, TOP_CONNECTED);

  return {
    kawnVersion: graph.kawnVersion,
    generatedAt: graph.generatedAt,
    root: graph.root,
    stats: graph.stats,
    topConnected,
  };
}

export function apiQuery(graph: KawnGraph, body: Body): unknown {
  const query = reqString(body, "query");
  const mode = optMode(body);
  const limit = clampInt(body.limit, 1, QUERY_LIMIT_MAX, QUERY_LIMIT_DEFAULT);
  const hits = queryGraph(graph, query, mode, limit);
  return { query, mode, limit, count: hits.length, hits };
}

export function apiContext(graph: KawnGraph, body: Body): unknown {
  const task = reqString(body, "task");
  const mode = optMode(body);
  const budget = clampInt(body.budget, CONTEXT_BUDGET_MIN, CONTEXT_BUDGET_MAX, 8000);
  return buildContextPack(graph, task, { budget, mode });
}

export function apiAffected(graph: KawnGraph, body: Body): unknown {
  const symbol = reqStringAny(body, ["symbol", "query"]);
  const depth = clampInt(body.depth, 1, AFFECTED_DEPTH_MAX, AFFECTED_DEPTH_DEFAULT);
  const result = affected(graph, symbol, depth);
  return {
    query: result.query,
    depth,
    matched: result.matched,
    affected: result.affected,
    files: affectedFiles(result),
  };
}

export function apiFlow(graph: KawnGraph, body: Body): unknown {
  const from = reqString(body, "from");
  const to = reqString(body, "to");
  const maxNodes = clampInt(body.maxNodes, 2, MAX_FLOW_NODES, MAX_FLOW_NODES);
  return flowBetween(graph, from, to, maxNodes);
}

/**
 * Read-only change impact for the working tree (default) or a base ref (PR mode).
 * Needs the repo `root` for git, unlike the other graph-only handlers. Git
 * problems (no git, not a repo, unborn HEAD, bad ref) are reported as a
 * structured `{ ok: false, gitError }` so the UI can explain them — never thrown
 * as a 500 — while genuinely invalid input (a non-string ref) is still a 400.
 */
export function apiChanges(graph: KawnGraph, root: string, body: Body): unknown {
  const base = optRef(body, "base");
  const head = optRef(body, "head");
  const maxDepth = clampInt(body.depth, 1, CHANGE_DEPTH_MAX, CHANGE_DEPTH_DEFAULT);
  const maxNodes = clampInt(body.maxNodes, 1, CHANGE_NODES_MAX, CHANGE_NODES_DEFAULT);
  try {
    const changeSet =
      base !== undefined
        ? gitChangedFiles(root, head !== undefined ? { base, head } : { base })
        : gitChangedFiles(root);
    const impact = analyzeChangeImpact(graph, changeSet, { maxDepth, maxNodes });
    return { ok: true, impact };
  } catch (e) {
    if (e instanceof GitError) return { ok: false, gitError: { code: e.code, message: e.message } };
    throw e;
  }
}
