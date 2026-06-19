import { AtharGraph, AtharNode, EdgeType } from "@athar/shared";

export interface AffectedNode {
  node: AtharNode;
  depth: number;
  via: EdgeType;
}

export interface AffectedResult {
  query: string;
  matched: AtharNode[];
  affected: AffectedNode[];
}

/** Edge types that mean "the source depends on the target". */
const DEPENDENCY_EDGES = new Set<EdgeType>(["calls", "imports", "references"]);

/**
 * Reverse reachability: given a symbol/file/route, find everything that depends
 * on it (callers, importers, referrers) up to `maxDepth`.
 */
export function affected(graph: AtharGraph, query: string, maxDepth = 6): AffectedResult {
  const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));
  const matched = graph.nodes.filter(
    (n) => n.id === query || n.label === query || n.id.endsWith("#" + query),
  );

  const incoming = new Map<string, { from: string; type: EdgeType }[]>();
  for (const e of graph.edges) {
    if (!DEPENDENCY_EDGES.has(e.type)) continue;
    const arr = incoming.get(e.to) ?? [];
    arr.push({ from: e.from, type: e.type });
    incoming.set(e.to, arr);
  }

  const seen = new Set(matched.map((n) => n.id));
  const affectedNodes: AffectedNode[] = [];
  let frontier = matched.map((n) => n.id);

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const dep of incoming.get(id) ?? []) {
        if (seen.has(dep.from)) continue;
        seen.add(dep.from);
        const node = byId.get(dep.from);
        if (!node) continue;
        affectedNodes.push({ node, depth, via: dep.type });
        next.push(dep.from);
      }
    }
    frontier = next;
  }

  return { query, matched, affected: affectedNodes };
}

/** Unique source files touched by an affected result — the "what to re-check" list. */
export function affectedFiles(result: AffectedResult): string[] {
  const files = new Set<string>();
  for (const a of result.affected) files.add(a.node.sourcePath);
  return [...files].sort();
}
