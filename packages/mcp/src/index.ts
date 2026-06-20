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
import { readGraph, graphExists, buildContextPack, queryGraph, affected, affectedFiles } from "@athar/core";
import { ATHAR_VERSION, ContextMode, ContextPack, ContextItem, ContextRisk } from "@athar/shared";

type Json = Record<string, unknown>;

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
      "Build a token-budgeted Context Pack for a coding task: the few files, docs, and tables that matter, plus risk flags. Call this BEFORE reading files — load the map, not the whole repo.",
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
      "Search the Agent Context Graph for nodes matching a phrase, ranked and mode-scoped (code|docs|all). Use to locate where something lives without grepping the whole tree.",
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
      "Reverse impact analysis: given a symbol or file, list what depends on it (callers, importers, referrers) and which files to re-check. Use before changing shared code.",
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
    return { content: [{ type: "text", text }] };
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
