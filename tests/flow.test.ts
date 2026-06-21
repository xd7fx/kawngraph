import { test } from "node:test";
import assert from "node:assert/strict";
import { KawnNode, KawnEdge, edgeId } from "@kawngraph/shared";
import { flowBetween, MAX_FLOW_NODES } from "@kawngraph/core";
import { makeGraph } from "./helpers";

// --- a tiny, evidence-backed graph: a single linear chain plus a doc and an orphan ---
//
//   doc:a.md --documents--> file:a.ts --defines--> function:a.ts#GET
//        --calls--> function:b.ts#save --writes_table--> table:tokens
//
//   table:orphan has no edges at all (used for the "no path" case).

function node(partial: Partial<KawnNode> & Pick<KawnNode, "id" | "type" | "layer" | "label">): KawnNode {
  return { sourcePath: "src/x.ts", ...partial };
}
function edge(type: KawnEdge["type"], from: string, to: string): KawnEdge {
  return {
    id: edgeId(type, from, to),
    from,
    to,
    type,
    confidence: "linked",
    evidence: { sourcePath: "src/x.ts", lineStart: 1 },
  };
}

function chainGraph() {
  const nodes: KawnNode[] = [
    node({ id: "file:a.ts", type: "file", layer: "code", label: "a.ts", sourcePath: "app/a.ts" }),
    node({ id: "function:a.ts#GET", type: "function", layer: "code", label: "GET", sourcePath: "app/a.ts", lineStart: 1, lineEnd: 9 }),
    node({ id: "function:b.ts#save", type: "function", layer: "code", label: "save", sourcePath: "src/b.ts", lineStart: 1, lineEnd: 9 }),
    node({ id: "table:tokens", type: "table", layer: "data", label: "tokens", sourcePath: "db/0001.sql", lineStart: 1, lineEnd: 5 }),
    node({ id: "doc:a.md", type: "doc", layer: "docs", label: "A doc", sourcePath: "docs/a.md" }),
    node({ id: "table:orphan", type: "table", layer: "data", label: "orphan", sourcePath: "db/0002.sql" }),
  ];
  const edges: KawnEdge[] = [
    edge("defines", "file:a.ts", "function:a.ts#GET"),
    edge("calls", "function:a.ts#GET", "function:b.ts#save"),
    edge("writes_table", "function:b.ts#save", "table:tokens"),
    edge("documents", "doc:a.md", "file:a.ts"),
  ];
  return makeGraph(nodes, edges);
}

/** Every step's edge must actually connect the two nodes it claims to. */
function stepIsCoherent(step: { from: KawnNode; to: KawnNode; edge: KawnEdge; reversed: boolean }): void {
  const endpoints = new Set([step.edge.from, step.edge.to]);
  assert.ok(endpoints.has(step.from.id), "edge must touch step.from");
  assert.ok(endpoints.has(step.to.id), "edge must touch step.to");
  if (step.reversed) {
    assert.equal(step.edge.from, step.to.id, "reversed: stored edge runs to->from");
    assert.equal(step.edge.to, step.from.id);
  } else {
    assert.equal(step.edge.from, step.from.id, "forward: stored edge runs from->to");
    assert.equal(step.edge.to, step.to.id);
  }
}

test("flowBetween follows the stored edge direction forward, evidence intact", () => {
  const g = chainGraph();
  const flow = flowBetween(g, "file:a.ts", "table:tokens");
  assert.equal(flow.found, true);
  assert.deepEqual(
    flow.nodes.map((n) => n.id),
    ["file:a.ts", "function:a.ts#GET", "function:b.ts#save", "table:tokens"],
  );
  assert.equal(flow.steps.length, 3);
  for (const step of flow.steps) {
    assert.equal(step.reversed, false, "every hop runs with the stored edge direction");
    assert.ok(step.edge.evidence, "each traversed relationship keeps its evidence");
    stepIsCoherent(step);
  }
  assert.deepEqual(
    flow.steps.map((s) => s.edge.type),
    ["defines", "calls", "writes_table"],
  );
});

test("flowBetween reads a relationship backwards when needed, flagging reversed", () => {
  const g = chainGraph();
  const flow = flowBetween(g, "table:tokens", "file:a.ts");
  assert.equal(flow.found, true);
  assert.deepEqual(
    flow.nodes.map((n) => n.id),
    ["table:tokens", "function:b.ts#save", "function:a.ts#GET", "file:a.ts"],
  );
  assert.equal(flow.steps.length, 3);
  for (const step of flow.steps) {
    assert.equal(step.reversed, true, "the chain is stored the other way, so every hop is reversed");
    stepIsCoherent(step);
  }
});

test("flowBetween reports found=false when the nodes are disconnected", () => {
  const g = chainGraph();
  const flow = flowBetween(g, "file:a.ts", "table:orphan");
  assert.equal(flow.found, false);
  assert.deepEqual(flow.nodes, []);
  assert.deepEqual(flow.steps, []);
  // The query echo is preserved even on a miss, so the UI can label the result.
  assert.equal(flow.from, "file:a.ts");
  assert.equal(flow.to, "table:orphan");
});

test("flowBetween reports found=false when a query matches no node", () => {
  const g = chainGraph();
  const flow = flowBetween(g, "file:a.ts", "does-not-exist");
  assert.equal(flow.found, false);
  assert.deepEqual(flow.nodes, []);
});

test("flowBetween is bounded by maxNodes and never returns fewer than 2", () => {
  const g = chainGraph();

  const capped = flowBetween(g, "file:a.ts", "table:tokens", 2);
  assert.equal(capped.found, true);
  assert.equal(capped.nodes.length, 2, "maxNodes caps the returned sequence");
  assert.equal(capped.steps.length, 1, "one fewer step than nodes");
  assert.deepEqual(capped.nodes.map((n) => n.id), ["file:a.ts", "function:a.ts#GET"]);

  // A nonsense tiny bound is clamped up to the floor of 2, never 0 or 1.
  const floored = flowBetween(g, "file:a.ts", "table:tokens", 1);
  assert.equal(floored.nodes.length, 2, "maxNodes < 2 is clamped to the floor");
});

test("flowBetween caps an oversized maxNodes at MAX_FLOW_NODES", () => {
  const g = chainGraph();
  const flow = flowBetween(g, "file:a.ts", "table:tokens", 10_000);
  assert.ok(flow.nodes.length <= MAX_FLOW_NODES);
  assert.equal(MAX_FLOW_NODES, 64);
});

test("flowBetween is deterministic for the same input", () => {
  const g = chainGraph();
  const a = flowBetween(g, "file:a.ts", "table:tokens");
  const b = flowBetween(g, "file:a.ts", "table:tokens");
  assert.deepEqual(a, b);
});
