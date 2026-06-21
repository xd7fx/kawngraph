/**
 * Deterministic layered layout: nodes are placed into vertical columns by layer
 * (ordered by LAYER_ORDER) and sorted by id within each column. The same input
 * always yields the same positions — no physics, no randomness — so the graph
 * is stable across reloads and unit-testable.
 */
import type { KawnNode } from "../types";
import { layerOrderIndex } from "./nodeStyle";

export interface XY {
  x: number;
  y: number;
}

export const COL_WIDTH = 280;
export const ROW_HEIGHT = 84;

export function layoutPositions(nodes: readonly KawnNode[]): Map<string, XY> {
  const byLayer = new Map<string, KawnNode[]>();
  for (const n of nodes) {
    let arr = byLayer.get(n.layer);
    if (!arr) {
      arr = [];
      byLayer.set(n.layer, arr);
    }
    arr.push(n);
  }

  const layers = [...byLayer.keys()].sort(
    (a, b) => layerOrderIndex(a) - layerOrderIndex(b) || (a < b ? -1 : a > b ? 1 : 0),
  );

  const pos = new Map<string, XY>();
  layers.forEach((layer, col) => {
    const arr = byLayer.get(layer)!;
    arr.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    arr.forEach((node, row) => {
      pos.set(node.id, { x: col * COL_WIDTH, y: row * ROW_HEIGHT });
    });
  });
  return pos;
}

/** The set of distinct layers present, in column order (for legends/headers). */
export function orderedLayers(nodes: readonly KawnNode[]): string[] {
  const set = new Set<string>();
  for (const n of nodes) set.add(n.layer);
  return [...set].sort(
    (a, b) => layerOrderIndex(a) - layerOrderIndex(b) || (a < b ? -1 : a > b ? 1 : 0),
  );
}
