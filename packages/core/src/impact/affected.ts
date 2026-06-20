import { AtharGraph, AtharNode, EdgeType } from "@athar/shared";
import { reverseReachable } from "./reachable";

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

/**
 * Reverse reachability: given a symbol/file/route, find everything that depends
 * on it (callers, importers, referrers) up to `maxDepth`. Thin wrapper over the
 * shared {@link reverseReachable} BFS — resolves the query to seed nodes, then
 * walks dependency edges backwards.
 */
export function affected(graph: AtharGraph, query: string, maxDepth = 6): AffectedResult {
  const matched = graph.nodes.filter(
    (n) => n.id === query || n.label === query || n.id.endsWith("#" + query),
  );
  const { nodes } = reverseReachable(graph, matched.map((n) => n.id), { maxDepth });
  return { query, matched, affected: nodes };
}

/** Unique source files touched by an affected result — the "what to re-check" list. */
export function affectedFiles(result: AffectedResult): string[] {
  const files = new Set<string>();
  for (const a of result.affected) files.add(a.node.sourcePath);
  return [...files].sort();
}
