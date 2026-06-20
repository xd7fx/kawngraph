#!/usr/bin/env node
/**
 * Athar MCP server — exposes the Agent Context Graph to MCP clients (e.g. Claude
 * Code) over stdio. READ-ONLY by contract: it reads `.athar/graph.json` and serves
 * Context Packs, ranked queries, and reverse-impact analysis. It NEVER scans or
 * writes the graph — building is the CLI's job (`athar scan`).
 *
 * Zero runtime dependencies: a tiny newline-delimited JSON-RPC 2.0 loop over
 * stdio, no MCP SDK. stdout carries protocol messages only; logs go to stderr.
 */
import {
  readGraph,
  graphExists,
  buildContextPack,
  queryGraph,
  affected,
  affectedFiles,
  graphFreshness,
} from "@athar/core";
import { ATHAR_VERSION, ContextMode, ContextPack, ContextItem, ContextRisk } from "@athar/shared";

type Json = Record<string, unknown>;

/**
 * Server-level guidance handed to the client at `initialize`. MCP clients fold
 * this into the model's system context, so it is how Athar makes itself the
 * agent's default move WITHOUT touching CLAUDE.md / AGENTS.md. Kept well under
 * the 2KB budget. Read-only contract is stated explicitly so the agent asks the
 * user to run `athar update` rather than expecting the server to rebuild.
 */
const SERVER_INSTRUCTIONS = `Athar serves a prebuilt "Agent Context Graph" for THIS repository — a token-efficient map of the files, docs, and database tables that matter, with their dependencies and risk flags.

Use it to avoid exploring the whole tree:
- Call athar_context FIRST, before opening or grepping files, with the concrete task (e.g. "fix the OAuth callback"). It returns a small, ranked Context Pack — the few files/docs/tables to read, each with a reason, plus risk flags. Read those instead of scanning the repo.
- Use athar_query to find where something lives by phrase (ranked, mode-scoped: code|docs|all).
- Use athar_affected before changing shared code to see what depends on a symbol or file.

This server is strictly READ-ONLY: it never edits your code and never rebuilds the graph. If a result is flagged stale, ask the user to run \`athar update\` in a terminal — building and refreshing the graph is always an explicit CLI step (\`athar scan\` / \`athar update\`).`;

// ---- transport ------------------------------------------------------------

function send(msg: Json): void {
  // One JSON object per line. stdout is reserved for protocol messages only.
  process.stdout.write(JSON.stringify(msg) + "\n");
}
function respond(id: unknown, result: unknown): void {
  send({ jsonrpc: "2.0", id, result });
}
function respondError(id: unknown, code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}
function log(msg: string): void {
  process.stderr.write(`[athar-mcp] ${msg}\n`);
}

// ---- root + argument coercion ---------------------------------------------

function resolveRoot(): string {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root" && i + 1 < argv.length) return argv[i + 1];
    if (argv[i].startsWith("--root=")) return argv[i].slice("--root=".length);
  }
  return process.env.ATHAR_ROOT ?? process.cwd();
}
const DEFAULT_ROOT = resolveRoot();

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function asMode(v: unknown): ContextMode {
  return v === "code" || v === "docs" || v === "all" ? v : "all";
}
function asNum(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function rootOf(args: Json): string {
  return asString(args.root) ?? DEFAULT_ROOT;
}

class GraphMissing extends Error {
  constructor(root: string) {
    super(
      `No .athar/graph.json under "${root}". Run \`athar scan ${root}\` first — ` +
        `this server only reads the graph, it never builds it.`,
    );
  }
}
async function loadGraph(root: string) {
  if (!(await graphExists(root))) throw new GraphMissing(root);
  return readGraph(root);
}

// ---- freshness banner -----------------------------------------------------
// The server is read-only and must never rebuild, but it CAN tell the agent when
// the map it is serving may lag the code, and point to the one safe fix
// (`athar update`). graphFreshness() shells out to git, so a short TTL cache
// keeps a burst of tool calls from re-checking on every request.

const FRESHNESS_TTL_MS = 4000;
const freshnessCache = new Map<string, { at: number; banner: string }>();

function bannerForFreshness(status: string, detail: string): string {
  switch (status) {
    case "stale":
      return `[athar] ⚠ STALE GRAPH: ${detail} The map below may not match the current code — ask the user to run \`athar update\` to refresh it. This server is read-only and will not rebuild the graph.`;
    case "incompatible":
      return `[athar] ⚠ INCOMPATIBLE GRAPH: ${detail} Ask the user to run \`athar update\` to regenerate it. This server is read-only and will not rebuild the graph.`;
    case "possibly-stale":
      return "[athar] note: this map's freshness can't be confirmed against git — if the repo changed since the last scan, `athar update` refreshes it.";
    default:
      return "";
  }
}

async function freshnessBanner(root: string): Promise<string> {
  const now = Date.now();
  const cached = freshnessCache.get(root);
  if (cached && now - cached.at < FRESHNESS_TTL_MS) return cached.banner;
  let banner = "";
  try {
    const f = await graphFreshness(root);
    banner = bannerForFreshness(f.status, f.detail);
  } catch {
    banner = "";
  }
  freshnessCache.set(root, { at: now, banner });
  return banner;
}

// ---- formatters (agent-facing, token-efficient) ---------------------------

function loc(i: ContextItem): string {
  return i.lineStart ? `${i.sourcePath}:${i.lineStart}` : i.sourcePath;
}
function renderItem(i: ContextItem): string {
  return `  [${i.type}] ${i.label} — ${loc(i)} (~${i.tokensEstimate} tok) · ${i.reason}`;
}
function renderSection(title: string, items: ContextItem[]): string {
  if (items.length === 0) return `${title} (0): none`;
  return `${title} (${items.length}):\n${items.map(renderItem).join("\n")}`;
}
function renderRisk(r: ContextRisk): string {
  return `  [${r.level.toUpperCase()}] ${r.kind} — ${r.message}`;
}
function formatPack(p: ContextPack): string {
  const blocks: string[] = [
    `Context pack — task: "${p.task}"  (mode ${p.mode} · budget ${p.budget} · used ~${p.tokensUsed} tok · confidence ${p.confidence})`,
    renderSection("MUST READ", p.mustRead),
    renderSection("RELATED DOCS", p.relatedDocs),
    renderSection("TABLES", p.tables),
    renderSection("TESTS", p.tests),
    p.risks.length > 0 ? `RISKS (${p.risks.length}):\n${p.risks.map(renderRisk).join("\n")}` : "RISKS (0): none",
  ];
  if (p.excluded.length > 0) {
    blocks.push(
      `EXCLUDED (${p.excluded.length}):\n${p.excluded.map((e) => `  - ${e.label} — ${e.reason}`).join("\n")}`,
    );
  }
  return blocks.join("\n\n");
}

// ---- tools ----------------------------------------------------------------

interface Tool {
  name: string;
  description: string;
  inputSchema: Json;
  run(args: Json): Promise<string>;
}

const TOOLS: Tool[] = [
  {
    name: "athar_context",
    description:
      "Build a token-budgeted Context Pack for a coding task — the few files, docs, and tables that matter, each with a reason and risk flags. Call this FIRST, before reading or grepping files: load Athar's prebuilt map of the repo, not the whole tree. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "The coding task, e.g. 'fix the OAuth callback flow'." },
        budget: { type: "number", description: "Token budget for the pack (default 8000)." },
        mode: { type: "string", enum: ["code", "docs", "all"], description: "Scope to a layer (default all)." },
        root: { type: "string", description: "Repo root to read (default: the server's root)." },
      },
      required: ["task"],
    },
    async run(args) {
      const task = asString(args.task);
      if (!task) throw new Error("`task` is required");
      const graph = await loadGraph(rootOf(args));
      const pack = buildContextPack(graph, task, { budget: asNum(args.budget), mode: asMode(args.mode) });
      return formatPack(pack);
    },
  },
  {
    name: "athar_query",
    description:
      "Locate where something lives in this repo without grepping the whole tree: search Athar's Context Graph for nodes matching a phrase, ranked and mode-scoped (code|docs|all). Returns labelled hits with file:line. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text, e.g. 'store tokens'." },
        mode: { type: "string", enum: ["code", "docs", "all"], description: "Scope to a layer (default all)." },
        limit: { type: "number", description: "Max hits (default 25)." },
        root: { type: "string", description: "Repo root to read (default: the server's root)." },
      },
      required: ["query"],
    },
    async run(args) {
      const query = asString(args.query);
      if (!query) throw new Error("`query` is required");
      const mode = asMode(args.mode);
      const graph = await loadGraph(rootOf(args));
      const hits = queryGraph(graph, query, mode, asNum(args.limit) ?? 25);
      if (hits.length === 0) return `No nodes matched "${query}" in mode ${mode}.`;
      const lines = hits.map((h) => {
        const l = h.node.lineStart ? `${h.node.sourcePath}:${h.node.lineStart}` : h.node.sourcePath;
        return `  ${String(h.score).padStart(6)}  [${h.node.type}] ${h.node.label} — ${l} · ${h.reason}`;
      });
      return `Query "${query}" (mode ${mode}) — ${hits.length} hit(s):\n${lines.join("\n")}`;
    },
  },
  {
    name: "athar_affected",
    description:
      "Reverse-impact analysis before you change shared code: given a symbol or file, list what depends on it (callers, importers, referrers) and the exact files to re-check. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Symbol or file label, e.g. 'getMerchantContext'." },
        depth: { type: "number", description: "Max impact depth (default 6)." },
        root: { type: "string", description: "Repo root to read (default: the server's root)." },
      },
      required: ["symbol"],
    },
    async run(args) {
      const symbol = asString(args.symbol);
      if (!symbol) throw new Error("`symbol` is required");
      const graph = await loadGraph(rootOf(args));
      const result = affected(graph, symbol, asNum(args.depth) ?? 6);
      if (result.matched.length === 0) return `No node matched "${symbol}".`;
      const out: string[] = [`Target "${result.query}" matched ${result.matched.length} node(s):`];
      for (const n of result.matched) out.push(`  ${n.id}`);
      if (result.affected.length === 0) {
        out.push("", "Nothing depends on it (no callers/importers/referrers found).");
        return out.join("\n");
      }
      out.push("", `Affected (${result.affected.length}), nearest first:`);
      for (const a of result.affected) {
        out.push(`  [d${a.depth}] ${a.via.padEnd(10)} ${a.node.type.padEnd(8)} ${a.node.label}  (${a.node.sourcePath})`);
      }
      const files = affectedFiles(result);
      out.push("", `Files to re-check (${files.length}):`);
      for (const f of files) out.push(`  - ${f}`);
      return out.join("\n");
    },
  },
];

const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t] as const));
const TOOL_LIST = TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));

async function callTool(params: Json): Promise<Json> {
  const name = asString(params.name);
  const args = (params.arguments as Json | undefined) ?? {};
  const tool = name ? TOOL_BY_NAME.get(name) : undefined;
  if (!tool) return { content: [{ type: "text", text: `Unknown tool: ${name ?? "(none)"}` }], isError: true };
  try {
    const text = await tool.run(args);
    // Prepend a freshness banner when the served map may lag the code. Only on
    // success — a missing/unreadable graph already surfaces its own remediation.
    const banner = await freshnessBanner(rootOf(args));
    return { content: [{ type: "text", text: banner ? `${banner}\n\n${text}` : text }] };
  } catch (e) {
    return { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true };
  }
}

// ---- JSON-RPC dispatch ----------------------------------------------------

async function handle(msg: any): Promise<void> {
  const hasId = msg !== null && typeof msg === "object" && "id" in msg && msg.id !== null;
  const id = hasId ? msg.id : undefined;
  const method = typeof msg?.method === "string" ? msg.method : "";

  switch (method) {
    case "initialize":
      respond(id, {
        protocolVersion: asString(msg?.params?.protocolVersion) ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "athar", version: ATHAR_VERSION },
        instructions: SERVER_INSTRUCTIONS,
      });
      return;
    case "ping":
      respond(id, {});
      return;
    case "tools/list":
      respond(id, { tools: TOOL_LIST });
      return;
    case "tools/call":
      respond(id, await callTool((msg?.params as Json) ?? {}));
      return;
    default:
      // Notifications (e.g. notifications/initialized) and unknown notifications stay silent.
      if (!hasId) return;
      respondError(id, -32601, `Method not found: ${method}`);
  }
}

// ---- stdio loop -----------------------------------------------------------

let buffer = "";
let chain: Promise<void> = Promise.resolve();

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  let nl = buffer.indexOf("\n");
  while (nl >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (line) {
      // Serialize handlers so responses are emitted in request order.
      chain = chain
        .then(() => dispatchLine(line))
        .catch((e) => log(`handler error: ${e instanceof Error ? e.message : String(e)}`));
    }
    nl = buffer.indexOf("\n");
  }
});
process.stdin.on("end", () => {
  // Drain any in-flight handlers before exiting so a closing client (or a piped
  // batch of messages) still gets every response.
  void chain.finally(() => process.exit(0));
});

async function dispatchLine(line: string): Promise<void> {
  let msg: unknown;
  try {
    msg = JSON.parse(line);
  } catch {
    respondError(null, -32700, "Parse error");
    return;
  }
  await handle(msg);
}

log(`ready · root "${DEFAULT_ROOT}" · tools: ${TOOLS.map((t) => t.name).join(", ")}`);
