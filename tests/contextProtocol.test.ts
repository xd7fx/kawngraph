import { test } from "node:test";
import assert from "node:assert/strict";
import { AtharNode, AtharEdge, edgeId, ContextPack } from "@athar/shared";
import { buildContextPack } from "@athar/core";
import {
  CONTEXT_PROTOCOL_VERSION,
  parseProtocolVersion,
  isProtocolCompatible,
  ATHAR_PROTOCOL_CAPABILITIES,
  layerForNodeType,
  toUniversalPack,
  validateUniversalPack,
  assertUniversalPack,
  toJson,
  parseJson,
  toMarkdown,
  type UniversalContextPack,
} from "@athar/context-protocol";
import { makeGraph } from "./helpers";

// ---------------------------------------------------------------------------
// A small OAuth-shaped graph (code + data + docs), every edge evidence-backed.
// Mirrors the shape used by the core context tests so conversion is exercised
// against a realistic, multi-layer pack.
// ---------------------------------------------------------------------------
function node(partial: Partial<AtharNode> & Pick<AtharNode, "id" | "type" | "layer" | "label">): AtharNode {
  return { sourcePath: "src/x.ts", ...partial };
}
// Each edge carries evidence on a distinct line so that, when attached to a
// node, it is genuinely additional provenance (not deduped against the node's
// own location).
let edgeLine = 100;
function edge(type: AtharEdge["type"], from: string, to: string): AtharEdge {
  return {
    id: edgeId(type, from, to),
    from,
    to,
    type,
    confidence: "linked",
    evidence: { sourcePath: "src/edges.ts", lineStart: edgeLine++ },
  };
}

function oauthGraph() {
  edgeLine = 100; // deterministic edge evidence lines per graph build
  const nodes: AtharNode[] = [
    node({ id: "file:route.ts", type: "file", layer: "code", label: "route.ts", sourcePath: "app/oauth/callback/route.ts" }),
    node({ id: "function:route.ts#GET", type: "function", layer: "code", label: "GET", sourcePath: "app/oauth/callback/route.ts", lineStart: 3, lineEnd: 20 }),
    node({ id: "function:auth.ts#getMerchantContext", type: "function", layer: "code", label: "getMerchantContext", sourcePath: "src/lib/merchantAuth.ts", lineStart: 5, lineEnd: 12 }),
    node({ id: "file:storeTokens.ts", type: "file", layer: "code", label: "storeTokens.ts", sourcePath: "src/server/storeTokens.ts" }),
    node({ id: "function:storeTokens.ts#saveStoreTokens", type: "function", layer: "code", label: "saveStoreTokens", sourcePath: "src/server/storeTokens.ts", lineStart: 4, lineEnd: 10 }),
    node({ id: "table:store_tokens", type: "table", layer: "data", label: "store_tokens", sourcePath: "db/0001.sql", lineStart: 10, lineEnd: 18 }),
    node({ id: "migration:0001.sql", type: "migration", layer: "data", label: "0001.sql", sourcePath: "db/0001.sql" }),
    node({ id: "doc:oauth.md", type: "doc", layer: "docs", label: "Zid OAuth Core Flow", sourcePath: "docs/oauth.md" }),
    node({ id: "section:oauth.md#store-tokens", type: "section", layer: "docs", label: "The store_tokens table", sourcePath: "docs/oauth.md", lineStart: 20, lineEnd: 25 }),
  ];
  const edges: AtharEdge[] = [
    edge("defines", "file:route.ts", "function:route.ts#GET"),
    edge("calls", "function:route.ts#GET", "function:auth.ts#getMerchantContext"),
    edge("calls", "function:route.ts#GET", "function:storeTokens.ts#saveStoreTokens"),
    edge("defines", "file:storeTokens.ts", "function:storeTokens.ts#saveStoreTokens"),
    edge("writes_table", "function:storeTokens.ts#saveStoreTokens", "table:store_tokens"),
    edge("defines", "migration:0001.sql", "table:store_tokens"),
    edge("documents", "doc:oauth.md", "file:route.ts"),
    edge("explains", "section:oauth.md#store-tokens", "table:store_tokens"),
  ];
  return makeGraph(nodes, edges);
}

const TASK = "fix the OAuth callback that writes store tokens";
function freshPack(): ContextPack {
  return buildContextPack(oauthGraph(), TASK, { mode: "all", budget: 8000 });
}
function freshUcp(): UniversalContextPack {
  return toUniversalPack(freshPack(), { graph: oauthGraph() });
}

// ---------------------------------------------------------------------------
// version
// ---------------------------------------------------------------------------
test("parseProtocolVersion parses major.minor and rejects junk", () => {
  assert.deepEqual(parseProtocolVersion("1.0"), { major: 1, minor: 0 });
  assert.deepEqual(parseProtocolVersion(" 2.7 "), { major: 2, minor: 7 });
  assert.equal(parseProtocolVersion("1"), null);
  assert.equal(parseProtocolVersion("1.2.3"), null);
  assert.equal(parseProtocolVersion("x.y"), null);
  assert.equal(parseProtocolVersion(""), null);
});

test("isProtocolCompatible is major-only and defaults to the current version", () => {
  assert.ok(isProtocolCompatible(CONTEXT_PROTOCOL_VERSION));
  assert.ok(isProtocolCompatible("1.0", "1.4"), "same major, different minor → compatible");
  assert.ok(!isProtocolCompatible("2.0", "1.0"), "different major → incompatible");
  assert.ok(!isProtocolCompatible("garbage"), "unparseable → incompatible");
});

// ---------------------------------------------------------------------------
// capabilities
// ---------------------------------------------------------------------------
test("ATHAR_PROTOCOL_CAPABILITIES advertises every guarantee and matches the protocol version", () => {
  const c = ATHAR_PROTOCOL_CAPABILITIES;
  assert.equal(c.protocolVersion, CONTEXT_PROTOCOL_VERSION);
  for (const flag of [c.evidence, c.explanations, c.ranking, c.tokenBudget, c.layeredSections, c.deterministic, c.noLlm]) {
    assert.equal(flag, true);
  }
  assert.ok(c.nodeKinds.includes("function"));
  assert.ok(c.nodeKinds.includes("table"));
  assert.ok(c.layers.includes("code"));
  assert.ok(c.layers.includes("data"));
  assert.ok(c.layers.includes("docs"));
});

// ---------------------------------------------------------------------------
// layerForNodeType
// ---------------------------------------------------------------------------
test("layerForNodeType maps kinds to layers (fallback when no graph is present)", () => {
  assert.equal(layerForNodeType("function"), "code");
  assert.equal(layerForNodeType("route"), "code");
  assert.equal(layerForNodeType("table"), "data");
  assert.equal(layerForNodeType("migration"), "data");
  assert.equal(layerForNodeType("doc"), "docs");
  assert.equal(layerForNodeType("section"), "docs");
  assert.equal(layerForNodeType("decision"), "decision");
  assert.equal(layerForNodeType("image"), "visual");
  assert.equal(layerForNodeType("package"), "config");
  assert.equal(layerForNodeType("test"), "test");
});

// ---------------------------------------------------------------------------
// toUniversalPack
// ---------------------------------------------------------------------------
test("toUniversalPack emits the four role-tagged sections in a fixed order", () => {
  const ucp = freshUcp();
  assert.deepEqual(
    ucp.sections.map((s) => [s.id, s.role]),
    [
      ["must_read", "primary"],
      ["related_docs", "supporting"],
      ["tables", "data"],
      ["tests", "verification"],
    ],
  );
});

test("toUniversalPack carries protocol metadata, budget, provenance and capabilities", () => {
  const pack = freshPack();
  const ucp = toUniversalPack(pack, { graph: oauthGraph() });
  assert.equal(ucp.protocolVersion, CONTEXT_PROTOCOL_VERSION);
  assert.equal(ucp.task, TASK);
  assert.equal(ucp.mode, pack.mode);
  assert.equal(ucp.confidence, pack.confidence);
  assert.deepEqual(ucp.budget, { limit: pack.budget, used: pack.tokensUsed });
  assert.equal(ucp.provenance.producer, "athar");
  assert.equal(ucp.provenance.atharVersion, pack.atharVersion);
  assert.equal(ucp.provenance.generatedAt, pack.generatedAt);
  assert.equal(ucp.capabilities, ATHAR_PROTOCOL_CAPABILITIES);
});

test("toUniversalPack honors a custom producer name", () => {
  const ucp = toUniversalPack(freshPack(), { graph: oauthGraph(), producer: "acme-agent" });
  assert.equal(ucp.provenance.producer, "acme-agent");
});

test("every item explains why, ranks 1-based within its section, and is grounded in evidence", () => {
  const ucp = freshUcp();
  for (const section of ucp.sections) {
    section.items.forEach((item, i) => {
      assert.equal(item.rank.position, i + 1, "positions are 1-based and sequential");
      assert.ok(typeof item.rank.score === "number");
      assert.ok(item.why.length > 0, "why is never empty");
      assert.ok(item.evidence.length > 0, "evidence is never empty");
      for (const e of item.evidence) assert.ok(e.sourcePath.length > 0, "evidence has a source path");
      assert.ok(item.location.path.length > 0);
      assert.ok(item.tokensEstimate > 0);
    });
  }
});

test("item fields are faithfully mapped from the source ContextItem", () => {
  const pack = freshPack();
  const ucp = toUniversalPack(pack, { graph: oauthGraph() });
  const first = pack.mustRead[0];
  const mapped = ucp.sections[0].items[0];
  assert.equal(mapped.id, first.id);
  assert.equal(mapped.kind, first.type);
  assert.equal(mapped.label, first.label);
  assert.equal(mapped.why, first.reason);
  assert.equal(mapped.rank.score, first.score);
  assert.equal(mapped.tokensEstimate, first.tokensEstimate);
  assert.deepEqual(mapped.location, { path: first.sourcePath, lineStart: first.lineStart, lineEnd: first.lineEnd });
});

test("layer is taken from the graph node when a graph is supplied", () => {
  const ucp = freshUcp();
  const tables = ucp.sections.find((s) => s.id === "tables");
  assert.ok(tables && tables.items.length > 0, "tables section is populated");
  for (const item of tables!.items) assert.equal(item.layer, "data");
});

test("without a graph, layer falls back to the node-kind mapping and evidence is the item's own location", () => {
  const pack = freshPack();
  const ucp = toUniversalPack(pack); // no graph
  for (const section of ucp.sections) {
    for (const item of section.items) {
      assert.equal(item.layer, layerForNodeType(item.kind));
      // No edges to draw from → evidence is exactly the item's own source location.
      assert.equal(item.evidence.length, 1);
      assert.equal(item.evidence[0].sourcePath, item.location.path);
    }
  }
});

test("with a graph, connecting-edge evidence enriches an item beyond its own location", () => {
  const ucp = freshUcp();
  const all = ucp.sections.flatMap((s) => s.items);
  // At least one connected node (e.g. the GET route or the table) gains extra
  // evidence from the edges that earned it a place.
  assert.ok(all.some((i) => i.evidence.length > 1), "edge evidence is attached when the graph is present");
});

test("maxEvidencePerItem bounds the attached evidence (own location + N edges)", () => {
  const ucp = toUniversalPack(freshPack(), { graph: oauthGraph(), maxEvidencePerItem: 1 });
  for (const item of ucp.sections.flatMap((s) => s.items)) {
    assert.ok(item.evidence.length <= 2, "own location + at most 1 edge evidence");
  }
});

test("toUniversalPack maps risks and excluded entries", () => {
  const pack = buildContextPack(oauthGraph(), TASK, { mode: "all", budget: 900 });
  const ucp = toUniversalPack(pack, { graph: oauthGraph() });
  assert.equal(ucp.excluded.length, pack.excluded.length);
  if (pack.excluded.length > 0) {
    assert.deepEqual(
      ucp.excluded.map((e) => e.id).sort(),
      pack.excluded.map((e) => e.id).sort(),
    );
  }
  assert.equal(ucp.risks.length, pack.risks.length);
});

test("toUniversalPack is deterministic for identical input", () => {
  // Build the pack once: converting the SAME pack twice isolates the function
  // under test from the pack's own wall-clock `generatedAt`.
  const pack = freshPack();
  const a = toUniversalPack(pack, { graph: oauthGraph() });
  const b = toUniversalPack(pack, { graph: oauthGraph() });
  assert.deepEqual(a, b);
});

test("a freshly converted pack always validates", () => {
  const { ok, errors } = validateUniversalPack(freshUcp());
  assert.ok(ok, `expected valid, got: ${errors.join(", ")}`);
});

// ---------------------------------------------------------------------------
// validateUniversalPack — failure modes
// ---------------------------------------------------------------------------
test("validateUniversalPack rejects non-objects", () => {
  for (const bad of [null, 42, "x", [], undefined]) {
    assert.equal(validateUniversalPack(bad).ok, false);
  }
});

test("validateUniversalPack flags an incompatible protocol version", () => {
  const p = freshUcp();
  p.protocolVersion = "2.0";
  const { ok, errors } = validateUniversalPack(p);
  assert.ok(!ok);
  assert.ok(errors.some((e) => e.includes("protocolVersion")));
});

test("validateUniversalPack flags a bad mode and out-of-range confidence", () => {
  const p = freshUcp();
  (p as { mode: string }).mode = "sideways";
  p.confidence = 1.5;
  const { ok, errors } = validateUniversalPack(p);
  assert.ok(!ok);
  assert.ok(errors.some((e) => e.includes("mode")));
  assert.ok(errors.some((e) => e.includes("confidence")));
});

test("validateUniversalPack flags a malformed budget and provenance", () => {
  const p = freshUcp();
  (p as { budget: unknown }).budget = { limit: "lots" };
  (p as { provenance: unknown }).provenance = { producer: "athar" };
  const { ok, errors } = validateUniversalPack(p);
  assert.ok(!ok);
  assert.ok(errors.some((e) => e.includes("budget")));
  assert.ok(errors.some((e) => e.includes("provenance")));
});

test("validateUniversalPack flags a bad section role", () => {
  const p = freshUcp();
  (p.sections[0] as { role: string }).role = "headline";
  const { ok, errors } = validateUniversalPack(p);
  assert.ok(!ok);
  assert.ok(errors.some((e) => e.includes("role")));
});

test("validateUniversalPack flags an item missing its 'why'", () => {
  const p = freshUcp();
  delete (p.sections[0].items[0] as { why?: string }).why;
  const { ok, errors } = validateUniversalPack(p);
  assert.ok(!ok);
  assert.ok(errors.some((e) => e.includes(".why")));
});

test("validateUniversalPack enforces the core promise: non-empty evidence per item", () => {
  const p = freshUcp();
  p.sections[0].items[0].evidence = [];
  const { ok, errors } = validateUniversalPack(p);
  assert.ok(!ok);
  assert.ok(errors.some((e) => e.includes("evidence")));
});

test("validateUniversalPack flags a malformed rank", () => {
  const p = freshUcp();
  (p.sections[0].items[0] as { rank: unknown }).rank = { score: "high" };
  const { ok, errors } = validateUniversalPack(p);
  assert.ok(!ok);
  assert.ok(errors.some((e) => e.includes("rank")));
});

test("assertUniversalPack returns the value when valid and throws (with all problems) when not", () => {
  const valid = freshUcp();
  assert.equal(assertUniversalPack(valid), valid);
  assert.throws(() => assertUniversalPack({}), /invalid UniversalContextPack/);
});

// ---------------------------------------------------------------------------
// json — canonical serialization + validating parse
// ---------------------------------------------------------------------------
test("toJson/parseJson is a lossless round-trip", () => {
  const ucp = freshUcp();
  const back = parseJson(toJson(ucp));
  assert.deepEqual(back, ucp);
});

test("toJson is canonical: object keys are emitted in sorted order at every level", () => {
  const json = toJson(freshUcp());
  const obj = JSON.parse(json) as Record<string, unknown>;
  assert.deepEqual(Object.keys(obj), [...Object.keys(obj)].sort());
  const item = (obj.sections as Array<{ items: Array<Record<string, unknown>> }>)[0].items[0];
  assert.deepEqual(Object.keys(item), [...Object.keys(item)].sort());
});

test("toJson is stable/idempotent regardless of input key order", () => {
  const ucp = freshUcp();
  const canonical = toJson(ucp);
  // Re-serializing a parsed copy yields byte-identical JSON.
  assert.equal(toJson(parseJson(canonical)), canonical);
});

test("toJson supports compact output", () => {
  const ucp = freshUcp();
  const compact = toJson(ucp, { pretty: false });
  assert.ok(!compact.includes("\n"), "compact output is single-line");
  assert.deepEqual(parseJson(compact), ucp);
});

test("parseJson throws on malformed JSON", () => {
  assert.throws(() => parseJson("{ not json"), /invalid JSON/);
});

test("parseJson throws on valid JSON that is not a valid pack", () => {
  assert.throws(() => parseJson(JSON.stringify({ task: "x" })), /invalid UniversalContextPack/);
});

// ---------------------------------------------------------------------------
// markdown
// ---------------------------------------------------------------------------
test("toMarkdown renders the task, role-tagged sections, and every item's why + evidence", () => {
  const md = toMarkdown(freshUcp());
  assert.ok(md.includes(`# Context Pack — "${TASK}"`));
  assert.ok(md.includes("## Must read (primary)"));
  assert.ok(md.includes("## Tables (data)"));
  assert.ok(md.includes("## Tests (verification)"));
  assert.ok(md.includes("why:"));
  assert.ok(md.includes("evidence:"));
  assert.ok(md.includes(`protocol:** v${CONTEXT_PROTOCOL_VERSION}`) || md.includes(`v${CONTEXT_PROTOCOL_VERSION}`));
});

test("toMarkdown shows '_none_' for an empty section", () => {
  // A docs-free, code-only pack leaves the related-docs section empty.
  const pack = buildContextPack(oauthGraph(), "store tokens", { mode: "code", budget: 8000 });
  const md = toMarkdown(toUniversalPack(pack, { graph: oauthGraph() }));
  assert.ok(md.includes("_none_"), "empty sections render a placeholder, not nothing");
});

test("toMarkdown is deterministic", () => {
  assert.equal(toMarkdown(freshUcp()), toMarkdown(freshUcp()));
});

test("toMarkdown ends with a single trailing newline", () => {
  const md = toMarkdown(freshUcp());
  assert.ok(md.endsWith("\n"));
  assert.ok(!md.endsWith("\n\n"));
});
