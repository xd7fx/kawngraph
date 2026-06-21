import { KawnGraph, KawnNode, NodeType, EdgeType, ContextMode, ContextTier } from "@kawngraph/shared";

/**
 * Rank graph nodes for a task with NO LLM, combining deterministic signals:
 *
 * - keyword match  — task words hit a node's label / path / identifier parts
 * - proximity      — distance (in edges) from a keyword seed; closer is better
 * - connectivity   — degree cuts BOTH ways, decided by keyword overlap: a node
 *                    that matched the task AND is well-connected is the topic's
 *                    orchestrator (the scan entrypoint that ties the extractors
 *                    together) — a small bonus. A node pulled in with NO keyword
 *                    overlap that is well-connected is a generic structural bridge
 *                    (an index/barrel/global README that "connects to everything"
 *                    but means nothing for THIS task) — penalized. Degree alone
 *                    can't tell an orchestrator from a barrel; keyword overlap can.
 * - generic-doc penalty — a doc reached with no keyword overlap (a pure bridge)
 *                    or a generically-named doc (README/CHANGELOG/…) is pushed
 *                    down so it never crowds out the code that actually matters.
 * - specificity    — a precise unit you can read in seconds (a function, route,
 *                    or class) beats the whole file that merely *contains* it when
 *                    both match the task equally: "must read" should point at the
 *                    symbol, not its container.
 *
 * Seeds are restricted by `mode` (where the search starts) and expansion crosses
 * layers so docs/sections can *bridge* a code seed to the tables that explain it,
 * but the returned nodes are filtered back to `mode`. So a `code` query still
 * reaches the SQL it needs (data layer) yet never leaks docs (rule: no docs in
 * code scope unless asked); `all` keeps everything but visuals.
 *
 * Tie-breaking is total and deterministic: score, then shallower depth, then node
 * id — so the same graph + task always yields byte-identical ordering.
 */

export interface RankedNode {
  node: KawnNode;
  score: number;
  keywordScore: number;
  /** 0 for a keyword seed, otherwise edges away from the nearest seed */
  depth: number;
  /** exact = keyword seed, direct = 1 hop, second-order = 2+ hops */
  tier: ContextTier;
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

// Scoring weights — keyword relevance dominates; structure only breaks ties.
const KW_WEIGHT = 10;
const PROX_WEIGHT = 2;
const HUB_BONUS = 2; // a well-connected node that DID match: a topic orchestrator, rewarded
const HUB_PENALTY = 3; // a well-connected node that did NOT match: a generic bridge, penalized
const DOC_GENERIC_PENALTY = 4; // a generically-named doc that still matched a keyword
const DOC_NO_KEYWORD_PENALTY = 6; // a doc pulled in purely as a bridge (no keyword overlap)

/**
 * Precision preference for the most specific actionable CODE unit. A function/route
 * a reader can open and grasp in seconds outranks the whole file that contains it
 * (and a hub penalty alone would perversely favor the low-degree container). It is
 * deliberately scoped to code symbols only: tables, tests, and docs live in their
 * own buckets, so giving them a bonus would just let them leapfrog equally-relevant
 * code in a flat ranking. Kept small so keyword relevance always dominates — this
 * only breaks near-ties between a symbol and its file.
 */
const SPECIFICITY: Partial<Record<NodeType, number>> = {
  function: 3,
  route: 3,
  class: 3,
  symbol: 2,
  // file / doc / table / migration / section / test / env / package … → 0 (containers or own-bucket)
};

function specificity(node: KawnNode): number {
  return SPECIFICITY[node.type] ?? 0;
}

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
function nodeTerms(node: KawnNode): string {
  return `${node.label} ${node.sourcePath}`
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function keywordScore(node: KawnNode, keywords: string[]): number {
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

/** A doc whose filename is boilerplate (README, CHANGELOG, …) — relevant to nothing in particular. */
function isGenericDocName(node: KawnNode): boolean {
  const base = node.sourcePath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  return /^(readme|index|changelog|changes|contributing|license|licence|notice|authors|security|code_of_conduct)\b/.test(
    base,
  );
}

function tierForDepth(depth: number): ContextTier {
  if (depth <= 0) return "exact";
  if (depth === 1) return "direct";
  return "second-order";
}

/**
 * Final score for a node: keyword relevance (dominant) + proximity bonus +
 * specificity + connectivity (signed by keyword overlap) − generic-doc penalty.
 * Pure and deterministic.
 */
function scoreNode(node: KawnNode, kw: number, depth: number, maxDepth: number, central: number): number {
  const proximity = (maxDepth - depth + 1) * PROX_WEIGHT; // depth 0 (seed) highest
  // Connectivity is rewarded when it's topical and penalized when it's generic.
  // A matched, well-connected node is the topic's orchestrator (e.g. the scan
  // entrypoint wiring the extractors together) — without this bonus a low-keyword
  // orchestrator loses the budget race to its higher-keyword children and drops
  // out of the pack. A node with NO keyword overlap is a pure structural bridge
  // (barrel/index/global README): high degree there is noise, so it's penalized.
  const connectivity = kw > 0 ? central * HUB_BONUS : -central * HUB_PENALTY;
  let score = kw * KW_WEIGHT + proximity + specificity(node) + connectivity;
  if (node.layer === "docs") {
    if (kw <= 0) score -= DOC_NO_KEYWORD_PENALTY;
    else if (isGenericDocName(node)) score -= DOC_GENERIC_PENALTY;
  }
  return score;
}

/** Whether a node belongs to a query's mode — used for both seeding and the final result scope. */
function inMode(node: KawnNode, mode: ContextMode): boolean {
  if (node.layer === "visual") return false;
  switch (mode) {
    case "docs":
      return node.layer === "docs";
    case "code":
      return node.layer !== "docs";
    case "data":
      // tables/migrations + the code that touches them; never docs.
      return node.layer === "data" || node.layer === "code";
    case "tests":
      // tests + the code under test; never docs.
      return node.layer === "test" || node.layer === "code";
    case "all":
    case "auto": // `auto` is resolved to a concrete mode before ranking; treat as all otherwise
    default:
      return true;
  }
}

/**
 * Resolve `auto` to a concrete retrieval mode from the task text. Conservative by
 * design — it only narrows to a single layer when the task is unambiguously about
 * that layer, otherwise it stays `all` so recall is never sacrificed. Deterministic.
 */
export function resolveMode(task: string, mode: ContextMode): Exclude<ContextMode, "auto"> {
  if (mode !== "auto") return mode;
  const words = new Set(extractKeywords(task));
  const has = (...ws: string[]): boolean => ws.some((w) => words.has(w));
  const dataSignal = has("table", "tables", "schema", "migration", "migrations", "sql", "column", "columns", "database");
  const testSignal = has("test", "tests", "spec", "specs", "coverage", "pytest", "vitest", "jest", "mocha");
  const docSignal = has("doc", "docs", "documentation", "readme", "guide", "guides");
  if (dataSignal && !testSignal && !docSignal) return "data";
  if (testSignal && !dataSignal && !docSignal) return "tests";
  if (docSignal && !dataSignal && !testSignal) return "docs";
  return "all";
}

interface Neighbor {
  to: string;
  type: EdgeType;
}

export function rankContext(graph: KawnGraph, task: string, opts: RankOptions = {}): RankedNode[] {
  const mode = resolveMode(task, opts.mode ?? "all");
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
      score: scoreNode(n, kw, 0, maxDepth, central(n.id)),
      keywordScore: kw,
      depth: 0,
      tier: "exact",
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
        consider({
          node,
          score: scoreNode(node, kw, depth, maxDepth, central(node.id)),
          keywordScore: kw,
          depth,
          tier: tierForDepth(depth),
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
  // Total deterministic order: score, then shallower depth, then node id.
  const ranked = [...best.values()]
    .filter((rn) => inMode(rn.node, mode))
    .sort((a, b) => b.score - a.score || a.depth - b.depth || a.node.id.localeCompare(b.node.id));
  return opts.limit ? ranked.slice(0, opts.limit) : ranked;
}
