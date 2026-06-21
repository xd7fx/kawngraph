import { test } from "node:test";
import assert from "node:assert/strict";
import { KawnNode } from "@kawngraph/shared";
import { scanDocs, linkDocsToCode } from "@kawngraph/scanners";

// Real code nodes the doc can resolve against.
const codeNodes: KawnNode[] = [
  { id: "file:src/lib/oauth.ts", type: "file", layer: "code", label: "oauth.ts", sourcePath: "src/lib/oauth.ts" },
  { id: "function:src/lib/oauth.ts#exchangeCodeForToken", type: "function", layer: "code", label: "exchangeCodeForToken", sourcePath: "src/lib/oauth.ts", lineStart: 10 },
  { id: "table:store_tokens", type: "table", layer: "data", label: "store_tokens", sourcePath: "db/0001.sql", lineStart: 10 },
];

const markdown = `# Zid OAuth

## The exchangeCodeForToken helper

It calls the token endpoint. See [the source](src/lib/oauth.ts) for details.

The handler writes rows into the \`store_tokens\` table.
`;

test("linkDocsToCode is deterministic, evidence-backed, and adds no nodes", () => {
  const { doc } = scanDocs("docs/oauth.md", markdown);
  const res = linkDocsToCode([doc], [...codeNodes]);

  assert.equal(res.nodes.length, 0, "linking is a pure edge post-pass — never invents nodes");
  assert.ok(res.edges.length > 0, "should link the doc to code");
  for (const e of res.edges) {
    assert.equal(e.confidence, "linked", "doc links are deterministic 'linked', never 'semantic'/LLM");
    assert.ok(e.evidence && e.evidence.sourcePath, "every edge keeps evidence");
  }
});

test("a markdown link becomes a `documents` edge to the file node", () => {
  const { doc } = scanDocs("docs/oauth.md", markdown);
  const res = linkDocsToCode([doc], [...codeNodes]);
  const documents = res.edges.find((e) => e.type === "documents" && e.to === "file:src/lib/oauth.ts");
  assert.ok(documents, "expected a documents edge from the doc to oauth.ts");
});

test("a heading naming a symbol becomes an `explains` edge from the section", () => {
  const { doc } = scanDocs("docs/oauth.md", markdown);
  const res = linkDocsToCode([doc], [...codeNodes]);
  const explains = res.edges.find(
    (e) => e.type === "explains" && e.to === "function:src/lib/oauth.ts#exchangeCodeForToken",
  );
  assert.ok(explains, "the 'exchangeCodeForToken helper' heading should explain the function");
});

test("a table named in the body becomes a `mentions`/`explains` edge", () => {
  const { doc } = scanDocs("docs/oauth.md", markdown);
  const res = linkDocsToCode([doc], [...codeNodes]);
  const toTable = res.edges.find((e) => e.to === "table:store_tokens");
  assert.ok(toTable, "store_tokens table referenced in prose should be linked");
});

test("no code nodes ⇒ no invented links", () => {
  const { doc } = scanDocs("docs/oauth.md", markdown);
  const res = linkDocsToCode([doc], []);
  assert.equal(res.edges.length, 0, "without code nodes there is nothing to link — never fabricate");
});
