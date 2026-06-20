/**
 * Pure graph filtering used by the Graph view. Deterministic and React-free so
 * it can be unit-tested directly.
 *
 * Order of operations: optional neighborhood focus → layer/type/search filters
 * → keep only edges with both endpoints present and an un-hidden type → optional
 * hide-isolated pass.
 */
import type { AtharEdge, AtharGraph, AtharNode } from "../types";

export interface ActiveFilters {
  hiddenLayers: ReadonlySet<string>;
  hiddenNodeTypes: ReadonlySet<string>;
  hiddenEdgeTypes: ReadonlySet<string>;
  hideIsolated: boolean;
  /** case-insensitive substring match on label / id / sourcePath */
  search: string;
  /** when set, restrict to this node + its neighborhood */
  focusId?: string | null;
  neighborhoodDepth?: number;
}

export interface FilteredGraph {
  nodes: AtharNode[];
  edges: AtharEdge[];
  total: number;
  /** how many nodes the active filters removed */
  removed: number;
}

export function buildAdjacency(edges: readonly AtharEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string): void => {
    let set = adj.get(a);
    if (!set) {
      set = new Set();
      adj.set(a, set);
    }
    set.add(b);
  };
  for (const e of edges) {
    add(e.from, e.to);
    add(e.to, e.from);
  }
  return adj;
}

/** Undirected neighborhood of `start` up to `depth` hops (inclusive of start). */
export function neighborhood(
  edges: readonly AtharEdge[],
  start: string,
  depth: number,
): Set<string> {
  const adj = buildAdjacency(edges);
  const seen = new Set<string>([start]);
  let frontier = [start];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of adj.get(id) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return seen;
}

function matchesSearch(node: AtharNode, needle: string): boolean {
  if (!needle) return true;
  const q = needle.toLowerCase();
  return (
    node.label.toLowerCase().includes(q) ||
    node.id.toLowerCase().includes(q) ||
    (node.sourcePath?.toLowerCase().includes(q) ?? false)
  );
}

export function filterGraph(graph: AtharGraph, filters: ActiveFilters): FilteredGraph {
  const total = graph.nodes.length;

  let scope: ReadonlySet<string> | null = null;
  if (filters.focusId) {
    scope = neighborhood(graph.edges, filters.focusId, Math.max(1, filters.neighborhoodDepth ?? 1));
  }

  const search = filters.search.trim();
  const keep = new Set<string>();
  const nodes: AtharNode[] = [];
  for (const node of graph.nodes) {
    if (scope && !scope.has(node.id)) continue;
    if (filters.hiddenLayers.has(node.layer)) continue;
    if (filters.hiddenNodeTypes.has(node.type)) continue;
    // When focused, show the whole neighborhood regardless of the search term so
    // the focus node and its context are never hidden by an unrelated query.
    if (!scope && !matchesSearch(node, search)) continue;
    keep.add(node.id);
    nodes.push(node);
  }

  let edges = graph.edges.filter(
    (e) => keep.has(e.from) && keep.has(e.to) && !filters.hiddenEdgeTypes.has(e.type),
  );

  let visibleNodes = nodes;
  if (filters.hideIsolated) {
    const connected = new Set<string>();
    for (const e of edges) {
      connected.add(e.from);
      connected.add(e.to);
    }
    visibleNodes = nodes.filter((n) => connected.has(n.id));
    const stillThere = new Set(visibleNodes.map((n) => n.id));
    edges = edges.filter((e) => stillThere.has(e.from) && stillThere.has(e.to));
  }

  return { nodes: visibleNodes, edges, total, removed: total - visibleNodes.length };
}

export interface NodeStats {
  inbound: number;
  outbound: number;
  degree: number;
}

export function degreeOf(edges: readonly AtharEdge[], nodeId: string): NodeStats {
  let inbound = 0;
  let outbound = 0;
  for (const e of edges) {
    if (e.from === nodeId) outbound++;
    if (e.to === nodeId) inbound++;
  }
  return { inbound, outbound, degree: inbound + outbound };
}
