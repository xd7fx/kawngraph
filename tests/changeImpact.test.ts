import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { KawnNode, KawnEdge, EdgeType, edgeId } from "@kawngraph/shared";
import {
  parseNameStatusZ,
  reverseReachable,
  analyzeChangeImpact,
  gitChangedFiles,
  isGitRepo,
  GitError,
  type ChangeSet,
} from "@kawngraph/core";
import { makeGraph, mkTmp } from "./helpers";

// ─────────────────────────────────────────────────────────────────────────────
// parseNameStatusZ — the NUL-framed `git diff --name-status -z` parser
// ─────────────────────────────────────────────────────────────────────────────

test("parseNameStatusZ maps single-path statuses (A/M/D/T)", () => {
  const out = "M\0src/a.ts\0A\0src/new.ts\0D\0src/gone.ts\0T\0src/mode.ts\0";
  assert.deepEqual(parseNameStatusZ(out), [
    { path: "src/a.ts", status: "modified" },
    { path: "src/new.ts", status: "added" },
    { path: "src/gone.ts", status: "deleted" },
    { path: "src/mode.ts", status: "typechange" },
  ]);
});

test("parseNameStatusZ consumes old+new path for renames and copies", () => {
  // git emits the status with a similarity score, e.g. R100 / C75.
  const out = "R100\0src/old.ts\0src/new.ts\0C75\0src/orig.ts\0src/copy.ts\0";
  assert.deepEqual(parseNameStatusZ(out), [
    { path: "src/new.ts", status: "renamed", oldPath: "src/old.ts" },
    { path: "src/copy.ts", status: "copied", oldPath: "src/orig.ts" },
  ]);
});

test("parseNameStatusZ keeps paths with spaces intact (NUL framing, no quoting)", () => {
  const out = "M\0src/a b/c d.ts\0";
  assert.deepEqual(parseNameStatusZ(out), [{ path: "src/a b/c d.ts", status: "modified" }]);
});

test("parseNameStatusZ handles empty input and a missing trailing NUL", () => {
  assert.deepEqual(parseNameStatusZ(""), []);
  assert.deepEqual(parseNameStatusZ("M\0src/a.ts"), [{ path: "src/a.ts", status: "modified" }]);
});

// ─────────────────────────────────────────────────────────────────────────────
// reverseReachable — shared, bounded, deterministic reverse BFS
// ─────────────────────────────────────────────────────────────────────────────

function fn(id: string, sourcePath: string): KawnNode {
  return { id, type: "function", layer: "code", label: id.split("#").pop() ?? id, sourcePath };
}
function edge(type: EdgeType, from: string, to: string, line = 1): KawnEdge {
  return {
    id: edgeId(type, from, to),
    from,
    to,
    type,
    confidence: "linked",
    evidence: { sourcePath: "src/edges.ts", lineStart: line },
  };
}

// a -> called by b and d; b -> called by c. Plus a doc that "documents" a, which
// must NEVER be treated as a dependent (documents is not a dependency edge).
function reachGraph() {
  const nodes: KawnNode[] = [
    fn("function:fa.ts#a", "src/fa.ts"),
    fn("function:fb.ts#b", "src/fb.ts"),
    fn("function:fc.ts#c", "src/fc.ts"),
    fn("function:fd.ts#d", "src/fd.ts"),
    { id: "doc:a.md", type: "doc", layer: "docs", label: "A", sourcePath: "docs/a.md" },
  ];
  const edges: KawnEdge[] = [
    edge("calls", "function:fb.ts#b", "function:fa.ts#a"),
    edge("calls", "function:fd.ts#d", "function:fa.ts#a"),
    edge("calls", "function:fc.ts#c", "function:fb.ts#b"),
    edge("documents", "doc:a.md", "function:fa.ts#a"),
  ];
  return makeGraph(nodes, edges);
}

test("reverseReachable walks dependents nearest-first and excludes the seeds", () => {
  const g = reachGraph();
  const { nodes, truncated } = reverseReachable(g, ["function:fa.ts#a"]);
  assert.equal(truncated, false);
  assert.deepEqual(
    nodes.map((n) => ({ id: n.node.id, depth: n.depth, via: n.via })),
    [
      { id: "function:fb.ts#b", depth: 1, via: "calls" },
      { id: "function:fd.ts#d", depth: 1, via: "calls" },
      { id: "function:fc.ts#c", depth: 2, via: "calls" },
    ],
  );
  // a seed never appears in its own reachable set.
  assert.ok(!nodes.some((n) => n.node.id === "function:fa.ts#a"));
});

test("reverseReachable ignores non-dependency edges (documents/writes_table)", () => {
  const g = reachGraph();
  const { nodes } = reverseReachable(g, ["function:fa.ts#a"]);
  assert.ok(!nodes.some((n) => n.node.id === "doc:a.md"), "a doc is not a dependent");
});

test("reverseReachable is bounded by maxDepth", () => {
  const g = reachGraph();
  const { nodes } = reverseReachable(g, ["function:fa.ts#a"], { maxDepth: 1 });
  assert.deepEqual(nodes.map((n) => n.node.id).sort(), ["function:fb.ts#b", "function:fd.ts#d"]);
});

test("reverseReachable is bounded by maxNodes and reports truncation", () => {
  const g = reachGraph();
  const { nodes, truncated } = reverseReachable(g, ["function:fa.ts#a"], { maxNodes: 1 });
  assert.equal(nodes.length, 1);
  assert.equal(truncated, true);
});

test("reverseReachable accepts multiple seeds and is deterministic", () => {
  const g = reachGraph();
  const a = reverseReachable(g, ["function:fb.ts#b", "function:fd.ts#d"]);
  const b = reverseReachable(g, ["function:fd.ts#d", "function:fb.ts#b"]);
  assert.deepEqual(a, b, "seed order does not change the result");
  assert.deepEqual(a.nodes.map((n) => n.node.id), ["function:fc.ts#c"]);
});

test("reverseReachable follows depends_on so a changed package flags its dependents", () => {
  const pkg = (id: string, label: string): KawnNode => ({
    id,
    type: "package",
    layer: "config",
    label,
    sourcePath: `${id.split(":")[1]}/package.json`,
  });
  const nodes: KawnNode[] = [pkg("package:shared", "@kawngraph/shared"), pkg("package:core", "@kawngraph/core"), pkg("package:cli", "@kawngraph/cli")];
  // cli → core → shared (each depends_on the next). Direction is dependent → dependency.
  const edges: KawnEdge[] = [edge("depends_on", "package:cli", "package:core"), edge("depends_on", "package:core", "package:shared")];
  const g = makeGraph(nodes, edges);
  // Changing the leaf package surfaces the whole dependent chain, nearest-first.
  const { nodes: dependents } = reverseReachable(g, ["package:shared"]);
  assert.deepEqual(
    dependents.map((n) => ({ id: n.node.id, depth: n.depth, via: n.via })),
    [
      { id: "package:core", depth: 1, via: "depends_on" },
      { id: "package:cli", depth: 2, via: "depends_on" },
    ],
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// analyzeChangeImpact — map a change set onto the graph and bound the blast radius
// ─────────────────────────────────────────────────────────────────────────────

function node(p: Partial<KawnNode> & Pick<KawnNode, "id" | "type" | "layer" | "label" | "sourcePath">): KawnNode {
  return { ...p };
}

// callback.ts imports + calls oauth.ts; a doc documents the token exchange, which
// writes store_tokens and is covered by a test.
function oauthGraph() {
  const nodes: KawnNode[] = [
    node({ id: "file:src/oauth.ts", type: "file", layer: "code", label: "oauth.ts", sourcePath: "src/oauth.ts" }),
    node({ id: "function:src/oauth.ts#exchangeToken", type: "function", layer: "code", label: "exchangeToken", sourcePath: "src/oauth.ts", lineStart: 10 }),
    node({ id: "file:src/callback.ts", type: "file", layer: "code", label: "callback.ts", sourcePath: "src/callback.ts" }),
    node({ id: "function:src/callback.ts#handleCallback", type: "function", layer: "code", label: "handleCallback", sourcePath: "src/callback.ts", lineStart: 5 }),
    node({ id: "table:store_tokens", type: "table", layer: "data", label: "store_tokens", sourcePath: "db/0001.sql" }),
    node({ id: "doc:docs/oauth.md", type: "doc", layer: "docs", label: "OAuth", sourcePath: "docs/oauth.md" }),
    node({ id: "test:tests/oauth.test.ts", type: "test", layer: "test", label: "oauth.test", sourcePath: "tests/oauth.test.ts" }),
  ];
  const edges: KawnEdge[] = [
    edge("defines", "file:src/oauth.ts", "function:src/oauth.ts#exchangeToken"),
    edge("defines", "file:src/callback.ts", "function:src/callback.ts#handleCallback"),
    edge("imports", "file:src/callback.ts", "file:src/oauth.ts"),
    edge("calls", "function:src/callback.ts#handleCallback", "function:src/oauth.ts#exchangeToken"),
    edge("writes_table", "function:src/oauth.ts#exchangeToken", "table:store_tokens"),
    edge("documents", "doc:docs/oauth.md", "function:src/oauth.ts#exchangeToken"),
    edge("tests", "test:tests/oauth.test.ts", "function:src/oauth.ts#exchangeToken"),
  ];
  return makeGraph(nodes, edges);
}

function changeSet(files: ChangeSet["files"], label = "working tree vs HEAD", range: string | null = null): ChangeSet {
  return { label, range, files };
}

test("analyzeChangeImpact maps a changed file to its file node + symbols", () => {
  const impact = analyzeChangeImpact(oauthGraph(), changeSet([{ path: "src/oauth.ts", status: "modified" }]));
  assert.deepEqual(
    impact.changedNodes.map((n) => n.id),
    ["file:src/oauth.ts", "function:src/oauth.ts#exchangeToken"],
  );
  const f = impact.files.find((x) => x.path === "src/oauth.ts");
  assert.ok(f);
  assert.equal(f.inGraph, true);
  assert.equal(f.fileNode?.id, "file:src/oauth.ts");
  assert.deepEqual(f.symbols.map((s) => s.id), ["function:src/oauth.ts#exchangeToken"]);
});

test("analyzeChangeImpact finds dependents and the downstream files to re-check", () => {
  const impact = analyzeChangeImpact(oauthGraph(), changeSet([{ path: "src/oauth.ts", status: "modified" }]));
  assert.deepEqual(
    new Set(impact.impacted.map((r) => r.node.id)),
    new Set(["file:src/callback.ts", "function:src/callback.ts#handleCallback"]),
  );
  assert.equal(impact.impactTruncated, false);
  // The file you changed is excluded; only the downstream surface is listed.
  assert.deepEqual(impact.filesToRecheck, ["src/callback.ts"]);
});

test("analyzeChangeImpact surfaces related docs, tables, and tests from real edges", () => {
  const impact = analyzeChangeImpact(oauthGraph(), changeSet([{ path: "src/oauth.ts", status: "modified" }]));
  assert.deepEqual(impact.relatedDocs.map((n) => n.id), ["doc:docs/oauth.md"]);
  assert.deepEqual(impact.relatedTables.map((n) => n.id), ["table:store_tokens"]);
  assert.deepEqual(impact.relatedTests.map((n) => n.id), ["test:tests/oauth.test.ts"]);
});

test("analyzeChangeImpact flags auth risk for a token surface in scope", () => {
  const impact = analyzeChangeImpact(oauthGraph(), changeSet([{ path: "src/oauth.ts", status: "modified" }]));
  assert.ok(impact.risks.some((r) => r.kind === "auth"), "an auth/token surface raises a risk");
});

test("analyzeChangeImpact reports changed files absent from the graph as unmapped", () => {
  const impact = analyzeChangeImpact(
    oauthGraph(),
    changeSet([
      { path: "src/oauth.ts", status: "modified" },
      { path: "src/brand-new.ts", status: "added" },
    ]),
  );
  assert.deepEqual(impact.unmappedFiles, ["src/brand-new.ts"]);
  const f = impact.files.find((x) => x.path === "src/brand-new.ts");
  assert.ok(f);
  assert.equal(f.inGraph, false);
  assert.deepEqual(f.symbols, []);
  // files are sorted by path regardless of change-set order.
  assert.deepEqual(impact.files.map((x) => x.path), ["src/brand-new.ts", "src/oauth.ts"]);
});

test("analyzeChangeImpact resolves a rename via its old path", () => {
  const impact = analyzeChangeImpact(
    oauthGraph(),
    changeSet([{ path: "src/oauth2.ts", oldPath: "src/oauth.ts", status: "renamed" }]),
  );
  const f = impact.files.find((x) => x.path === "src/oauth2.ts");
  assert.ok(f);
  assert.equal(f.inGraph, true, "the new path resolves to the old file's nodes");
  assert.equal(f.oldPath, "src/oauth.ts");
  assert.ok(impact.changedNodes.some((n) => n.id === "function:src/oauth.ts#exchangeToken"));
});

test("analyzeChangeImpact keeps a deleted file's dependents (it still maps to the last scan's nodes)", () => {
  // A deleted file is gone from disk but still present in the graph from the last
  // scan, so it must still resolve to its nodes — that is exactly how its callers
  // get flagged for re-checking (the most important case for a deletion).
  const impact = analyzeChangeImpact(oauthGraph(), changeSet([{ path: "src/oauth.ts", status: "deleted" }]));
  const f = impact.files.find((x) => x.path === "src/oauth.ts");
  assert.ok(f);
  assert.equal(f.status, "deleted");
  assert.equal(f.inGraph, true);
  assert.ok(impact.changedNodes.some((n) => n.id === "function:src/oauth.ts#exchangeToken"));
  assert.deepEqual(impact.filesToRecheck, ["src/callback.ts"]);
  assert.ok(impact.impacted.some((r) => r.node.id === "function:src/callback.ts#handleCallback"));
});

test("analyzeChangeImpact is deterministic for the same inputs", () => {
  const cs = changeSet([{ path: "src/oauth.ts", status: "modified" }]);
  assert.deepEqual(analyzeChangeImpact(oauthGraph(), cs), analyzeChangeImpact(oauthGraph(), cs));
});

// ─────────────────────────────────────────────────────────────────────────────
// gitChangedFiles — real, read-only local git (skipped when git is unavailable)
// ─────────────────────────────────────────────────────────────────────────────

function hasGit(): boolean {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const GIT = hasGit();

function git(root: string, args: string[]): void {
  execFileSync("git", ["-C", root, "-c", "user.email=t@example.com", "-c", "user.name=test", ...args], {
    stdio: "ignore",
  });
}

/** Init a repo with one committed file; return its root. */
function initRepo(): string {
  const root = mkTmp("kawn-git-");
  git(root, ["init", "-q"]);
  fs.writeFileSync(path.join(root, "a.ts"), "export const a = 1;\n", "utf8");
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", "init"]);
  return root;
}

test("gitChangedFiles (working tree) reports modified tracked + untracked files", { skip: !GIT }, () => {
  const root = initRepo();
  try {
    fs.writeFileSync(path.join(root, "a.ts"), "export const a = 2;\n", "utf8"); // modify tracked
    fs.writeFileSync(path.join(root, "b.ts"), "export const b = 1;\n", "utf8"); // new untracked

    const cs = gitChangedFiles(root);
    assert.equal(cs.range, null);
    assert.equal(cs.label, "working tree vs HEAD");
    assert.deepEqual(cs.files, [
      { path: "a.ts", status: "modified" },
      { path: "b.ts", status: "added" },
    ]);

    // untracked can be excluded on request
    const tracked = gitChangedFiles(root, { includeUntracked: false });
    assert.deepEqual(tracked.files.map((f) => f.path), ["a.ts"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("gitChangedFiles (PR mode) diffs a base ref against HEAD", { skip: !GIT }, () => {
  const root = initRepo();
  try {
    fs.writeFileSync(path.join(root, "a.ts"), "export const a = 2;\n", "utf8"); // modify in 2nd commit
    fs.writeFileSync(path.join(root, "c.ts"), "export const c = 1;\n", "utf8"); // add in 2nd commit
    git(root, ["add", "-A"]);
    git(root, ["commit", "-q", "-m", "second"]);

    const cs = gitChangedFiles(root, { base: "HEAD~1" });
    assert.equal(cs.range, "HEAD~1...HEAD");
    assert.deepEqual(cs.files, [
      { path: "a.ts", status: "modified" },
      { path: "c.ts", status: "added" },
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("gitChangedFiles throws a typed GitError for an unknown base ref", { skip: !GIT }, () => {
  const root = initRepo();
  try {
    assert.throws(
      () => gitChangedFiles(root, { base: "no-such-ref-xyz" }),
      (e: unknown) => e instanceof GitError && e.code === "bad-ref",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("gitChangedFiles throws not-a-repo outside a git work tree", { skip: !GIT }, () => {
  const dir = mkTmp("kawn-norepo-");
  try {
    if (isGitRepo(dir)) return; // env quirk: tmp sits inside a repo — skip the assertion
    assert.throws(
      () => gitChangedFiles(dir),
      (e: unknown) => e instanceof GitError && e.code === "not-a-repo",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("gitChangedFiles detects a committed rename with its old path, even when diff.renames is off", { skip: !GIT }, () => {
  const root = initRepo();
  try {
    // Turn the config OFF to prove our explicit --find-renames overrides it: a
    // rename must surface as `renamed` (+oldPath), never as a delete + add.
    git(root, ["config", "diff.renames", "false"]);
    git(root, ["mv", "a.ts", "renamed.ts"]);
    git(root, ["commit", "-q", "-m", "rename a.ts"]);

    const cs = gitChangedFiles(root, { base: "HEAD~1" });
    assert.deepEqual(cs.files, [{ path: "renamed.ts", status: "renamed", oldPath: "a.ts" }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
