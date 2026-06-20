import { AtharGraph, AtharNode, EdgeType } from "@athar/shared";

/** A node reached by reverse traversal, with how far and via which edge. */
export interface ReachNode {
  node: AtharNode;
  depth: number;
  via: EdgeType;
}

export interface ReachOptions {
  /** Max hops from the seed (default 6). */
  maxDepth?: number;
  /** Cap on returned nodes — keeps impact bounded on large graphs (default Infinity). */
  maxNodes?: number;
}

export interface ReachResult {
  nodes: ReachNode[];
  /** true when the result was cut off at `maxNodes` (more dependents exist). */
  truncated: boolean;
}

/** Edge types that mean "the source depends on the target". */
export const DEPENDENCY_EDGES = new Set<EdgeType>(["calls", "imports", "references"]);

/**
 * Multi-seed **reverse** reachability: starting from the seed node ids, walk
 * dependency edges backwards (callers, importers, referrers) to find everything
 * that depends on the seed, breadth-first and nearest-first. Seeds are never
 * included in the result. Deterministic (adjacency and frontier are sorted) and
 * bounded (`maxDepth`, `maxNodes`).
 */
export function reverseReachable(
  graph: AtharGraph,
  seedIds: Iterable<string>,
  opts: ReachOptions = {},
): ReachResult {
  const maxDepth = opts.maxDepth ?? 6;
  const maxNodes = opts.maxNodes ?? Infinity;
  const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));

  // Build the reverse adjacency once, sorted for deterministic traversal order.
  const incoming = new Map<string, { from: string; type: EdgeType }[]>();
  for (const e of graph.edges) {
    if (!DEPENDENCY_EDGES.has(e.type)) continue;
    const arr = incoming.get(e.to) ?? [];
    arr.push({ from: e.from, type: e.type });
    incoming.set(e.to, arr);
  }
  for (const arr of incoming.values()) {
    arr.sort((a, b) => a.from.localeCompare(b.from) || a.type.localeCompare(b.type));
  }

  const seen = new Set<string>(seedIds);
  const out: ReachNode[] = [];
  let frontier = [...seen].sort();
  let truncated = false;

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const dep of incoming.get(id) ?? []) {
        if (seen.has(dep.from)) continue;
        seen.add(dep.from);
        const node = byId.get(dep.from);
        if (!node) continue;
        if (out.length >= maxNodes) return { nodes: out, truncated: true };
        out.push({ node, depth, via: dep.type });
        next.push(dep.from);
      }
    }
    frontier = next.sort();
  }

  return { nodes: out, truncated };
}
