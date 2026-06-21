import { KawnGraph, KawnNode, KawnEdge, ScanResult, GraphStats, KAWN_VERSION } from "@kawngraph/shared";

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
export function buildGraph(results: ScanResult[], opts: BuildOptions): KawnGraph {
  const nodes = new Map<string, KawnNode>();
  const edges = new Map<string, KawnEdge>();

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
    kawnVersion: KAWN_VERSION,
    generatedAt: new Date().toISOString(),
    root: opts.root,
    stats: computeStats(nodeList, edgeList),
    nodes: nodeList,
    edges: edgeList,
  };
}

function computeStats(nodes: KawnNode[], edges: KawnEdge[]): GraphStats {
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
