import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { KawnNode, KawnEdge } from "@kawngraph/shared";
import { REPO_ROOT, makeGraph, mkTmp, writeGraphFile } from "./helpers";

/**
 * The beginner CLI commands (`ask`, `impact`, `map`, `check`, `changes`, …) are
 * friendly aliases that dispatch to the lower-level technical commands. These
 * tests pin that contract end-to-end by spawning the built CLI: two alias forms
 * fed the same input must produce byte-identical output, exit code, and stderr.
 *
 * If a future refactor of the dispatch switch (packages/cli/src/index.ts) ever
 * re-points an alias at the wrong command, one of these equivalences breaks.
 */

const CLI = path.join(REPO_ROOT, "packages", "cli", "dist", "index.js");

interface CliResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * Run the built CLI with `args` under `cwd`. `GIT_CEILING_DIRECTORIES` is pinned
 * to the OS temp root so the diff-driven commands never accidentally discover a
 * parent git repository — the change commands then fail identically (and only on
 * the git layer), which is exactly the equivalence we want to assert.
 */
function runCli(args: string[], cwd: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_CEILING_DIRECTORIES: os.tmpdir() },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

/** A tiny graph with a symbol that has a dependent — enough for ask / impact. */
function fixtureGraph() {
  const nodes: KawnNode[] = [
    { id: "file:src/auth.ts", type: "file", layer: "code", label: "auth.ts", sourcePath: "src/auth.ts" },
    {
      id: "symbol:src/auth.ts#getSession",
      type: "function",
      layer: "code",
      label: "getSession",
      sourcePath: "src/auth.ts",
      lineStart: 10,
      lineEnd: 20,
    },
    { id: "file:src/app.ts", type: "file", layer: "code", label: "app.ts", sourcePath: "src/app.ts" },
  ];
  const edges: KawnEdge[] = [
    { id: "e1", from: "file:src/app.ts", to: "file:src/auth.ts", type: "imports", confidence: "extracted" },
    { id: "e2", from: "file:src/auth.ts", to: "symbol:src/auth.ts#getSession", type: "defines", confidence: "extracted" },
    { id: "e3", from: "file:src/app.ts", to: "symbol:src/auth.ts#getSession", type: "calls", confidence: "extracted" },
  ];
  return makeGraph(nodes, edges);
}

/** Run a graph-backed temp repo through `fn`, cleaning up afterwards. */
async function withGraphRepo(prefix: string, fn: (root: string) => Promise<void>): Promise<void> {
  const root = mkTmp(prefix);
  try {
    writeGraphFile(root, fixtureGraph());
    await fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("`ask` is an exact alias of `context`", async () => {
  await withGraphRepo("kawn-alias-ask-", async (root) => {
    const a = await runCli(["ask", "getSession", "--root", root, "--quiet"], root);
    const b = await runCli(["context", "getSession", "--root", root, "--quiet"], root);
    assert.equal(a.code, 0, a.stderr);
    assert.equal(b.code, 0, b.stderr);
    assert.ok(a.stdout.includes("Context pack for"), "expected a real context pack");
    assert.equal(a.stdout, b.stdout, "ask and context must produce identical output");
    assert.equal(a.stderr, b.stderr);
  });
});

test("`impact` is an exact alias of `affected`", async () => {
  await withGraphRepo("kawn-alias-impact-", async (root) => {
    const a = await runCli(["impact", "getSession", "--root", root, "--quiet"], root);
    const b = await runCli(["affected", "getSession", "--root", root, "--quiet"], root);
    assert.equal(a.code, 0, a.stderr);
    assert.equal(b.code, 0, b.stderr);
    assert.ok(a.stdout.includes("getSession"), "expected the matched symbol in the output");
    assert.ok(a.stdout.includes("app.ts"), "expected the dependent file in the impact set");
    assert.equal(a.stdout, b.stdout, "impact and affected must produce identical output");
    assert.equal(a.stderr, b.stderr);
  });
});

test("`changes` defaults to the `diff` view", async () => {
  const root = mkTmp("kawn-alias-changes-");
  try {
    const a = await runCli(["changes", "--root", root, "--quiet"], root);
    const b = await runCli(["diff", "--root", root, "--quiet"], root);
    assert.equal(a.code, b.code);
    assert.equal(a.stdout, b.stdout);
    assert.equal(a.stderr, b.stderr);
    assert.match(a.stderr, /kawn diff/, "the diff-view usage line proves the dispatch");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("`changes --impact` is the `pr-impact` view", async () => {
  const root = mkTmp("kawn-alias-primpact-");
  try {
    const a = await runCli(["changes", "--impact", "--root", root, "--quiet"], root);
    const b = await runCli(["pr-impact", "--root", root, "--quiet"], root);
    assert.equal(a.code, b.code);
    assert.equal(a.stdout, b.stdout);
    assert.equal(a.stderr, b.stderr);
    assert.match(a.stderr, /kawn pr-impact/, "the impact-view usage line proves the dispatch");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("`changes --context` is the `pr-context` view", async () => {
  const root = mkTmp("kawn-alias-prcontext-");
  try {
    const a = await runCli(["changes", "--context", "--root", root, "--quiet"], root);
    const b = await runCli(["pr-context", "--root", root, "--quiet"], root);
    assert.equal(a.code, b.code);
    assert.equal(a.stdout, b.stdout);
    assert.equal(a.stderr, b.stderr);
    assert.match(a.stderr, /kawn pr-context/, "the context-view usage line proves the dispatch");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
