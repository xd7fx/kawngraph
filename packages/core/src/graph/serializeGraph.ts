import { KawnGraph } from "@kawngraph/shared";

const byId = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Serialize a graph to JSON with stable node/edge ordering so `.kawn/graph.json`
 * diffs cleanly across scans.
 */
export function serializeGraph(graph: KawnGraph): string {
  const stable: KawnGraph = {
    ...graph,
    nodes: [...graph.nodes].sort(byId),
    edges: [...graph.edges].sort(byId),
  };
  return JSON.stringify(stable, null, 2) + "\n";
}
