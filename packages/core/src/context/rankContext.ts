import { AtharGraph, AtharNode, EdgeType, ContextMode } from "@athar/shared";

/**
 * Rank graph nodes for a task with NO LLM, combining three deterministic signals:
 *
 * - keyword match  — task words hit a node's label / path / identifier parts
 * - proximity      — distance (in edges) from a keyword seed; closer is better
 * - centrality     — degree; well-connected nodes are structurally important
 *
 * Seeds are restricted by `mode` (where the search starts) and expansion crosses
 * layers so docs/sections can *bridge* a code seed to the tables that explain it,
 * but the returned nodes are filtered back to `mode`. So a `code` query still
 * reaches the SQL it needs (data layer) yet never leaks docs (rule: no docs in
 * code scope unless asked); `all` keeps everything but visuals.
 */

export interface RankedNode {
  node: AtharNode;
  score: number;
  keywordScore: number;
  /** 0 for a keyword seed, otherwise edges away from the nearest seed */
  depth: number;
  via: EdgeType | "seed";
  reason: string;
}

export interface RankOptions {
  mode?: ContextMode;
  maxDepth?: number;
  limit?: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "to", "for", "of", "in", "on", "and", "or", "is", "be", "it",
  "this", "that", "with", "without", "my", "our", "please", "when", "how", "why",
  "fix", "add", "update", "change", "make", "support", "handle", "new", "use",
]);

/** Lowercased, de-duplicated task keywords (stopwords and 1-char tokens dropped). */
export function extractKeywords(task: string): string[] {
  const out = new Set<string>();
  for (const w of task.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    out.add(w);
  }
  return [...out];
}

/** Split a node's label + path into lowercase words, breaking camelCase apart. */
function nodeTerms(node: AtharNode): string {
  return `${node.label} ${node.sourcePath}`
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function keywordScore(node: AtharNode, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const haystack = nodeTerms(node);
  const words = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean));
  let score = 0;
  for (const kw of keywords) {
    if (words.has(kw)) score += 2; // whole-word hit
    else if (haystack.includes(kw)) score += 1; // substring hit
  }
  return score;
}

/** Whether a node belongs to a query's mode — used for both seeding and the final result scope. */
function inMode(node: AtharNode, mode: ContextMode): boolean {
  if (node.layer === "visual") return false;
  if (mode === "docs") return node.layer === "docs";
  if (mode === "code") return node.layer !== "docs";
  return true;
}

interface Neighbor {
  to: string;
  type: EdgeType;
}

export function rankContext(graph: AtharGraph, task: string, opts: RankOptions = {}): RankedNode[] {
  const mode = opts.mode ?? "all";
  const maxDepth = opts.maxDepth ?? 2;
  const keywords = extractKeywords(task);

  const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));
  const adj = new Map<string, Neighbor[]>();
  const degree = new Map<string, number>();
  const link = (from: string, to: string, type: EdgeType): void => {
    const arr = adj.get(from);
    if (arr) arr.push({ to, type });
    else adj.set(from, [{ to, type }]);
  };
  for (const e of graph.edges) {
    link(e.from, e.to, e.type);
    link(e.to, e.from, e.type);
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  let maxDeg = 1;
  for (const d of degree.values()) if (d > maxDeg) maxDeg = d;
  const central = (id: string): number => (degree.get(id) ?? 0) / maxDeg;

  const best = new Map<string, RankedNode>();
  const consider = (rn: RankedNode): void => {
    const cur = best.get(rn.node.id);
    if (!cur || rn.score > cur.score) best.set(rn.node.id, rn);
  };

  const seeds: string[] = [];
  for (const n of graph.nodes) {
    if (!inMode(n, mode)) continue;
    const kw = keywordScore(n, keywords);
    if (kw <= 0) continue;
    seeds.push(n.id);
    consider({
      node: n,
      score: kw * 10 + central(n.id) * 2,
      keywordScore: kw,
      depth: 0,
      via: "seed",
      reason: "matches task keywords",
    });
  }

  let frontier = [...seeds];
  const visited = new Set(seeds);
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      const from = byId.get(id);
      for (const nb of adj.get(id) ?? []) {
        const node = byId.get(nb.to);
        if (!node || node.layer === "visual") continue;
        const kw = keywordScore(node, keywords);
        const proximity = maxDepth - depth + 1;
        consider({
          node,
          score: kw * 10 + proximity * 2 + central(node.id) * 2,
          keywordScore: kw,
          depth,
          via: nb.type,
          reason: `connected to "${from?.label ?? id}" via ${nb.type}`,
        });
        if (!visited.has(node.id)) {
          visited.add(node.id);
          next.push(node.id);
        }
      }
    }
    frontier = next;
  }

  // Docs/sections may have been crossed as bridges during expansion; scope the
  // returned set back to `mode` so a code query never leaks them (data stays).
  const ranked = [...best.values()]
    .filter((rn) => inMode(rn.node, mode))
    .sort((a, b) => b.score - a.score || a.depth - b.depth);
  return opts.limit ? ranked.slice(0, opts.limit) : ranked;
}
