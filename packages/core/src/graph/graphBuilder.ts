import { AtharGraph, AtharNode, AtharEdge, ScanResult, GraphStats, ATHAR_VERSION } from "@athar/shared";

export interface BuildOptions {
  /** display path stored in the graph (posix). */
  root: string;
  /** drop edges whose endpoints don't exist as nodes (default true). */
  prune?: boolean;
}

/**
 * Merge scanner results into one graph: dedupe nodes by id and edges by id,
 * optionally prune dangling edges, and compute summary stats.
 */
export function buildGraph(results: ScanResult[], opts: BuildOptions): AtharGraph {
  const nodes = new Map<string, AtharNode>();
  const edges = new Map<string, AtharEdge>();

  for (const result of results) {
    for (const node of result.nodes) {
      if (!nodes.has(node.id)) nodes.set(node.id, node);
    }
    for (const edge of result.edges) {
      if (!edges.has(edge.id)) edges.set(edge.id, edge);
    }
  }

  if (opts.prune !== false) {
    for (const [id, edge] of edges) {
      if (!nodes.has(edge.from) || !nodes.has(edge.to)) edges.delete(id);
    }
  }

  const nodeList = [...nodes.values()];
  const edgeList = [...edges.values()];

  return {
    atharVersion: ATHAR_VERSION,
    generatedAt: new Date().toISOString(),
    root: opts.root,
    stats: computeStats(nodeList, edgeList),
    nodes: nodeList,
    edges: edgeList,
  };
}

function computeStats(nodes: AtharNode[], edges: AtharEdge[]): GraphStats {
  const byLayer: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byEdgeType: Record<string, number> = {};
  for (const node of nodes) {
    byLayer[node.layer] = (byLayer[node.layer] ?? 0) + 1;
    byType[node.type] = (byType[node.type] ?? 0) + 1;
  }
  for (const edge of edges) {
    byEdgeType[edge.type] = (byEdgeType[edge.type] ?? 0) + 1;
  }
  return { nodes: nodes.length, edges: edges.length, byLayer, byType, byEdgeType };
}
