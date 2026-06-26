#!/usr/bin/env node
/*
 * pack:check — packaging audit for KawnGraph's publishable packages.
 *
 * What it proves, end to end, WITHOUT publishing anything:
 *   1. `pnpm pack` produces a clean tarball for each publishable package
 *      (dist-only — no src/*.ts, tsconfig, or tsbuildinfo bloat).
 *   2. A fresh consumer project can `npm install` the whole @kawngraph/* closure
 *      from those tarballs alone (workspace:* rewritten to real versions, the
 *      private inter-package deps satisfied via `overrides` → local tarballs).
 *   3. The INSTALLED artifacts actually work: `kawn version|scan|setup|
 *      disconnect` run, and the installed `@kawngraph/mcp` server completes a real
 *      stdio JSON-RPC handshake (initialize + tools/list).
 *
 * It never runs `npm publish`. Everything happens in throwaway temp dirs that
 * are removed on exit, and the repo's own examples/ tree is never mutated (we
 * smoke-test against a copy). Exit code is non-zero if any assertion fails.
 */
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, copyFileSync, cpSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const NODE = process.execPath;

let failures = 0;
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  failures++;
  console.error(`  ✗ ${m}`);
};
const check = (cond, m) => (cond ? pass(m) : fail(m));
const section = (t) => console.log(`\n=== ${t} ===`);

/** Run the current Node on a script with args; no shell, so paths-with-spaces are safe. */
function runNode(args, opts = {}) {
  return spawnSync(NODE, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
}
/** Run a packaged CLI (pnpm/npm) — these are .cmd shims on Windows, so go through a shell. */
function runShell(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024, ...opts });
}
/**
 * List the entry names inside a gzipped tarball using only Node's zlib — no
 * external `tar`, so it can't be tripped up by GNU tar treating a Windows
 * `C:\…` path as a remote host. We only read the 100-byte name field of each
 * 512-byte ustar header; npm tarballs use short paths (no prefix/longname), so
 * this is sufficient to audit what ships.
 */
function listTarball(tgzPath) {
  const buf = gunzipSync(readFileSync(tgzPath));
  const names = [];
  let off = 0;
  while (off + 512 <= buf.length) {
    if (buf[off] === 0) break; // zero block → end of archive
    const name = buf.toString("utf8", off, off + 100).replace(/\0.*$/, "");
    const sizeOctal = buf.toString("utf8", off + 124, off + 136).replace(/\0.*$/, "").trim();
    const size = parseInt(sizeOctal, 8) || 0;
    if (name) names.push(name);
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return names;
}
function dump(r) {
  if (r.stdout) console.error(r.stdout);
  if (r.stderr) console.error(r.stderr);
}

// Version comes from the workspace root, so a version bump never desyncs this audit.
const VERSION = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).version;
// `pnpm pack` emits npm-flattened filenames (scope dropped): @kawngraph/core → kawngraph-core-<ver>.tgz.
const tgzName = (name) => `${name.startsWith("@") ? name.slice(1).replace("/", "-") : name}-${VERSION}.tgz`;
// Publishable packages, in dependency order.
const PKGS = [
  { name: "@kawngraph/shared", dir: "packages/shared" },
  { name: "@kawngraph/scanner-sdk", dir: "packages/scanner-sdk" },
  { name: "@kawngraph/scanners", dir: "packages/scanners" },
  { name: "@kawngraph/context-protocol", dir: "packages/context-protocol" },
  { name: "@kawngraph/core", dir: "packages/core" },
  { name: "@kawngraph/mcp", dir: "packages/mcp" },
  { name: "@kawngraph/agents", dir: "packages/agents" },
  { name: "@kawngraph/studio-server", dir: "packages/studio-server" },
  { name: "@kawngraph/benchmark", dir: "packages/benchmark" },
  { name: "kawngraph", dir: "packages/cli" },
].map((p) => ({ ...p, tgz: tgzName(p.name) }));

/** Drive the installed MCP server through one initialize + tools/list exchange. */
function mcpHandshake(serverJs, root) {
  const requests = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ];
  const input = requests.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const r = runNode([serverJs, "--root", root], { input });
  if (r.status !== 0) return { ok: false, msg: `MCP server exited ${r.status}: ${(r.stderr || "").trim().slice(0, 200)}` };
  let messages;
  try {
    messages = (r.stdout || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => JSON.parse(s));
  } catch (e) {
    return { ok: false, msg: `MCP stdout was not newline-delimited JSON-RPC: ${e}` };
  }
  const byId = new Map(messages.filter((m) => m && typeof m === "object" && "id" in m).map((m) => [m.id, m]));
  const init = byId.get(1);
  const list = byId.get(2);
  const okInit = init?.result?.serverInfo?.name === "kawn" && typeof init?.result?.instructions === "string";
  const tools = list?.result?.tools;
  const names = Array.isArray(tools) ? tools.map((t) => t.name) : [];
  const okTools = ["kawn_context", "kawn_query", "kawn_affected"].every((n) => names.includes(n));
  if (okInit && okTools) return { ok: true, msg: `MCP handshake ok — serverInfo "kawn", instructions present, tools: ${names.join(", ")}` };
  return { ok: false, msg: `MCP handshake incomplete (initialize=${okInit}, tools=[${names.join(", ")}])` };
}

let stage, consumer, work;
try {
  section("Build (tsc -b) so dist/ is current");
  const build = runShell("pnpm", ["run", "build"], { cwd: repoRoot });
  if (build.status !== 0) {
    dump(build);
    throw new Error("workspace build failed");
  }
  pass("workspace build succeeded");

  stage = mkdtempSync(path.join(tmpdir(), "kawngraph-pack-stage-"));
  consumer = mkdtempSync(path.join(tmpdir(), "kawngraph-pack-consumer-"));
  work = mkdtempSync(path.join(tmpdir(), "kawngraph-pack-work-"));

  section("Pack tarballs + audit contents");
  for (const p of PKGS) {
    const r = runShell("pnpm", ["pack", "--pack-destination", `"${stage}"`], { cwd: path.join(repoRoot, p.dir) });
    const tgzPath = path.join(stage, p.tgz);
    if (r.status !== 0 || !existsSync(tgzPath)) {
      dump(r);
      throw new Error(`pack failed for ${p.name} (expected ${p.tgz})`);
    }
    const entries = listTarball(tgzPath);
    if (entries.length === 0) throw new Error(`could not list ${p.tgz} (no entries decoded)`);
    const bloat = entries.filter((e) => /^package\/(src\/|tsconfig|.*\.tsbuildinfo)/.test(e));
    check(bloat.length === 0, `${p.name}: tarball is dist-only${bloat.length ? ` (leaked: ${bloat.slice(0, 3).join(", ")})` : ""}`);
    check(entries.some((e) => /^package\/dist\/index\.js$/.test(e)), `${p.name}: ships dist/index.js`);
    if (p.name === "kawngraph") {
      // The CLI must bundle the built Studio UI (prepack → bundle-studio.mjs), or a
      // published `kawn map` degrades to API-only. dist/index.js alone is not enough.
      check(
        entries.some((e) => /^package\/studio-dist\/index\.html$/.test(e)),
        `${p.name}: ships the bundled Studio UI (studio-dist/index.html)`,
      );
    }
    // copy into the consumer dir so we can reference it with a relative file: spec
    copyFileSync(tgzPath, path.join(consumer, p.tgz));
  }

  section("Consumer install (from tarballs only)");
  const rel = (tgz) => `file:./${tgz}`;
  const consumerPkg = {
    name: "kawngraph-pack-consumer",
    version: "1.0.0",
    private: true,
    description: "Throwaway project that installs KawnGraph purely from packed tarballs.",
    dependencies: {
      kawngraph: rel(tgzName("kawngraph")),
      "@kawngraph/mcp": rel(tgzName("@kawngraph/mcp")),
    },
    // The packed inter-package deps point at @kawngraph/*@0.1.0, which do not exist on
    // any registry (private). Force every one to resolve to its local tarball.
    overrides: Object.fromEntries(PKGS.filter((p) => p.name.startsWith("@kawngraph/")).map((p) => [p.name, rel(p.tgz)])),
  };
  writeFileSync(path.join(consumer, "package.json"), JSON.stringify(consumerPkg, null, 2));
  const install = runShell("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: consumer });
  if (install.status !== 0) {
    dump(install);
    throw new Error("consumer `npm install` failed");
  }
  pass("npm install resolved the whole @kawngraph/* closure from tarballs");

  const kawnBin = path.join(consumer, "node_modules", "kawngraph", "dist", "index.js");
  const mcpBin = path.join(consumer, "node_modules", "@kawngraph", "mcp", "dist", "index.js");
  check(existsSync(kawnBin), "installed kawngraph CLI present at node_modules/kawngraph/dist/index.js");
  check(existsSync(mcpBin), "installed @kawngraph/mcp present at node_modules/@kawngraph/mcp/dist/index.js");
  if (!existsSync(kawnBin) || !existsSync(mcpBin)) throw new Error("installed entrypoints missing — cannot smoke-test");

  section("Smoke: kawn version");
  const ver = runNode([kawnBin, "version"]);
  check(ver.status === 0 && ver.stdout.trim() === VERSION, `kawn version → "${ver.stdout.trim()}"`);

  // Copy the example into a temp workspace so scan/setup never dirty the repo.
  const fixture = path.join(work, "nextjs-supabase");
  cpSync(path.join(repoRoot, "examples", "nextjs-supabase"), fixture, {
    recursive: true,
    filter: (src) => !/[\\/](\.kawn|\.athar|node_modules|\.mcp\.json|\.cursor|\.codex)([\\/]|$)/.test(src),
  });

  section("Smoke: kawn scan");
  const scan = runNode([kawnBin, "scan", fixture]);
  if (scan.status !== 0) dump(scan);
  check(scan.status === 0, "kawn scan exited 0");
  check(existsSync(path.join(fixture, ".kawn", "graph.json")), "scan wrote .kawn/graph.json");

  section("Smoke: kawn setup --agent all --yes (non-interactive)");
  const setup = runNode([kawnBin, "setup", fixture, "--agent", "all", "--yes", "--scope", "project", "--json"]);
  if (setup.status !== 0) dump(setup);
  check(setup.status === 0, "kawn setup exited 0");
  check(existsSync(path.join(fixture, ".mcp.json")), "Claude .mcp.json created");
  check(existsSync(path.join(fixture, ".cursor", "mcp.json")), "Cursor .cursor/mcp.json created");
  check(existsSync(path.join(fixture, ".codex", "config.toml")), "Codex .codex/config.toml created");
  // Regression: a published setup must write a PORTABLE npx launch — never a bare
  // `kawn-mcp` (which fails `spawn kawn-mcp ENOENT` when npm's global bin isn't on PATH).
  const claudeKawn = (JSON.parse(readFileSync(path.join(fixture, ".mcp.json"), "utf8")).mcpServers || {}).kawn || {};
  check(
    claudeKawn.command === "npx" && Array.isArray(claudeKawn.args) && claudeKawn.args.some((a) => String(a).includes("@kawngraph/mcp")),
    `published .mcp.json uses a portable npx launch — ${claudeKawn.command} ${(claudeKawn.args || []).join(" ")}`,
  );
  check(!JSON.stringify(claudeKawn).includes("kawn-mcp"), "published launch does not depend on a global kawn-mcp on PATH");

  section("Smoke: installed @kawngraph/mcp stdio handshake");
  const hs = mcpHandshake(mcpBin, fixture);
  check(hs.ok, hs.msg);

  section("Smoke: kawn map serves the Studio UI (not API-only)");
  check(
    existsSync(path.join(consumer, "node_modules", "kawngraph", "studio-dist", "index.html")),
    "installed kawngraph ships studio-dist/index.html",
  );
  const studioPort = 47319;
  const studio = spawn(NODE, [kawnBin, "map", fixture, "--port", String(studioPort), "--no-open"], { stdio: "ignore" });
  try {
    // Poll the running server with a short retry loop; pass only if it serves the UI.
    const poller =
      "const http=require('http');let n=0;" +
      "function back(){if(++n>25){process.exit(1)}setTimeout(go,250)}" +
      "function go(){const req=http.get({host:'127.0.0.1',port:" +
      studioPort +
      ",path:'/',timeout:1500},function(res){let b='';res.on('data',function(c){b+=c});res.on('end',function(){" +
      "if(res.statusCode===200&&/<!doctype html|<div id=.root.|<\\/html>/i.test(b)){process.exit(0)}back()})});" +
      "req.on('error',back);req.on('timeout',function(){req.destroy();back()})}go();";
    const poll = runNode(["-e", poller]);
    check(poll.status === 0, `kawn map serves the UI at 127.0.0.1:${studioPort} (HTTP 200 + index.html)`);
  } finally {
    studio.kill();
  }

  section("Smoke: kawn disconnect codex (reversible)");
  const dis = runNode([kawnBin, "disconnect", "codex", fixture]);
  if (dis.status !== 0) dump(dis);
  check(dis.status === 0, "kawn disconnect codex exited 0");
  const tomlPath = path.join(fixture, ".codex", "config.toml");
  const tomlAfter = existsSync(tomlPath) ? readFileSync(tomlPath, "utf8") : "";
  check(!/\[mcp_servers\.kawn\]/.test(tomlAfter), "Codex [mcp_servers.kawn] removed after disconnect");

  section("Result");
  if (failures > 0) {
    console.error(`\npack:check FAILED — ${failures} assertion(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("\npack:check PASSED — every publishable package packs clean, installs from tarballs, and the installed CLI + MCP server work. (Nothing was published.)");
  }
} catch (err) {
  console.error(`\npack:check ERROR: ${err && err.stack ? err.stack : err}`);
  process.exitCode = 1;
} finally {
  for (const d of [stage, consumer, work]) {
    if (d) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* best-effort temp cleanup */
      }
    }
  }
}
