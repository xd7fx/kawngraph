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
  gitChangedFiles,
  analyzeChangeImpact,
  GitError,
  type ChangeImpact,
} from "@athar/core";
import { ATHAR_VERSION, AtharNode, ContextMode, ContextPack, ContextItem, ContextRisk } from "@athar/shared";

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
- Use athar_changes to see the impact of the current edits (uncommitted, or a branch vs a base ref) before you commit or when reviewing a PR — what they touch, what to re-check, and the risks. Local git only.

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

// ---- freshness gate + banner ----------------------------------------------
// The server is read-only and must never rebuild. Two tiers of response:
//   • Recoverable lag (stale / possibly-stale): still SERVE, but prepend a
//     banner pointing to the one safe fix (`athar update`).
//   • Untrustworthy graph (incompatible schema, or malformed bytes it cannot
//     parse against the current schema): REFUSE to serve. Returning results
//     derived from a graph Athar cannot trust is worse than refusing, so the
//     tool fails with a structured error + remediation instead.
// graphFreshness() shells out to git, so a short TTL cache keeps a burst of tool
// calls from re-checking on every request.

const FRESHNESS_TTL_MS = 4000;

/** Statuses for which the graph must NOT be served — the data cannot be trusted. */
const BLOCKING_STATUSES = new Set(["incompatible", "malformed"]);

interface FreshnessView {
  status: string;
  detail: string;
  remediation: string;
  /** non-empty only for served (non-blocking) statuses that still warrant a warning */
  banner: string;
  /** true when the graph must be refused rather than served */
  blocked: boolean;
}

const freshnessCache = new Map<string, { at: number; view: FreshnessView }>();

function bannerForFreshness(status: string, detail: string): string {
  switch (status) {
    case "stale":
      return `[athar] ⚠ STALE GRAPH: ${detail} The map below may not match the current code — ask the user to run \`athar update\` to refresh it. This server is read-only and will not rebuild the graph.`;
    case "possibly-stale":
      return "[athar] note: this map's freshness can't be confirmed against git — if the repo changed since the last scan, `athar update` refreshes it.";
    // `incompatible` / `malformed` never reach the banner path — they are gated
    // upstream and refused (see BLOCKING_STATUSES + callTool).
    default:
      return "";
  }
}

async function freshnessView(root: string): Promise<FreshnessView> {
  const now = Date.now();
  const cached = freshnessCache.get(root);
  if (cached && now - cached.at < FRESHNESS_TTL_MS) return cached.view;
  let view: FreshnessView = {
    status: "unknown",
    detail: "",
    remediation: "athar update",
    banner: "",
    blocked: false,
  };
  try {
    const f = await graphFreshness(root);
    view = {
      status: f.status,
      detail: f.detail,
      remediation: f.remediation ?? "athar update",
      banner: bannerForFreshness(f.status, f.detail),
      blocked: BLOCKING_STATUSES.has(f.status),
    };
  } catch {
    // A freshness probe failure must never block serving — fall back to "unknown".
    view = { status: "unknown", detail: "", remediation: "athar update", banner: "", blocked: false };
  }
  freshnessCache.set(root, { at: now, view });
  return view;
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

function nodeLoc(n: AtharNode): string {
  return n.lineStart ? `${n.sourcePath}:${n.lineStart}` : n.sourcePath;
}
function renderNodeList(title: string, nodes: AtharNode[]): string {
  if (nodes.length === 0) return `${title} (0): none`;
  return `${title} (${nodes.length}):\n${nodes.map((n) => `  [${n.type}] ${n.label} — ${nodeLoc(n)}`).join("\n")}`;
}
function formatChangeImpact(impact: ChangeImpact): string {
  const blocks: string[] = [
    `Change impact — ${impact.label} · ${impact.files.length} file(s) changed`,
  ];

  blocks.push(
    impact.changedNodes.length === 0
      ? "CHANGED NODES (0): none of the changed files are in the graph — ask the user to run `athar update`."
      : `CHANGED NODES (${impact.changedNodes.length}):\n${impact.changedNodes.map((n) => `  [${n.type}] ${n.label} — ${nodeLoc(n)}`).join("\n")}`,
  );

  const trunc = impact.impactTruncated ? " (truncated — more exist)" : "";
  blocks.push(
    impact.impacted.length === 0
      ? "IMPACTED (0): nothing depends on the changed nodes."
      : `IMPACTED (${impact.impacted.length})${trunc}, nearest first:\n${impact.impacted
          .map((r) => `  [d${r.depth}] ${r.via} ${r.node.type} ${r.node.label} — ${r.node.sourcePath}`)
          .join("\n")}`,
  );

  blocks.push(
    impact.filesToRecheck.length === 0
      ? "FILES TO RE-CHECK (0): none"
      : `FILES TO RE-CHECK (${impact.filesToRecheck.length}):\n${impact.filesToRecheck.map((p) => `  - ${p}`).join("\n")}`,
  );

  blocks.push(renderNodeList("RELATED DOCS", impact.relatedDocs));
  blocks.push(renderNodeList("RELATED TABLES", impact.relatedTables));
  blocks.push(renderNodeList("RELATED TESTS", impact.relatedTests));

  blocks.push(
    impact.risks.length > 0
      ? `RISKS (${impact.risks.length}):\n${impact.risks.map(renderRisk).join("\n")}`
      : "RISKS (0): none",
  );

  if (impact.unmappedFiles.length > 0) {
    blocks.push(
      `CHANGED BUT NOT IN GRAPH (${impact.unmappedFiles.length}): ${impact.unmappedFiles.join(", ")} — run \`athar update\` to include them.`,
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
  {
    name: "athar_changes",
    description:
      "Impact of the CURRENT change set on this repo: maps the files you changed (uncommitted, or a branch vs a base ref) onto the graph, then lists what depends on them, the files to re-check, and the related docs/tables/tests + risks. Use before committing or when reviewing a branch/PR. Local git only — no network, no GitHub API. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        base: {
          type: "string",
          description: "Base ref for PR mode — compares base...head. Omit to use uncommitted working-tree changes.",
        },
        head: { type: "string", description: "Head ref for PR mode (default HEAD; ignored without `base`)." },
        depth: { type: "number", description: "Max impact depth (default 6)." },
        root: { type: "string", description: "Repo root to read (default: the server's root)." },
      },
    },
    async run(args) {
      const root = rootOf(args);
      const graph = await loadGraph(root);
      const base = asString(args.base);
      const head = asString(args.head);
      let changeSet;
      try {
        changeSet = gitChangedFiles(root, base !== undefined ? { base, head } : {});
      } catch (e) {
        if (e instanceof GitError) return `Cannot read changes: ${e.message}`;
        throw e;
      }
      if (changeSet.files.length === 0) return `No changes detected (${changeSet.label}).`;
      const depth = asNum(args.depth);
      const impact = analyzeChangeImpact(graph, changeSet, depth !== undefined ? { maxDepth: depth } : {});
      return formatChangeImpact(impact);
    },
  },
];

const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t] as const));
const TOOL_LIST = TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));

/**
 * Structured refusal for an untrustworthy graph. Returned for EVERY tool so an
 * agent never acts on results derived from an incompatible/malformed graph. The
 * `text` is human-readable; `structuredContent` is a machine-parseable companion
 * (error code + status + the one remediation command).
 */
function blockedResult(status: string, detail: string, remediation: string): Json {
  const label = status === "incompatible" ? "INCOMPATIBLE GRAPH" : "UNREADABLE GRAPH";
  const text =
    `[athar] ERROR — ${label}: ${detail} ` +
    `Athar is refusing to serve results from a graph it cannot trust. ` +
    `Ask the user to run \`${remediation}\` in a terminal to regenerate the graph, then retry. ` +
    `(This server is read-only and never rebuilds the graph itself.)`;
  return {
    content: [{ type: "text", text }],
    isError: true,
    structuredContent: { error: `${status}_graph`, status, detail, remediation },
  };
}

async function callTool(params: Json): Promise<Json> {
  const name = asString(params.name);
  const args = (params.arguments as Json | undefined) ?? {};
  const tool = name ? TOOL_BY_NAME.get(name) : undefined;
  if (!tool) return { content: [{ type: "text", text: `Unknown tool: ${name ?? "(none)"}` }], isError: true };
  try {
    const root = rootOf(args);
    // Freshness gate. Read-only tolerates *staleness* (it warns and still serves),
    // but an INCOMPATIBLE schema — or a malformed graph it cannot parse — must
    // never yield results: refuse with a structured error + remediation instead.
    const fresh = await freshnessView(root);
    if (fresh.blocked) return blockedResult(fresh.status, fresh.detail, fresh.remediation);
    const text = await tool.run(args);
    // Prepend a freshness banner when the served map may merely lag the code.
    return { content: [{ type: "text", text: fresh.banner ? `${fresh.banner}\n\n${text}` : text }] };
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
