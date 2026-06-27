import { test } from "node:test";
import assert from "node:assert/strict";
import { layout2d } from "./graph/layout2d";
import type { KawnEdge, KawnNode } from "./types";

const node = (id: string): KawnNode => ({ id, type: "function", layer: "code", label: id, sourcePath: id + ".ts" });
const edge = (from: string, to: string): KawnEdge => ({ id: `${from}->${to}`, from, to, type: "calls", confidence: "extracted" });

// A hub with spokes plus a couple of cross-links — enough structure to exercise
// repulsion, springs, and degree.
function fixture(): { nodes: KawnNode[]; edges: KawnEdge[] } {
  const nodes = ["hub", "a", "b", "c", "d", "e", "f"].map(node);
  const edges = [edge("hub", "a"), edge("hub", "b"), edge("hub", "c"), edge("hub", "d"), edge("hub", "e"), edge("a", "b"), edge("d", "f")];
  return { nodes, edges };
}

test("layout2d is deterministic — identical input yields identical positions", () => {
  const { nodes, edges } = fixture();
  const a = layout2d(nodes, edges);
  const b = layout2d(nodes, edges);
  assert.equal(a.positions.size, b.positions.size);
  for (const [id, pa] of a.positions) {
    const pb = b.positions.get(id);
    assert.ok(pb, `missing ${id}`);
    assert.equal(pa.x, pb!.x);
    assert.equal(pa.y, pb!.y);
  }
});

test("layout2d spreads in 2D (a constellation, not a stacked column or line)", () => {
  const { nodes, edges } = fixture();
  const { positions } = layout2d(nodes, edges);
  const xs = [...positions.values()].map((p) => p.x);
  const ys = [...positions.values()].map((p) => p.y);
  const xRange = Math.max(...xs) - Math.min(...xs);
  const yRange = Math.max(...ys) - Math.min(...ys);
  assert.ok(xRange > 1, "has horizontal spread");
  assert.ok(yRange > 1, "has vertical spread");
  // Neither axis collapses — i.e. not a vertical stack (the old layout's flaw).
  const ratio = Math.min(xRange, yRange) / Math.max(xRange, yRange);
  assert.ok(ratio > 0.25, `2D, not a line (aspect ratio ${ratio.toFixed(2)})`);
});

test("layout2d reports edge degree (drives node radius)", () => {
  const { nodes, edges } = fixture();
  const { degrees } = layout2d(nodes, edges);
  assert.equal(degrees.get("hub"), 5);
  assert.equal(degrees.get("f"), 1);
});

test("layout2d nodes do not all collapse to one point", () => {
  const { nodes, edges } = fixture();
  const { positions } = layout2d(nodes, edges);
  const unique = new Set([...positions.values()].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
  assert.ok(unique.size >= nodes.length - 1, "positions are distinct");
});

test("layout2d handles empty and single-node graphs", () => {
  assert.equal(layout2d([], []).positions.size, 0);
  const one = layout2d([node("solo")], []);
  assert.equal(one.positions.size, 1);
  assert.deepEqual(one.positions.get("solo"), { x: 0, y: 0 });
});
