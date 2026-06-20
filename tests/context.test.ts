import { test } from "node:test";
import assert from "node:assert/strict";
import { AtharNode, AtharEdge, edgeId } from "@athar/shared";
import {
  rankContext,
  extractKeywords,
  buildContextPack,
  estimateTokens,
} from "@athar/core";
import { makeGraph } from "./helpers";

// A tiny OAuth-shaped graph: code + data + docs, every edge evidence-backed.
function node(partial: Partial<AtharNode> & Pick<AtharNode, "id" | "type" | "layer" | "label">): AtharNode {
  return { sourcePath: "src/x.ts", ...partial };
}
function edge(type: AtharEdge["type"], from: string, to: string): AtharEdge {
  return { id: edgeId(type, from, to), from, to, type, confidence: "linked", evidence: { sourcePath: "src/x.ts", lineStart: 1 } };
}

function oauthGraph() {
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

test("extractKeywords drops stopwords and 1-char tokens, lowercases", () => {
  const kw = extractKeywords("Fix the Zid OAuth callback");
  assert.ok(kw.includes("zid"));
  assert.ok(kw.includes("oauth"));
  assert.ok(kw.includes("callback"));
  assert.ok(!kw.includes("fix"), "stopword 'fix' should be dropped");
  assert.ok(!kw.includes("the"), "stopword 'the' should be dropped");
});

test("estimateTokens is a positive rough estimate, never below the floor", () => {
  const big = estimateTokens({ id: "f", type: "function", layer: "code", label: "x", sourcePath: "a.ts", lineStart: 1, lineEnd: 100 });
  const small = estimateTokens({ id: "g", type: "function", layer: "code", label: "x", sourcePath: "a.ts" });
  assert.ok(big > small);
  assert.ok(small >= 8, "min token floor");
});

test("rankContext mode=code never leaks docs, but keeps data (SQL)", () => {
  const g = oauthGraph();
  const ranked = rankContext(g, "store tokens", { mode: "code" });
  const layers = new Set(ranked.map((r) => r.node.layer));
  assert.ok(!layers.has("docs"), "docs must not appear in code scope");
  assert.ok(ranked.some((r) => r.node.layer === "data"), "data layer (SQL) must stay reachable in code scope");
});

test("rankContext mode=docs returns only docs", () => {
  const g = oauthGraph();
  const ranked = rankContext(g, "store tokens", { mode: "docs" });
  assert.ok(ranked.length > 0);
  assert.ok(ranked.every((r) => r.node.layer === "docs"), "docs scope must contain only docs");
});

test("buildContextPack keeps layers in separate buckets and includes related docs", () => {
  const g = oauthGraph();
  const pack = buildContextPack(g, "fix the OAuth callback that writes store tokens", { mode: "all", budget: 8000 });
  assert.ok(pack.mustRead.length > 0, "must have code to read");
  assert.ok(pack.tables.length > 0, "tables bucket populated");
  assert.ok(pack.relatedDocs.length > 0, "related docs included in mode=all");
  // buckets must not bleed into each other
  assert.ok(pack.mustRead.every((i) => i.type !== "doc" && i.type !== "section"));
  assert.ok(pack.tables.every((i) => i.type === "table" || i.type === "migration"));
});

test("token budget gates optional items: code over budget is excluded, not lost", () => {
  const g = oauthGraph();
  const pack = buildContextPack(g, "fix the OAuth callback store tokens", { mode: "all", budget: 900 });
  assert.ok(pack.tokensUsed <= pack.budget, "optional code/docs are added only while they fit the budget");
  assert.ok(pack.mustRead.length > 0, "some code still fits");
  assert.ok(pack.excluded.length > 0, "the rest is surfaced as excluded with a reason, not silently dropped");
  for (const ex of pack.excluded) assert.match(ex.reason, /over budget/);
});

test("SQL is never dropped for budget — tables stay even when they exceed a tiny budget (rule #10)", () => {
  const g = oauthGraph();
  const tiny = buildContextPack(g, "fix the OAuth callback store tokens", { mode: "all", budget: 10 });
  assert.ok(tiny.tables.length > 0, "tables are a mandatory floor — SQL is load-bearing");
  assert.equal(tiny.mustRead.length, 0, "no optional code fits a tiny budget");
});

test("buildContextPack is deterministic for the same input", () => {
  const g = oauthGraph();
  const a = buildContextPack(g, "fix the OAuth callback store tokens", { mode: "all", budget: 4000 });
  const b = buildContextPack(g, "fix the OAuth callback store tokens", { mode: "all", budget: 4000 });
  const strip = (p: typeof a) => ({ ...p, generatedAt: "" });
  assert.deepEqual(strip(a), strip(b));
});

test("confidence stays within 0..1 and reflects keyword coverage", () => {
  const g = oauthGraph();
  const hit = buildContextPack(g, "store tokens oauth", { mode: "all", budget: 8000 });
  const miss = buildContextPack(g, "kubernetes helm chart", { mode: "all", budget: 8000 });
  assert.ok(hit.confidence >= 0 && hit.confidence <= 1);
  assert.ok(miss.confidence >= 0 && miss.confidence <= 1);
  assert.ok(hit.confidence > miss.confidence, "a well-covered task should score higher");
});
