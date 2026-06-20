#!/usr/bin/env node
/**
 * Athar behavioral evaluation — a REAL agent session, not a simulation.
 *
 * Question this answers: when you hand a coding agent a normal repository task,
 * does it AUTOMATICALLY reach for Athar (call `athar_context` first), and does
 * that change what it does? It runs an actual `claude` (and `codex`, when present
 * and authenticated) session WITH and WITHOUT Athar over an isolated, freshly
 * scanned copy of a project, parses the agent's own tool-call stream, and reports:
 *
 *   • whether Athar was invoked automatically (and whether it was the FIRST move)
 *   • the ordered list of tools the agent invoked
 *   • how many distinct files it opened (Read/Grep/Glob)
 *   • wall-clock time to a usable answer
 *   • token usage (from the agent's own result accounting)
 *   • relevant-file precision/recall vs a gold set (default: the OAuth example)
 *   • the task outcome (final answer text, truncated)
 *
 * This is deliberately honest: if the agent CLI is missing or unauthenticated it
 * FAILS LOUDLY with the real error and a non-zero exit — it never fabricates
 * numbers. Run it in a terminal where `claude` is logged in / has a key.
 *
 * Usage:
 *   node scripts/agent-eval.mjs [options]
 *     --project <path>   project to evaluate over (default: examples/nextjs-supabase)
 *     --task "<task>"    the task to give the agent (default: the OAuth task below)
 *     --gold "a,b,c"     comma-separated relevant files for precision (default: OAuth set)
 *     --model <model>    model alias passed to `claude` (default: the CLI default)
 *     --agent <which>    claude | codex | both (default: claude)
 *     --keep             keep the temp project dir (for inspection)
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync, cpSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

// ---- args -----------------------------------------------------------------
function parseArgs(argv) {
  const o = { project: "examples/nextjs-supabase", task: null, gold: null, model: null, agent: "claude", keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") o.project = argv[++i];
    else if (a === "--task") o.task = argv[++i];
    else if (a === "--gold") o.gold = argv[++i];
    else if (a === "--model") o.model = argv[++i];
    else if (a === "--agent") o.agent = argv[++i];
    else if (a === "--keep") o.keep = true;
  }
  return o;
}
const ARGS = parseArgs(process.argv.slice(2));

const DEFAULT_TASK =
  "Fix the Zid OAuth callback that exchanges the code and writes the store tokens. " +
  "Tell me exactly which files I need to read and change, and any risks.";
// Gold = the files a correct answer to the default task actually involves, in the
// bundled example. Override with --gold for your own project/task.
const DEFAULT_GOLD = [
  "app/api/zid/oauth/callback/route.ts",
  "src/lib/oauth.ts",
  "src/server/repositories/storeTokens.ts",
  "docs/zid-oauth-core.md",
];

const TASK = ARGS.task ?? DEFAULT_TASK;
const GOLD = (ARGS.gold ? ARGS.gold.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_GOLD).map(norm);

function norm(p) {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

// ---- process helpers ------------------------------------------------------
function run(cmd, args, opts = {}) {
  // shell:true on Windows so PATH shims (.cmd) resolve; quote the command AND args
  // defensively — process.execPath is "C:\Program Files\nodejs\node.exe", which the
  // shell would otherwise split at the space ("'C:\Program' is not recognized").
  const useShell = isWin;
  const q = (a) => (/[\s"]/.test(a) ? `"${a}"` : a);
  const finalCmd = useShell ? q(cmd) : cmd;
  const finalArgs = useShell ? args.map(q) : args;
  return spawnSync(finalCmd, finalArgs, {
    cwd: opts.cwd ?? REPO_ROOT,
    input: opts.input,
    encoding: "utf8",
    shell: useShell,
    maxBuffer: 64 * 1024 * 1024,
    timeout: opts.timeout ?? 5 * 60 * 1000,
    env: process.env,
  });
}
function which(bin) {
  const r = run(isWin ? "where" : "which", [bin], { timeout: 15000 });
  if (r.status !== 0) return null;
  return String(r.stdout || "").split(/\r?\n/).find(Boolean) || null;
}
function die(msg) {
  console.error(`\n[agent-eval] FATAL: ${msg}\n`);
  process.exit(1);
}
const node = process.execPath;
const CLI = path.join(REPO_ROOT, "packages", "cli", "dist", "index.js");
const MCP = path.join(REPO_ROOT, "packages", "mcp", "dist", "index.js");

// ---- stream-json parsing --------------------------------------------------
// Claude Code `--output-format stream-json --verbose` emits one JSON object per
// line: system(init) · assistant(message.content[]) · user(tool_result) · result.
function parseClaudeStream(stdout) {
  const events = [];
  for (const line of String(stdout).split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s[0] !== "{") continue;
    try {
      events.push(JSON.parse(s));
    } catch {
      /* ignore non-JSON noise */
    }
  }
  const toolUses = [];
  let final = null;
  for (const ev of events) {
    if (ev.type === "assistant" && ev.message && Array.isArray(ev.message.content)) {
      for (const b of ev.message.content) {
        if (b && b.type === "tool_use") toolUses.push({ name: String(b.name || ""), input: b.input || {} });
      }
    }
    if (ev.type === "result") final = ev;
  }
  return { events, toolUses, final };
}

function filesFromToolUses(toolUses) {
  const files = new Set();
  for (const t of toolUses) {
    const i = t.input || {};
    const base = t.name.includes("__") ? t.name.split("__").pop() : t.name;
    if (base === "Read" && i.file_path) files.add(norm(String(i.file_path)));
    else if (base === "Grep" && i.path && /\.[a-z]+$/i.test(String(i.path))) files.add(norm(String(i.path)));
    else if (base === "Edit" && i.file_path) files.add(norm(String(i.file_path)));
  }
  return files;
}

function fileMentionsInText(text) {
  const found = new Set();
  const hay = norm(String(text || ""));
  for (const g of GOLD) if (hay.includes(g)) found.add(g);
  return found;
}

// ---- the WITH / WITHOUT runner -------------------------------------------
function claudeBin() {
  const p = which("claude");
  if (!p) die("`claude` CLI not found on PATH. Install Claude Code, then re-run.");
  return "claude"; // run via PATH (shell:true on win resolves the shim)
}

function runClaude(projectDir, mcpConfigPath, withAthar, model) {
  const allowed = withAthar
    ? ["mcp__athar__athar_context", "mcp__athar__athar_query", "mcp__athar__athar_affected", "Read", "Grep", "Glob"]
    : ["Read", "Grep", "Glob"];
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--mcp-config",
    mcpConfigPath,
    "--strict-mcp-config",
    "--permission-mode",
    "bypassPermissions",
    "--add-dir",
    projectDir,
    "--allowedTools",
    ...allowed,
  ];
  if (model) args.push("--model", model);

  const started = Date.now();
  const r = run(claudeBin(), args, { cwd: projectDir, input: TASK, timeout: 8 * 60 * 1000 });
  const wallMs = Date.now() - started;
  const { toolUses, final } = parseClaudeStream(r.stdout);

  // Honest failure detection — never report metrics from a failed/unauthenticated run.
  const authish = final && final.is_error && (final.api_error_status || /authenticate|401|403|credit|quota|balance/i.test(String(final.result || "")));
  if (authish) {
    const why = `${final.api_error_status ? `HTTP ${final.api_error_status} — ` : ""}${final.result || "agent returned an error"}`;
    return { failed: true, reason: why, wallMs };
  }
  if (!final) {
    const tail = String(r.stderr || r.stdout || "").trim().split(/\r?\n/).slice(-4).join(" | ");
    return { failed: true, reason: `no result event from claude (exit ${r.status}). ${tail}`, wallMs };
  }

  const opened = filesFromToolUses(toolUses);
  const mentioned = fileMentionsInText(final.result);
  const relevantHit = new Set([...opened, ...mentioned].filter((f) => GOLD.includes(f)));
  const usage = final.usage || {};
  const atharUses = toolUses.filter((t) => t.name.startsWith("mcp__athar__"));
  return {
    failed: false,
    wallMs,
    durationMs: final.duration_ms ?? null,
    numTurns: final.num_turns ?? null,
    isError: !!final.is_error,
    tools: toolUses.map((t) => t.name),
    atharCalled: atharUses.length > 0,
    atharFirst: toolUses.length > 0 && toolUses[0].name === "mcp__athar__athar_context",
    filesOpened: [...opened],
    relevantHit: [...relevantHit],
    precision: opened.size ? relevantHit.size / opened.size : null,
    recall: GOLD.length ? relevantHit.size / GOLD.length : null,
    tokens: {
      input: usage.input_tokens ?? null,
      output: usage.output_tokens ?? null,
      cacheRead: usage.cache_read_input_tokens ?? null,
      cacheCreate: usage.cache_creation_input_tokens ?? null,
    },
    cost: final.total_cost_usd ?? null,
    answer: String(final.result || "").replace(/\s+/g, " ").slice(0, 400),
  };
}

// ---- report ---------------------------------------------------------------
function pct(x) {
  return x == null ? "n/a" : `${Math.round(x * 100)}%`;
}
function num(x) {
  return x == null ? "n/a" : String(x);
}
function printComparison(label, withA, without) {
  const rows = [
    ["", `${label} — WITHOUT Athar`, `${label} — WITH Athar`],
    ["Athar auto-invoked", "—", without.failed ? "?" : (withA.failed ? "FAILED" : (withA.atharCalled ? (withA.atharFirst ? "YES (first move)" : "yes (not first)") : "NO"))],
    ["tools invoked", without.failed ? "FAILED" : num(without.tools.length), withA.failed ? "FAILED" : num(withA.tools.length)],
    ["distinct files opened", without.failed ? "—" : num(without.filesOpened.length), withA.failed ? "—" : num(withA.filesOpened.length)],
    ["relevant files hit", without.failed ? "—" : `${without.relevantHit.length}/${GOLD.length}`, withA.failed ? "—" : `${withA.relevantHit.length}/${GOLD.length}`],
    ["precision", without.failed ? "—" : pct(without.precision), withA.failed ? "—" : pct(withA.precision)],
    ["recall (vs gold)", without.failed ? "—" : pct(without.recall), withA.failed ? "—" : pct(withA.recall)],
    ["wall-clock", without.failed ? "—" : `${without.wallMs} ms`, withA.failed ? "—" : `${withA.wallMs} ms`],
    ["input tokens", without.failed ? "—" : num(without.tokens.input), withA.failed ? "—" : num(withA.tokens.input)],
    ["output tokens", without.failed ? "—" : num(without.tokens.output), withA.failed ? "—" : num(withA.tokens.output)],
  ];
  const w = [0, 1, 2].map((c) => Math.max(...rows.map((r) => String(r[c]).length)));
  console.log("");
  for (const r of rows) console.log("  " + r.map((cell, c) => String(cell).padEnd(w[c])).join("   "));
  console.log("");
  if (!withA.failed) console.log(`  WITH Athar — tool order: ${withA.tools.join(" → ") || "(none)"}`);
  if (!withA.failed) console.log(`  WITH Athar — answer: ${withA.answer}`);
  if (!without.failed) console.log(`  WITHOUT   — tool order: ${without.tools.join(" → ") || "(none)"}`);
}

// ---- main -----------------------------------------------------------------
function ensureBuilt() {
  if (existsSync(CLI) && existsSync(MCP)) return;
  console.log("[agent-eval] building workspace (dist missing)…");
  const r = run(isWin ? "pnpm.cmd" : "pnpm", ["run", "build"], { timeout: 10 * 60 * 1000 });
  if (r.status !== 0) die(`build failed:\n${r.stdout}\n${r.stderr}`);
}

function stageProject() {
  const src = path.resolve(REPO_ROOT, ARGS.project);
  if (!existsSync(src)) die(`project not found: ${src}`);
  const dir = mkdtempSync(path.join(tmpdir(), "athar-eval-"));
  const dst = path.join(dir, "project");
  cpSync(src, dst, {
    recursive: true,
    filter: (s) => {
      const b = path.basename(s);
      return ![".athar", "node_modules", ".git", ".next", "dist", ".mcp.json", ".cursor", ".codex"].includes(b);
    },
  });
  return { dir, dst };
}

function main() {
  console.log("=== Athar behavioral evaluation (real agent session) ===");
  console.log(`task: "${TASK}"`);
  console.log(`gold (${GOLD.length}): ${GOLD.join(", ")}`);
  ensureBuilt();

  const { dir, dst } = stageProject();
  let exitCode = 0;
  try {
    // Build the graph the agent will (or won't) consult.
    const scan = run(node, [CLI, "scan", dst], { timeout: 5 * 60 * 1000 });
    if (scan.status !== 0) die(`athar scan failed:\n${scan.stdout}\n${scan.stderr}`);
    if (!existsSync(path.join(dst, ".athar", "graph.json"))) die("scan did not produce .athar/graph.json");
    console.log(`[agent-eval] staged + scanned: ${dst}`);

    const withCfg = path.join(dir, "with-athar.json");
    const noneCfg = path.join(dir, "no-athar.json");
    writeFileSync(
      withCfg,
      JSON.stringify({ mcpServers: { athar: { type: "stdio", command: node, args: [MCP, "--root", dst] } } }, null, 2),
    );
    writeFileSync(noneCfg, JSON.stringify({ mcpServers: {} }, null, 2));

    const wantClaude = ARGS.agent === "claude" || ARGS.agent === "both";
    const wantCodex = ARGS.agent === "codex" || ARGS.agent === "both";

    if (wantClaude) {
      if (!which("claude")) die("`claude` CLI not found. Install Claude Code and authenticate, then re-run.");
      console.log("\n[agent-eval] running Claude WITHOUT Athar…");
      const without = runClaude(dst, noneCfg, false, ARGS.model);
      console.log("[agent-eval] running Claude WITH Athar…");
      const withA = runClaude(dst, withCfg, true, ARGS.model);
      printComparison("claude", withA, without);
      if (withA.failed || without.failed) {
        console.error(`\n[agent-eval] Claude run did not complete a real session:`);
        if (without.failed) console.error(`  WITHOUT: ${without.reason}`);
        if (withA.failed) console.error(`  WITH:    ${withA.reason}`);
        console.error(
          `\n  This is an environment/auth issue, not a result. Run in a terminal where\n` +
            `  \`claude\` is logged in (or ANTHROPIC_API_KEY is a real key). No numbers are\n` +
            `  reported for a failed session — by design.`,
        );
        exitCode = 2;
      }
    }

    if (wantCodex) {
      const codex = which("codex");
      if (!codex) {
        console.log("\n[agent-eval] codex: NOT INSTALLED — skipped. Install + authenticate the Codex CLI to include it.");
      } else {
        console.log("\n[agent-eval] codex: detected, but this harness's stream parser targets Claude Code's");
        console.log("  stream-json. Codex emits a different event format; wire a codex parser before trusting its numbers.");
      }
    }
  } finally {
    if (ARGS.keep) console.log(`\n[agent-eval] kept temp dir: ${dir}`);
    else rmSync(dir, { recursive: true, force: true });
  }
  process.exit(exitCode);
}

main();
