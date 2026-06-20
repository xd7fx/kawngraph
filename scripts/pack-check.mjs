#!/usr/bin/env node
/*
 * pack:check — packaging audit for Athar's publishable packages.
 *
 * What it proves, end to end, WITHOUT publishing anything:
 *   1. `pnpm pack` produces a clean tarball for each publishable package
 *      (dist-only — no src/*.ts, tsconfig, or tsbuildinfo bloat).
 *   2. A fresh consumer project can `npm install` the whole @athar/* closure
 *      from those tarballs alone (workspace:* rewritten to real versions, the
 *      private inter-package deps satisfied via `overrides` → local tarballs).
 *   3. The INSTALLED artifacts actually work: `athar version|scan|setup|
 *      disconnect` run, and the installed `@athar/mcp` server completes a real
 *      stdio JSON-RPC handshake (initialize + tools/list).
 *
 * It never runs `npm publish`. Everything happens in throwaway temp dirs that
 * are removed on exit, and the repo's own examples/ tree is never mutated (we
 * smoke-test against a copy). Exit code is non-zero if any assertion fails.
 */
import { spawnSync } from "node:child_process";
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

// Publishable packages, in dependency order. `tgz` is the npm-flattened filename
// `pnpm pack` emits (scopes are dropped: @athar/core → athar-core-0.1.0.tgz).
const PKGS = [
  { name: "@athar/shared", dir: "packages/shared", tgz: "athar-shared-0.1.0.tgz" },
  { name: "@athar/scanners", dir: "packages/scanners", tgz: "athar-scanners-0.1.0.tgz" },
  { name: "@athar/core", dir: "packages/core", tgz: "athar-core-0.1.0.tgz" },
  { name: "@athar/mcp", dir: "packages/mcp", tgz: "athar-mcp-0.1.0.tgz" },
  { name: "@athar/agents", dir: "packages/agents", tgz: "athar-agents-0.1.0.tgz" },
  { name: "@athar/studio-server", dir: "packages/studio-server", tgz: "athar-studio-server-0.1.0.tgz" },
  { name: "@athar/benchmark", dir: "packages/benchmark", tgz: "athar-benchmark-0.1.0.tgz" },
  { name: "athar", dir: "packages/cli", tgz: "athar-0.1.0.tgz" },
];

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
  const okInit = init?.result?.serverInfo?.name === "athar" && typeof init?.result?.instructions === "string";
  const tools = list?.result?.tools;
  const names = Array.isArray(tools) ? tools.map((t) => t.name) : [];
  const okTools = ["athar_context", "athar_query", "athar_affected"].every((n) => names.includes(n));
  if (okInit && okTools) return { ok: true, msg: `MCP handshake ok — serverInfo "athar", instructions present, tools: ${names.join(", ")}` };
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

  stage = mkdtempSync(path.join(tmpdir(), "athar-pack-stage-"));
  consumer = mkdtempSync(path.join(tmpdir(), "athar-pack-consumer-"));
  work = mkdtempSync(path.join(tmpdir(), "athar-pack-work-"));

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
    // copy into the consumer dir so we can reference it with a relative file: spec
    copyFileSync(tgzPath, path.join(consumer, p.tgz));
  }

  section("Consumer install (from tarballs only)");
  const rel = (tgz) => `file:./${tgz}`;
  const consumerPkg = {
    name: "athar-pack-consumer",
    version: "1.0.0",
    private: true,
    description: "Throwaway project that installs Athar purely from packed tarballs.",
    dependencies: {
      athar: rel("athar-0.1.0.tgz"),
      "@athar/mcp": rel("athar-mcp-0.1.0.tgz"),
    },
    // The packed inter-package deps point at @athar/*@0.1.0, which do not exist on
    // any registry (private). Force every one to resolve to its local tarball.
    overrides: Object.fromEntries(PKGS.filter((p) => p.name.startsWith("@athar/")).map((p) => [p.name, rel(p.tgz)])),
  };
  writeFileSync(path.join(consumer, "package.json"), JSON.stringify(consumerPkg, null, 2));
  const install = runShell("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: consumer });
  if (install.status !== 0) {
    dump(install);
    throw new Error("consumer `npm install` failed");
  }
  pass("npm install resolved the whole @athar/* closure from tarballs");

  const atharBin = path.join(consumer, "node_modules", "athar", "dist", "index.js");
  const mcpBin = path.join(consumer, "node_modules", "@athar", "mcp", "dist", "index.js");
  check(existsSync(atharBin), "installed athar CLI present at node_modules/athar/dist/index.js");
  check(existsSync(mcpBin), "installed @athar/mcp present at node_modules/@athar/mcp/dist/index.js");
  if (!existsSync(atharBin) || !existsSync(mcpBin)) throw new Error("installed entrypoints missing — cannot smoke-test");

  section("Smoke: athar version");
  const ver = runNode([atharBin, "version"]);
  check(ver.status === 0 && ver.stdout.trim() === "0.1.0", `athar version → "${ver.stdout.trim()}"`);

  // Copy the example into a temp workspace so scan/setup never dirty the repo.
  const fixture = path.join(work, "nextjs-supabase");
  cpSync(path.join(repoRoot, "examples", "nextjs-supabase"), fixture, {
    recursive: true,
    filter: (src) => !/[\\/](\.athar|node_modules|\.mcp\.json|\.cursor|\.codex)([\\/]|$)/.test(src),
  });

  section("Smoke: athar scan");
  const scan = runNode([atharBin, "scan", fixture]);
  if (scan.status !== 0) dump(scan);
  check(scan.status === 0, "athar scan exited 0");
  check(existsSync(path.join(fixture, ".athar", "graph.json")), "scan wrote .athar/graph.json");

  section("Smoke: athar setup --agent all --yes (non-interactive)");
  const setup = runNode([atharBin, "setup", fixture, "--agent", "all", "--yes", "--scope", "project", "--json"]);
  if (setup.status !== 0) dump(setup);
  check(setup.status === 0, "athar setup exited 0");
  check(existsSync(path.join(fixture, ".mcp.json")), "Claude .mcp.json created");
  check(existsSync(path.join(fixture, ".cursor", "mcp.json")), "Cursor .cursor/mcp.json created");
  check(existsSync(path.join(fixture, ".codex", "config.toml")), "Codex .codex/config.toml created");

  section("Smoke: installed @athar/mcp stdio handshake");
  const hs = mcpHandshake(mcpBin, fixture);
  check(hs.ok, hs.msg);

  section("Smoke: athar disconnect codex (reversible)");
  const dis = runNode([atharBin, "disconnect", "codex", fixture]);
  if (dis.status !== 0) dump(dis);
  check(dis.status === 0, "athar disconnect codex exited 0");
  const tomlPath = path.join(fixture, ".codex", "config.toml");
  const tomlAfter = existsSync(tomlPath) ? readFileSync(tomlPath, "utf8") : "";
  check(!/\[mcp_servers\.athar\]/.test(tomlAfter), "Codex [mcp_servers.athar] removed after disconnect");

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
