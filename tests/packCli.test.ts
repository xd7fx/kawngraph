import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { KawnNode, KawnEdge } from "@kawngraph/shared";
import { REPO_ROOT, makeGraph, mkTmp, writeGraphFile } from "./helpers";

/**
 * `kawn pack` exports the SAME Context Pack in tool-agnostic formats (markdown /
 * json), and `--local` OPTIONALLY condenses it via a local LLM — but must NEVER
 * fail or hang when no local model is reachable. These tests pin both the format
 * surface and the hard graceful-fallback guarantee (the previously untested
 * pack.ts + localLlm.ts).
 */
const CLI = path.join(REPO_ROOT, "packages", "cli", "dist", "index.js");

interface CliResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

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

async function withGraphRepo(prefix: string, fn: (root: string) => Promise<void>): Promise<void> {
  const root = mkTmp(prefix);
  try {
    writeGraphFile(root, fixtureGraph());
    await fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("`pack --format json` emits valid JSON for any tool", async () => {
  await withGraphRepo("kawn-pack-json-", async (root) => {
    const r = await runCli(["pack", "getSession", "--root", root, "--format", "json"], root);
    assert.equal(r.code, 0, r.stderr);
    const parsed = JSON.parse(r.stdout); // throws if not valid JSON
    assert.ok(parsed && typeof parsed === "object", "pack --format json must be a JSON object");
  });
});

test("`pack --format markdown` emits a ready-to-paste Context Pack", async () => {
  await withGraphRepo("kawn-pack-md-", async (root) => {
    const r = await runCli(["pack", "getSession", "--root", root, "--format", "markdown"], root);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /Context Pack/i, "markdown export should render a Context Pack");
    assert.equal(r.stdout.trim().startsWith("{"), false, "markdown must not be JSON");
  });
});

test("`pack` defaults to markdown", async () => {
  await withGraphRepo("kawn-pack-default-", async (root) => {
    const r = await runCli(["pack", "getSession", "--root", root], root);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /Context Pack/i);
  });
});

test("`pack --local` with no local LLM configured falls back to the deterministic pack", async () => {
  await withGraphRepo("kawn-pack-local-none-", async (root) => {
    const r = await runCli(["pack", "getSession", "--root", root, "--local"], root);
    assert.equal(r.code, 0, "must not fail when no local LLM is configured");
    assert.match(r.stdout, /Context Pack/i, "still emits the deterministic pack on stdout");
    assert.match(r.stderr, /--local skipped/i, "warns that --local was skipped");
  });
});

test("`pack --local` with an unreachable endpoint still succeeds (graceful fallback)", async () => {
  await withGraphRepo("kawn-pack-local-dead-", async (root) => {
    // Point at a refused port; --local must attempt, fail fast, and fall back.
    const cfg = { schema: "kawngraph.local-llm/v1", provider: "ollama", baseUrl: "http://127.0.0.1:1/v1", model: "nope" };
    fs.writeFileSync(path.join(root, ".kawn", "local-llm.json"), JSON.stringify(cfg, null, 2));
    const r = await runCli(["pack", "getSession", "--root", root, "--local"], root);
    assert.equal(r.code, 0, "an unreachable local LLM must never break the command");
    assert.match(r.stdout, /Context Pack/i, "falls back to the deterministic pack");
    assert.match(r.stderr, /--local skipped/i);
  });
});

test("`pack` with no task prints usage and exits non-zero", async () => {
  await withGraphRepo("kawn-pack-usage-", async (root) => {
    const r = await runCli(["pack", "--root", root], root);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /usage: kawn pack/i);
  });
});

test("`pack` with no graph errors clearly", async () => {
  const root = mkTmp("kawn-pack-nograph-");
  try {
    const r = await runCli(["pack", "getSession", "--root", root], root);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /no \.kawn\/graph\.json/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
