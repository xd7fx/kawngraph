import { test } from "node:test";
import assert from "node:assert/strict";
import { fairSampleByLayer } from "./graph/sample";
import type { KawnNode, Layer } from "./types";

const mk = (id: string, layer: Layer): KawnNode => ({ id, type: "function", layer, label: id, sourcePath: id + ".ts" });

// A code-dominated graph (like a real repo): if you slice the first N globally you
// get almost only `code`. Fair sampling must keep every layer visible.
function codeHeavy(): KawnNode[] {
  const nodes: KawnNode[] = [];
  for (let i = 0; i < 200; i++) nodes.push(mk("code" + i, "code"));
  for (let i = 0; i < 60; i++) nodes.push(mk("docs" + i, "docs"));
  for (let i = 0; i < 10; i++) nodes.push(mk("test" + i, "test"));
  for (let i = 0; i < 5; i++) nodes.push(mk("config" + i, "config"));
  for (let i = 0; i < 3; i++) nodes.push(mk("data" + i, "data"));
  return nodes; // 278
}

test("fair sample keeps every layer represented (not almost all code)", () => {
  const out = fairSampleByLayer(codeHeavy(), [], 100);
  assert.ok(out.length <= 100, `respects the cap (got ${out.length})`);
  const layers = new Set(out.map((n) => n.layer));
  for (const L of ["code", "docs", "test", "config", "data"] as Layer[]) assert.ok(layers.has(L), `layer ${L} present`);
  // Tiny layers are shown in full; code never takes the whole sample.
  assert.equal(out.filter((n) => n.layer === "data").length, 3);
  assert.equal(out.filter((n) => n.layer === "config").length, 5);
  assert.ok(out.filter((n) => n.layer === "code").length < out.length, "code does not dominate the entire sample");
});

test("fair sample is deterministic", () => {
  const a = fairSampleByLayer(codeHeavy(), [], 80).map((n) => n.id);
  const b = fairSampleByLayer(codeHeavy(), [], 80).map((n) => n.id);
  assert.deepEqual(a, b);
});

test("fair sample returns everything when under the cap or uncapped", () => {
  const nodes = codeHeavy();
  assert.equal(fairSampleByLayer(nodes, [], 1000).length, nodes.length);
  assert.equal(fairSampleByLayer(nodes, [], Infinity).length, nodes.length);
});

test("within a layer, higher-degree nodes are preferred", () => {
  const nodes: KawnNode[] = [];
  for (let i = 0; i < 14; i++) nodes.push(mk("code" + i, "code"));
  nodes.push(mk("d0", "docs"), mk("d1", "docs"));
  // code0 is a hub (degree 5) — the highest-degree code node.
  const edges = ["code1", "code2", "code3", "code4", "code5"].map((to, i) => ({
    id: String(i),
    from: "code0",
    to,
    type: "calls" as const,
    confidence: "extracted" as const,
  }));
  const out = fairSampleByLayer(nodes, edges, 8);
  assert.ok(out.length <= 8, "respects the cap");
  assert.ok(out.filter((n) => n.layer === "code").length < 14, "some code is dropped");
  assert.ok(out.some((n) => n.id === "code0"), "the high-degree hub is kept");
});
