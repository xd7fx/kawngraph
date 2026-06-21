import { test } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { KawnNode, KawnEdge, edgeId } from "@kawngraph/shared";
import { createStudioServer, resolveStatic, contentTypeFor } from "@kawngraph/studio-server";
import { isGitRepo } from "@kawngraph/core";
import { makeGraph, mkTmp, writeGraphFile, REPO_ROOT } from "./helpers";

// ---------------------------------------------------------------------------
// Fixtures + helpers
// ---------------------------------------------------------------------------

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

/** A small but realistic chain: file -> GET -> save -> table, plus a doc. */
function sampleGraph() {
  const nodes: KawnNode[] = [
    node({ id: "file:a.ts", type: "file", layer: "code", label: "a.ts", sourcePath: "app/a.ts" }),
    node({ id: "function:a.ts#GET", type: "function", layer: "code", label: "GET", sourcePath: "app/a.ts", lineStart: 1, lineEnd: 9 }),
    node({ id: "function:b.ts#save", type: "function", layer: "code", label: "save", sourcePath: "src/b.ts", lineStart: 1, lineEnd: 9 }),
    node({ id: "table:tokens", type: "table", layer: "data", label: "tokens", sourcePath: "db/0001.sql", lineStart: 1, lineEnd: 5 }),
    node({ id: "doc:a.md", type: "doc", layer: "docs", label: "A doc", sourcePath: "docs/a.md" }),
  ];
  const edges: KawnEdge[] = [
    edge("defines", "file:a.ts", "function:a.ts#GET"),
    edge("calls", "function:a.ts#GET", "function:b.ts#save"),
    edge("writes_table", "function:b.ts#save", "table:tokens"),
    edge("documents", "doc:a.md", "file:a.ts"),
  ];
  return makeGraph(nodes, edges);
}

interface RunningServer {
  server: http.Server;
  port: number;
  host: string;
  close: () => Promise<void>;
}

type ServerOpts = Parameters<typeof createStudioServer>[0];

function startServer(opts: ServerOpts): Promise<RunningServer> {
  return new Promise((resolve, reject) => {
    const server = createStudioServer(opts);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") return reject(new Error("no address"));
      resolve({
        server,
        port: addr.port,
        host: addr.address,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

interface Resp {
  status: number;
  json: any;
  raw: string;
  headers: http.IncomingHttpHeaders;
}

/** One HTTP round-trip against 127.0.0.1. `Connection: close` keeps sockets from lingering. */
function request(
  port: number,
  method: string,
  reqPath: string,
  opts: { json?: unknown; raw?: string } = {},
): Promise<Resp> {
  return new Promise((resolve, reject) => {
    let payload: Buffer | undefined;
    if (opts.raw !== undefined) payload = Buffer.from(opts.raw, "utf8");
    else if (opts.json !== undefined) payload = Buffer.from(JSON.stringify(opts.json), "utf8");

    const headers: Record<string, string | number> = { Connection: "close" };
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = payload.length;
    }

    const req = http.request({ host: "127.0.0.1", port, method, path: reqPath, headers }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (raw += d));
      res.on("end", () => {
        let json: any;
        try {
          json = raw ? JSON.parse(raw) : undefined;
        } catch {
          json = undefined; // non-JSON body (e.g. static HTML)
        }
        resolve({ status: res.statusCode ?? 0, json, raw, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Recursive {relativePath -> size} snapshot, sorted, so we can prove nothing changed. */
function snapshot(dir: string): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  const walk = (d: string, prefix: string): void => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, rel);
      else out.push([rel, fs.statSync(abs).size]);
    }
  };
  if (fs.existsSync(dir)) walk(dir, "");
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

function writeRawGraph(root: string, raw: string): void {
  const dir = path.join(root, ".kawn");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "graph.json"), raw, "utf8");
}

function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms).unref()),
  ]);
}

function makeStaticDir(): string {
  const base = mkTmp("kawn-static-");
  const dir = path.join(base, "site");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>KawnGraph Universe</title><div id=root></div>");
  fs.writeFileSync(path.join(dir, "app.js"), "console.log('kawn')");
  fs.mkdirSync(path.join(dir, "sub"));
  fs.writeFileSync(path.join(dir, "sub", "index.html"), "<p>sub index</p>");
  // A secret OUTSIDE the static root — must never be reachable via traversal.
  fs.writeFileSync(path.join(base, "secret.txt"), "TOP-SECRET");
  return dir;
}

// ---------------------------------------------------------------------------
// Git helpers for the /api/changes endpoint (skipped when git is unavailable).
// ---------------------------------------------------------------------------

function hasGit(): boolean {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const GIT = hasGit();

function gitCmd(root: string, args: string[]): void {
  execFileSync("git", ["-C", root, "-c", "user.email=t@example.com", "-c", "user.name=test", ...args], {
    stdio: "ignore",
  });
}

/**
 * A git repo whose committed `app/a.ts` maps to sampleGraph's `file:a.ts`
 * (+ its GET function), with `.kawn/` git-ignored so the graph file never
 * pollutes the working-tree diff. Returns the repo root with a graph written.
 */
function initGraphRepo(): string {
  const root = mkTmp("kawn-git-srv-");
  gitCmd(root, ["init", "-q"]);
  fs.mkdirSync(path.join(root, "app"), { recursive: true });
  fs.writeFileSync(path.join(root, "app", "a.ts"), "export function GET() { return 1; }\n", "utf8");
  fs.writeFileSync(path.join(root, ".gitignore"), ".kawn/\n", "utf8");
  gitCmd(root, ["add", "-A"]);
  gitCmd(root, ["commit", "-q", "-m", "init"]);
  writeGraphFile(root, sampleGraph());
  return root;
}

// ---------------------------------------------------------------------------
// Static path safety (resolveStatic / contentTypeFor) — the core defense.
// ---------------------------------------------------------------------------

test("resolveStatic serves real files and maps content types", async () => {
  const dir = makeStaticDir();
  try {
    const root = await resolveStatic(dir, "/");
    assert.ok(root, "/ resolves to a file");
    assert.ok(root!.path.endsWith("index.html"), "/ maps to index.html");
    assert.equal(root!.contentType, "text/html; charset=utf-8");

    const js = await resolveStatic(dir, "/app.js");
    assert.ok(js);
    assert.equal(js!.contentType, "text/javascript; charset=utf-8");

    const sub = await resolveStatic(dir, "/sub");
    assert.ok(sub, "a directory resolves to its index.html");
    assert.ok(sub!.path.endsWith(path.join("sub", "index.html")));
  } finally {
    cleanup(path.dirname(dir));
  }
});

test("resolveStatic refuses traversal, encoded traversal, null bytes, and bad encoding", async () => {
  const dir = makeStaticDir();
  try {
    assert.equal(await resolveStatic(dir, "/../secret.txt"), null, "../ escapes are rejected");
    assert.equal(await resolveStatic(dir, "/%2e%2e/secret.txt"), null, "percent-encoded ../ is rejected");
    assert.equal(await resolveStatic(dir, "/..%2f..%2fsecret.txt"), null, "encoded slash traversal is rejected");
    assert.equal(await resolveStatic(dir, "/%00"), null, "null-byte injection is rejected");
    assert.equal(await resolveStatic(dir, "/%E0%A4%A"), null, "malformed percent-encoding is rejected");
    assert.equal(await resolveStatic(dir, "/missing.js"), null, "a missing asset is null, not a guess");
  } finally {
    cleanup(path.dirname(dir));
  }
});

test("contentTypeFor knows common assets and falls back safely", () => {
  assert.equal(contentTypeFor("x.css"), "text/css; charset=utf-8");
  assert.equal(contentTypeFor("x.json"), "application/json; charset=utf-8");
  assert.equal(contentTypeFor("x.svg"), "image/svg+xml");
  assert.equal(contentTypeFor("x.unknown"), "application/octet-stream");
});

// ---------------------------------------------------------------------------
// Binding — must be loopback only.
// ---------------------------------------------------------------------------

test("the server binds to 127.0.0.1 (loopback only)", async () => {
  const root = mkTmp();
  writeGraphFile(root, sampleGraph());
  const s = await startServer({ root });
  try {
    const addr = s.server.address();
    assert.ok(addr && typeof addr !== "string");
    assert.equal((addr as any).address, "127.0.0.1", "Studio must never bind a public interface");
    assert.equal(s.host, "127.0.0.1");
  } finally {
    await s.close();
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// Missing / malformed graph — reported state, never a crash.
// ---------------------------------------------------------------------------

test("a missing graph is reported, not fatal; data endpoints answer 409", async () => {
  const root = mkTmp(); // no .kawn/graph.json
  const s = await startServer({ root });
  try {
    const health = await request(s.port, "GET", "/api/health");
    assert.equal(health.status, 200, "health always answers");
    assert.equal(health.json.ok, false);
    assert.equal(health.json.status, "missing");

    const graph = await request(s.port, "GET", "/api/graph");
    assert.equal(graph.status, 409, "no graph -> 409 conflict");

    const query = await request(s.port, "POST", "/api/query", { json: { query: "x" } });
    assert.equal(query.status, 409, "POST endpoints also 409 without a graph");
  } finally {
    await s.close();
    cleanup(root);
  }
});

test("a malformed graph is reported as malformed, not parsed", async () => {
  const root = mkTmp();
  writeRawGraph(root, "{ this is not valid json");
  const s = await startServer({ root });
  try {
    const health = await request(s.port, "GET", "/api/health");
    assert.equal(health.json.ok, false);
    assert.equal(health.json.status, "malformed");

    const graph = await request(s.port, "GET", "/api/graph");
    assert.equal(graph.status, 409);
  } finally {
    await s.close();
    cleanup(root);
  }
});

test("valid JSON that isn't a graph is still malformed", async () => {
  const root = mkTmp();
  writeRawGraph(root, JSON.stringify({ hello: "world" }));
  const s = await startServer({ root });
  try {
    const health = await request(s.port, "GET", "/api/health");
    assert.equal(health.json.status, "malformed");
  } finally {
    await s.close();
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// API validation + method + routing.
// ---------------------------------------------------------------------------

test("input validation: missing fields, non-object bodies, bad JSON -> 400", async () => {
  const root = mkTmp();
  writeGraphFile(root, sampleGraph());
  const s = await startServer({ root });
  try {
    assert.equal((await request(s.port, "POST", "/api/query", { json: {} })).status, 400, "query requires `query`");
    assert.equal((await request(s.port, "POST", "/api/context", { json: {} })).status, 400, "context requires `task`");
    assert.equal((await request(s.port, "POST", "/api/affected", { json: {} })).status, 400, "affected requires `symbol`");
    assert.equal((await request(s.port, "POST", "/api/flow", { json: { from: "file:a.ts" } })).status, 400, "flow requires `to`");

    const arr = await request(s.port, "POST", "/api/query", { json: [] });
    assert.equal(arr.status, 400, "a JSON array body is not a valid object");

    const bad = await request(s.port, "POST", "/api/query", { raw: "not json {" });
    assert.equal(bad.status, 400, "unparseable body -> 400");
  } finally {
    await s.close();
    cleanup(root);
  }
});

test("method + route guarding: wrong verbs 405, unknown endpoints 404", async () => {
  const root = mkTmp();
  writeGraphFile(root, sampleGraph());
  const s = await startServer({ root });
  try {
    assert.equal((await request(s.port, "GET", "/api/query")).status, 405, "query is POST-only");
    assert.equal((await request(s.port, "POST", "/api/graph")).status, 405, "graph is GET-only");
    assert.equal((await request(s.port, "GET", "/api/nope")).status, 404, "unknown GET endpoint");
    assert.equal((await request(s.port, "POST", "/api/nope")).status, 404, "unknown POST endpoint");
    assert.equal((await request(s.port, "GET", "/api/summary")).status, 200, "summary is a valid GET");
  } finally {
    await s.close();
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// Output/input limits are clamped — untrusted input even locally.
// ---------------------------------------------------------------------------

test("query limit and affected depth are clamped to safe maxima", async () => {
  const root = mkTmp();
  writeGraphFile(root, sampleGraph());
  const s = await startServer({ root });
  try {
    const hi = await request(s.port, "POST", "/api/query", { json: { query: "save", limit: 99999 } });
    assert.equal(hi.json.limit, 200, "query limit clamps to the max (200)");

    const lo = await request(s.port, "POST", "/api/query", { json: { query: "save", limit: -10 } });
    assert.equal(lo.json.limit, 1, "query limit clamps to the min (1)");

    const deep = await request(s.port, "POST", "/api/affected", { json: { symbol: "save", depth: 99999 } });
    assert.equal(deep.json.depth, 24, "affected depth clamps to the max (24)");
  } finally {
    await s.close();
    cleanup(root);
  }
});

test("a request body over maxBodyBytes is refused, never processed", async () => {
  const root = mkTmp();
  writeGraphFile(root, sampleGraph());
  const s = await startServer({ root, maxBodyBytes: 64 });
  try {
    const big = "x".repeat(5000);
    let status: number | "reset" = "reset";
    try {
      status = (await request(s.port, "POST", "/api/query", { json: { query: big } })).status;
    } catch {
      // The server destroys the oversized request mid-stream; the client may see a
      // connection reset rather than a clean 413. Either way it was refused.
      status = "reset";
    }
    assert.ok(status === 413 || status === "reset", `expected 413 or reset, got ${status}`);
    assert.notEqual(status, 200, "an over-limit body must never be processed");
  } finally {
    await s.close();
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// Flow bounds over HTTP.
// ---------------------------------------------------------------------------

test("flow over HTTP finds a path and respects maxNodes bounds", async () => {
  const root = mkTmp();
  writeGraphFile(root, sampleGraph());
  const s = await startServer({ root });
  try {
    const full = await request(s.port, "POST", "/api/flow", { json: { from: "file:a.ts", to: "table:tokens" } });
    assert.equal(full.status, 200);
    assert.equal(full.json.found, true);
    assert.deepEqual(full.json.nodes.map((n: any) => n.id), [
      "file:a.ts",
      "function:a.ts#GET",
      "function:b.ts#save",
      "table:tokens",
    ]);

    const capped = await request(s.port, "POST", "/api/flow", {
      json: { from: "file:a.ts", to: "table:tokens", maxNodes: 2 },
    });
    assert.equal(capped.json.nodes.length, 2, "maxNodes is honored across the HTTP boundary");

    const huge = await request(s.port, "POST", "/api/flow", {
      json: { from: "file:a.ts", to: "table:tokens", maxNodes: 99999 },
    });
    assert.ok(huge.json.nodes.length <= 64, "an oversized maxNodes is capped at MAX_FLOW_NODES");
  } finally {
    await s.close();
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// Changes (read-only git diff impact) over HTTP.
// ---------------------------------------------------------------------------

test("changes (working tree) returns ok:true with mapped impact over HTTP", { skip: !GIT }, async () => {
  const root = initGraphRepo();
  fs.writeFileSync(path.join(root, "app", "a.ts"), "export function GET() { return 2; }\n", "utf8");
  const s = await startServer({ root });
  try {
    const res = await request(s.port, "POST", "/api/changes", { json: {} });
    assert.equal(res.status, 200);
    assert.equal(res.json.ok, true);
    assert.equal(res.json.impact.label, "working tree vs HEAD");
    assert.equal(res.json.impact.range, null);
    const a = res.json.impact.files.find((f: any) => f.path === "app/a.ts");
    assert.ok(a, "the modified file is reported");
    assert.equal(a.status, "modified");
    assert.equal(a.inGraph, true, "it maps to a graph node");
    assert.ok(
      res.json.impact.changedNodes.some((n: any) => n.id === "file:a.ts"),
      "the file node is among the changed nodes",
    );
  } finally {
    await s.close();
    cleanup(root);
  }
});

test("changes (PR mode) diffs a base ref against HEAD", { skip: !GIT }, async () => {
  const root = initGraphRepo();
  fs.writeFileSync(path.join(root, "app", "a.ts"), "export function GET() { return 3; }\n", "utf8");
  gitCmd(root, ["add", "-A"]);
  gitCmd(root, ["commit", "-q", "-m", "second"]);
  const s = await startServer({ root });
  try {
    const res = await request(s.port, "POST", "/api/changes", { json: { base: "HEAD~1" } });
    assert.equal(res.status, 200);
    assert.equal(res.json.ok, true);
    assert.equal(res.json.impact.range, "HEAD~1...HEAD");
    assert.ok(res.json.impact.files.some((f: any) => f.path === "app/a.ts"));
  } finally {
    await s.close();
    cleanup(root);
  }
});

test("changes maps a bad base ref to a structured gitError, never a 5xx", { skip: !GIT }, async () => {
  const root = initGraphRepo();
  const s = await startServer({ root });
  try {
    const res = await request(s.port, "POST", "/api/changes", { json: { base: "no-such-ref-xyz" } });
    assert.equal(res.status, 200, "a bad ref is a structured result, not a server error");
    assert.equal(res.json.ok, false);
    assert.equal(res.json.gitError.code, "bad-ref");
  } finally {
    await s.close();
    cleanup(root);
  }
});

test("changes reports a non-git directory as a structured gitError", { skip: !GIT }, async () => {
  const root = mkTmp();
  writeGraphFile(root, sampleGraph());
  if (isGitRepo(root)) {
    cleanup(root);
    return; // env quirk: tmp sits inside a repo — skip the assertion
  }
  const s = await startServer({ root });
  try {
    const res = await request(s.port, "POST", "/api/changes", { json: {} });
    assert.equal(res.status, 200);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.gitError.code, "not-a-repo");
  } finally {
    await s.close();
    cleanup(root);
  }
});

test("changes requires a graph (409) and is POST-only (405)", async () => {
  const noGraph = mkTmp();
  const s1 = await startServer({ root: noGraph });
  try {
    const r = await request(s1.port, "POST", "/api/changes", { json: {} });
    assert.equal(r.status, 409, "no graph -> 409 before any git work");
  } finally {
    await s1.close();
    cleanup(noGraph);
  }

  const withGraph = mkTmp();
  writeGraphFile(withGraph, sampleGraph());
  const s2 = await startServer({ root: withGraph });
  try {
    assert.equal((await request(s2.port, "GET", "/api/changes")).status, 405, "changes is POST-only");
  } finally {
    await s2.close();
    cleanup(withGraph);
  }
});

// ---------------------------------------------------------------------------
// READ-ONLY: hammering every endpoint must not touch the project on disk.
// ---------------------------------------------------------------------------

test("the server never writes to the project root", async () => {
  const root = mkTmp();
  writeGraphFile(root, sampleGraph());
  const s = await startServer({ root });
  try {
    const before = snapshot(root);

    await request(s.port, "GET", "/api/health");
    await request(s.port, "GET", "/api/graph");
    await request(s.port, "GET", "/api/summary");
    await request(s.port, "POST", "/api/query", { json: { query: "save" } });
    await request(s.port, "POST", "/api/context", { json: { task: "fix save tokens" } });
    await request(s.port, "POST", "/api/affected", { json: { symbol: "save" } });
    await request(s.port, "POST", "/api/flow", { json: { from: "file:a.ts", to: "table:tokens" } });
    await request(s.port, "POST", "/api/changes", { json: {} });

    const after = snapshot(root);
    assert.deepEqual(after, before, "no file under the project root may be created or changed");
  } finally {
    await s.close();
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// Static serving over HTTP (the built frontend).
// ---------------------------------------------------------------------------

test("static frontend: real files, SPA fallback, honest 404s, no traversal", async () => {
  const root = mkTmp();
  writeGraphFile(root, sampleGraph());
  const staticDir = makeStaticDir();
  const s = await startServer({ root, staticDir });
  try {
    const index = await request(s.port, "GET", "/");
    assert.equal(index.status, 200);
    assert.ok(String(index.headers["content-type"]).startsWith("text/html"));
    assert.match(index.raw, /KawnGraph Universe/);
    assert.equal(index.headers["x-content-type-options"], "nosniff", "responses are sniff-proofed");

    const head = await request(s.port, "HEAD", "/");
    assert.equal(head.status, 200);
    assert.equal(head.raw, "", "HEAD returns headers only, no body");

    const js = await request(s.port, "GET", "/app.js");
    assert.equal(js.status, 200);
    assert.ok(String(js.headers["content-type"]).startsWith("text/javascript"));

    const spa = await request(s.port, "GET", "/some/client/route");
    assert.equal(spa.status, 200, "extension-less routes fall back to index.html (SPA)");
    assert.match(spa.raw, /KawnGraph Universe/);

    const missing = await request(s.port, "GET", "/missing.js");
    assert.equal(missing.status, 404, "a missing asset 404s honestly (no SPA fallback)");

    const traversal = await request(s.port, "GET", "/%2e%2e/%2e%2e/secret.txt");
    assert.equal(traversal.status, 404, "path traversal over HTTP is refused");

    const badMethod = await request(s.port, "POST", "/");
    assert.equal(badMethod.status, 405, "static is GET/HEAD only");
  } finally {
    await s.close();
    cleanup(root);
    cleanup(path.dirname(staticDir));
  }
});

test("an API-only server (no staticDir) 404s non-API routes", async () => {
  const root = mkTmp();
  writeGraphFile(root, sampleGraph());
  const s = await startServer({ root });
  try {
    assert.equal((await request(s.port, "GET", "/")).status, 404);
    assert.equal((await request(s.port, "GET", "/index.html")).status, 404);
    // ...but the API still works.
    assert.equal((await request(s.port, "GET", "/api/health")).status, 200);
  } finally {
    await s.close();
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// Clean shutdown of the real CLI process (end-to-end, including signals).
// ---------------------------------------------------------------------------

test("`kawn studio` starts and shuts down cleanly on signal", { timeout: 30000 }, async () => {
  const root = mkTmp();
  writeGraphFile(root, sampleGraph());
  const cli = path.join(REPO_ROOT, "packages", "cli", "dist", "index.js");
  const child = spawn(process.execPath, [cli, "studio", root, "--no-open", "--port", "0"], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    let buf = "";
    const ready = new Promise<void>((resolve, reject) => {
      const onData = (d: Buffer): void => {
        buf += d.toString();
        if (/running at/i.test(buf)) resolve();
      };
      child.stdout.on("data", onData);
      child.stderr.on("data", onData);
      child.once("exit", (code) => reject(new Error(`studio exited early (code ${code}):\n${buf}`)));
      child.once("error", reject);
    });
    await withTimeout(ready, 15000, `studio never reported ready:\n${buf}`);

    const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
    child.kill(); // SIGTERM on POSIX; TerminateProcess on Windows — both must end it
    await withTimeout(closed, 10000, "studio did not shut down after a signal");
  } finally {
    if (!child.killed) {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
    cleanup(root);
  }
});
