import { AtharGraph, AtharNode } from "@athar/shared";

function resolveOne(graph: AtharGraph, query: string): AtharNode | null {
  return (
    graph.nodes.find((n) => n.id === query) ??
    graph.nodes.find((n) => n.id.endsWith("#" + query)) ??
    graph.nodes.find((n) => n.label === query) ??
    null
  );
}

/**
 * Shortest path between two nodes over the undirected graph (relationships are
 * followed in both directions). Returns the node sequence, or null if none.
 */
export function shortestPath(graph: AtharGraph, fromQuery: string, toQuery: string): AtharNode[] | null {
  const from = resolveOne(graph, fromQuery);
  const to = resolveOne(graph, toQuery);
  if (!from || !to) return null;
  if (from.id === to.id) return [from];

  const adj = new Map<string, string[]>();
  const link = (a: string, b: string): void => {
    const arr = adj.get(a) ?? [];
    arr.push(b);
    adj.set(a, arr);
  };
  for (const e of graph.edges) {
    link(e.from, e.to);
    link(e.to, e.from);
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));
  const prev = new Map<string, string | null>([[from.id, null]]);
  const queue: string[] = [from.id];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to.id) break;
    for (const neighbor of adj.get(current) ?? []) {
      if (prev.has(neighbor)) continue;
      prev.set(neighbor, current);
      queue.push(neighbor);
    }
  }

  if (!prev.has(to.id)) return null;
  const path: AtharNode[] = [];
  let cursor: string | null = to.id;
  while (cursor) {
    const node = byId.get(cursor);
    if (node) path.unshift(node);
    cursor = prev.get(cursor) ?? null;
  }
  return path;
}
