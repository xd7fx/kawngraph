import { test } from "node:test";
import assert from "node:assert/strict";
import { KawnNode, KawnEdge, edgeId } from "@kawngraph/shared";
import {
  rankContext,
  resolveMode,
  extractKeywords,
  buildContextPack,
  estimateTokens,
} from "@kawngraph/core";
import { makeGraph } from "./helpers";

// A tiny OAuth-shaped graph: code + data + docs, every edge evidence-backed.
function node(partial: Partial<KawnNode> & Pick<KawnNode, "id" | "type" | "layer" | "label">): KawnNode {
  return { sourcePath: "src/x.ts", ...partial };
}
function edge(type: KawnEdge["type"], from: string, to: string): KawnEdge {
  return { id: edgeId(type, from, to), from, to, type, confidence: "linked", evidence: { sourcePath: "src/x.ts", lineStart: 1 } };
}

function oauthGraph() {
  const nodes: KawnNode[] = [
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
  const edges: KawnEdge[] = [
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

// ---------------------------------------------------------------------------
// resolveMode: `auto` narrows to a single layer ONLY when the task is
// unambiguously about it; mixed/absent signals stay `all` (recall over precision).
// ---------------------------------------------------------------------------

test("resolveMode keeps explicit modes and resolves auto conservatively", () => {
  // an explicit mode is always honored verbatim
  assert.equal(resolveMode("anything at all", "code"), "code", "explicit mode passes through");
  assert.equal(resolveMode("anything at all", "all"), "all");

  // a single unambiguous layer signal narrows `auto` to that layer
  assert.equal(resolveMode("add a column to the orders table", "auto"), "data");
  assert.equal(resolveMode("write a unit test for the parser", "auto"), "tests");
  assert.equal(resolveMode("update the onboarding docs", "auto"), "docs");

  // mixed or absent signals stay `all` so recall is never sacrificed
  assert.equal(resolveMode("add tests for the database schema", "auto"), "all", "data+tests → stay broad");
  assert.equal(resolveMode("fix the oauth callback", "auto"), "all", "no layer signal → all");
});

// ---------------------------------------------------------------------------
// Mode scoping for data/tests (code/docs are covered above). Docs never leak
// into a non-docs scope; the layer under question stays reachable.
// ---------------------------------------------------------------------------

test("rankContext mode=data keeps tables + the code that touches them, never docs", () => {
  const g = oauthGraph();
  const ranked = rankContext(g, "store tokens", { mode: "data" });
  const layers = new Set(ranked.map((r) => r.node.layer));
  assert.ok(layers.has("data"), "the store_tokens table is in scope");
  assert.ok(layers.has("code"), "code that writes the table stays reachable");
  assert.ok(!layers.has("docs"), "data scope must never leak docs");
});

test("rankContext mode=tests keeps code under test but never docs or data", () => {
  const g = oauthGraph();
  const ranked = rankContext(g, "store tokens", { mode: "tests" });
  assert.ok(ranked.length > 0, "code under test is reachable");
  assert.ok(
    ranked.every((r) => r.node.layer === "test" || r.node.layer === "code"),
    "tests scope is tests + code only",
  );
});

// ---------------------------------------------------------------------------
// Tier assignment: keyword seeds are `exact`, 1 hop is `direct`, 2+ is `second-order`.
// ---------------------------------------------------------------------------

test("rankContext tiers nodes by distance: exact seed, direct 1-hop, second-order 2-hop", () => {
  const g = oauthGraph();
  const ranked = rankContext(g, "store tokens", { mode: "all" });
  const tierOf = (id: string): string | undefined => ranked.find((r) => r.node.id === id)?.tier;

  // direct keyword hits are the `exact` tier
  assert.equal(tierOf("table:store_tokens"), "exact", "the matched table is an exact hit");
  assert.equal(tierOf("function:storeTokens.ts#saveStoreTokens"), "exact");

  // the migration that defines the table is one hop from the table seed → direct
  assert.equal(tierOf("migration:0001.sql"), "direct");

  // getMerchantContext is two hops from any seed (via the route's GET) → second-order
  assert.equal(tierOf("function:auth.ts#getMerchantContext"), "second-order");

  // every returned item carries a tier from the allowed set
  const allowed = new Set(["exact", "direct", "second-order"]);
  assert.ok(ranked.every((r) => allowed.has(r.tier)), "tier is always one of the three known values");
});

// ---------------------------------------------------------------------------
// Precision penalties: a high-degree hub and a generically-named doc must not
// out-rank a precise node that matches the query just as well.
// ---------------------------------------------------------------------------

test("a high-degree hub does not out-rank an equally-matching precise node", () => {
  const precise = node({ id: "precise", type: "function", layer: "code", label: "auth handler", sourcePath: "src/precise.ts" });
  const hub = node({ id: "hub", type: "file", layer: "code", label: "auth barrel", sourcePath: "src/index.ts" });
  const fillers = Array.from({ length: 6 }, (_, i) =>
    node({ id: `f${i}`, type: "file", layer: "code", label: `mod${i}`, sourcePath: `src/m${i}.ts` }),
  );
  // the hub is wired to everything (max degree); the precise node has a single link
  const edges = fillers.map((f) => edge("imports", "hub", f.id));
  edges.push(edge("calls", "precise", "f0"));
  const g = makeGraph([precise, hub, ...fillers], edges);

  const ranked = rankContext(g, "auth", { mode: "code" });
  const pos = (id: string): number => ranked.findIndex((r) => r.node.id === id);
  assert.ok(pos("precise") >= 0 && pos("hub") >= 0, "both nodes matched the query");
  assert.ok(pos("precise") < pos("hub"), "the precise low-degree node ranks above the high-degree hub");
});

test("a generically-named doc ranks below a specific doc that matches equally", () => {
  const specific = node({ id: "doc:specific", type: "doc", layer: "docs", label: "auth guide", sourcePath: "docs/auth-guide.md" });
  const readme = node({ id: "doc:readme", type: "doc", layer: "docs", label: "auth readme", sourcePath: "README.md" });
  const g = makeGraph([specific, readme], []);

  const ranked = rankContext(g, "auth", { mode: "docs" });
  const pos = (id: string): number => ranked.findIndex((r) => r.node.id === id);
  assert.ok(pos("doc:specific") >= 0 && pos("doc:readme") >= 0, "both docs matched the query");
  assert.ok(pos("doc:specific") < pos("doc:readme"), "the README is penalized as generic and ranks lower");
});

// ---------------------------------------------------------------------------
// Determinism: equal scores break ties on node id, regardless of input order.
// ---------------------------------------------------------------------------

test("ranking ties break deterministically on node id", () => {
  const a = node({ id: "aaa", type: "function", layer: "code", label: "auth one", sourcePath: "src/a.ts" });
  const b = node({ id: "zzz", type: "function", layer: "code", label: "auth two", sourcePath: "src/z.ts" });
  const g = makeGraph([b, a], []); // input order reversed on purpose
  const ranked = rankContext(g, "auth", { mode: "code" });
  assert.deepEqual(
    ranked.map((r) => r.node.id),
    ["aaa", "zzz"],
    "identical scores order by id ascending, independent of insertion order",
  );
});

// ---------------------------------------------------------------------------
// Freshness: the pack embeds graph freshness when the caller supplies it, and
// never invents it for a pure (library) build.
// ---------------------------------------------------------------------------

test("buildContextPack embeds freshness when supplied, omits it otherwise", () => {
  const g = oauthGraph();
  const withFresh = buildContextPack(g, "store tokens", {
    mode: "all",
    budget: 8000,
    freshness: { status: "stale", detail: "graph is 3 commits behind HEAD", remediation: "run kawn update" },
  });
  assert.ok(withFresh.freshness, "freshness is embedded when provided");
  assert.equal(withFresh.freshness!.status, "stale");
  assert.match(withFresh.freshness!.remediation ?? "", /kawn update/, "the remediation is carried through verbatim");

  const noFresh = buildContextPack(g, "store tokens", { mode: "all", budget: 8000 });
  assert.equal(noFresh.freshness, undefined, "a pure build never fabricates freshness");
});

// ---------------------------------------------------------------------------
// Recall preservation: the precision penalties must not drop the gold-relevant
// code, table, or explaining doc for a realistic task.
// ---------------------------------------------------------------------------

test("recall is preserved: the OAuth task still surfaces route code, the table, and the doc", () => {
  const g = oauthGraph();
  const pack = buildContextPack(g, "fix the oauth callback that writes store tokens", { mode: "all", budget: 8000 });
  const ids = new Set<string>([
    ...pack.mustRead.map((i) => i.id),
    ...pack.relatedDocs.map((i) => i.id),
    ...pack.tables.map((i) => i.id),
  ]);
  assert.ok(ids.has("table:store_tokens"), "the store_tokens table is still retrieved");
  assert.ok(
    ids.has("function:storeTokens.ts#saveStoreTokens") || ids.has("file:storeTokens.ts"),
    "the token-writing code is still retrieved",
  );
  assert.ok(pack.relatedDocs.length > 0, "the explaining doc is still included in mode=all (docs penalized, not erased)");
});
