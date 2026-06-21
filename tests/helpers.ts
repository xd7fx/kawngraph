import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { KawnGraph, KawnNode, KawnEdge, GraphStats } from "@kawngraph/shared";

/** Absolute path to the repo root from a compiled test at tests/dist/*.js. */
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** Build a minimal valid KawnGraph from nodes + edges, computing stats. */
export function makeGraph(nodes: KawnNode[], edges: KawnEdge[]): KawnGraph {
  const byLayer: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byEdgeType: Record<string, number> = {};
  for (const n of nodes) {
    byLayer[n.layer] = (byLayer[n.layer] ?? 0) + 1;
    byType[n.type] = (byType[n.type] ?? 0) + 1;
  }
  for (const e of edges) byEdgeType[e.type] = (byEdgeType[e.type] ?? 0) + 1;
  const stats: GraphStats = { nodes: nodes.length, edges: edges.length, byLayer, byType, byEdgeType };
  return {
    kawnVersion: "0.1.0",
    generatedAt: "2026-01-01T00:00:00.000Z",
    root: ".",
    stats,
    nodes,
    edges,
  };
}

/** Create a fresh temp directory; returns its absolute path. */
export function mkTmp(prefix = "kawn-test-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Write a graph to <root>/.kawn/graph.json. */
export function writeGraphFile(root: string, graph: KawnGraph): string {
  const dir = path.join(root, ".kawn");
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "graph.json");
  fs.writeFileSync(p, JSON.stringify(graph, null, 2), "utf8");
  return p;
}

export interface RpcResult {
  /** Every JSON object the server emitted on stdout, in order. */
  messages: any[];
  /** Responses keyed by their `id` (notifications/parse-errors excluded). */
  byId: Map<unknown, any>;
  stderr: string;
  exitCode: number | null;
}

/**
 * Spawn the built MCP server, feed it newline-delimited JSON-RPC `requests`,
 * close stdin, and collect every stdout line it emits before it exits. This
 * exercises the real stdio transport end-to-end, including clean shutdown.
 *
 * A `string` request is written verbatim (use it to inject a malformed line);
 * anything else is JSON-serialized.
 */
export function rpcRoundtrip(serverArgs: string[], requests: unknown[]): Promise<RpcResult> {
  return new Promise((resolve, reject) => {
    const server = path.join(REPO_ROOT, "packages", "mcp", "dist", "index.js");
    const child = spawn(process.execPath, [server, ...serverArgs], {
      cwd: REPO_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      const messages = out
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => JSON.parse(l));
      const byId = new Map<unknown, any>();
      for (const m of messages) if (m && typeof m === "object" && "id" in m) byId.set(m.id, m);
      resolve({ messages, byId, stderr: err, exitCode: code });
    });
    for (const r of requests) child.stdin.write((typeof r === "string" ? r : JSON.stringify(r)) + "\n");
    child.stdin.end();
  });
}
