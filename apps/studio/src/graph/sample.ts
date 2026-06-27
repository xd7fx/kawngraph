/**
 * Fair, layer-aware down-sampling for the constellation Map. Taking the first N
 * nodes globally makes the view almost all `code` (it dominates the count); this
 * instead allocates the cap PROPORTIONALLY across layers — with a per-layer
 * minimum so small layers (data, config) never vanish — and keeps the
 * highest-degree nodes within each layer. Deterministic (sorts by degree then id),
 * so the visible set is stable across renders.
 */
import type { KawnEdge, KawnNode } from "../types";

const MIN_PER_LAYER = 6;

export function fairSampleByLayer(nodes: readonly KawnNode[], edges: readonly KawnEdge[], cap: number): KawnNode[] {
  if (!Number.isFinite(cap) || nodes.length <= cap) return [...nodes];

  // Degree within the visible set drives "importance".
  const present = new Set(nodes.map((n) => n.id));
  const deg = new Map<string, number>();
  for (const e of edges) {
    if (present.has(e.from)) deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
    if (present.has(e.to)) deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  }

  // Group by layer; sort each group by degree desc, then id (deterministic).
  const byLayer = new Map<string, KawnNode[]>();
  for (const n of nodes) {
    const arr = byLayer.get(n.layer);
    if (arr) arr.push(n);
    else byLayer.set(n.layer, [n]);
  }
  for (const arr of byLayer.values()) {
    arr.sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0) || (a.id < b.id ? -1 : 1));
  }

  // Stable (alphabetical) layer order for deterministic remainder handling.
  const layers = [...byLayer.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const total = nodes.length;

  // Proportional allocation with a per-layer minimum, clamped to each layer's size.
  const alloc = new Map<string, number>();
  let used = 0;
  for (const [layer, arr] of layers) {
    const want = Math.min(arr.length, Math.max(Math.min(MIN_PER_LAYER, arr.length), Math.round((cap * arr.length) / total)));
    alloc.set(layer, want);
    used += want;
  }

  // Reconcile to exactly `cap` (largest layers absorb the +/- first).
  const bySize = layers.slice().sort((a, b) => b[1].length - a[1].length);
  let diff = cap - used;
  while (diff !== 0) {
    let changed = false;
    for (const [layer, arr] of bySize) {
      if (diff === 0) break;
      const cur = alloc.get(layer)!;
      if (diff > 0 && cur < arr.length) {
        alloc.set(layer, cur + 1);
        diff--;
        changed = true;
      } else if (diff < 0 && cur > Math.min(MIN_PER_LAYER, arr.length)) {
        alloc.set(layer, cur - 1);
        diff++;
        changed = true;
      }
    }
    if (!changed) break; // every layer at its floor/ceiling
  }

  const out: KawnNode[] = [];
  for (const [layer, arr] of layers) out.push(...arr.slice(0, alloc.get(layer)!));
  return out;
}
