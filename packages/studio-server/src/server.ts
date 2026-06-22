import * as http from "node:http";
import * as fs from "node:fs/promises";
import { loadGraphState } from "./graphState";
import { BadRequest, apiSummary, apiQuery, apiContext, apiAffected, apiFlow, apiChanges } from "./api";
import { loadBenchReport } from "./bench";
import { resolveStatic, indexHtmlPath, contentTypeFor } from "./static";

export interface StudioLogger {
  info?(msg: string): void;
  warn?(msg: string): void;
  error?(msg: string): void;
}

export interface StudioServerOptions {
  /** Repo root to read `<root>/.kawn/graph.json` from. Fixed for the server's life. */
  root: string;
  /** Built frontend directory to serve. Omit for an API-only server (e.g. in tests). */
  staticDir?: string;
  /** Max request body size in bytes (default 1 MiB). */
  maxBodyBytes?: number;
  logger?: StudioLogger;
}

const DEFAULT_MAX_BODY = 1024 * 1024;

class BodyTooLarge extends Error {}

function readBody(req: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new BodyTooLarge());
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

/**
 * Create the local, READ-ONLY Studio HTTP server. It reads the graph at `root`
 * and serves it plus computed views (query / context / impact / flow). It never
 * writes to the project, never scans, and never reads files outside `staticDir`.
 * The caller is responsible for binding to 127.0.0.1.
 */
export function createStudioServer(opts: StudioServerOptions): http.Server {
  const root = opts.root;
  const staticDir = opts.staticDir;
  const maxBodyBytes = opts.maxBodyBytes ?? DEFAULT_MAX_BODY;
  const log = opts.logger ?? {};

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      log.error?.(`unhandled: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
      else res.end();
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    // Resolve against a dummy origin just to parse the pathname safely.
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    if (pathname === "/api/health") {
      if (method !== "GET" && method !== "HEAD") return void sendJson(res, 405, { error: "method not allowed" });
      const state = await loadGraphState(root);
      return void sendJson(res, 200, {
        ok: state.status === "ok",
        status: state.status,
        root,
        path: state.path,
        generatedAt: state.generatedAt,
        nodes: state.graph?.stats.nodes,
        edges: state.graph?.stats.edges,
        error: state.error,
      });
    }

    if (pathname.startsWith("/api/")) {
      return void (await handleApi(req, res, method, pathname));
    }

    // Everything else is the static frontend (read-only, GET/HEAD).
    return void (await handleStatic(res, method, pathname));
  }

  async function handleApi(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string,
    pathname: string,
  ): Promise<void> {
    const route = pathname.slice("/api/".length);
    const getRoutes = new Set(["graph", "summary"]);
    const postRoutes = new Set(["query", "context", "affected", "flow", "changes"]);

    // Bench reads local benchmark-results/, independent of the graph (no 409 gate).
    if (route === "bench") {
      if (method !== "GET" && method !== "HEAD") return void sendJson(res, 405, { error: "method not allowed" });
      return void sendJson(res, 200, await loadBenchReport(root));
    }

    if (getRoutes.has(route)) {
      if (method !== "GET" && method !== "HEAD") return void sendJson(res, 405, { error: "method not allowed" });
      const state = await loadGraphState(root);
      if (state.status !== "ok" || !state.graph) {
        return void sendJson(res, 409, { status: state.status, error: state.error });
      }
      if (route === "graph") return void sendJson(res, 200, state.graph);
      return void sendJson(res, 200, apiSummary(state.graph));
    }

    if (postRoutes.has(route)) {
      if (method !== "POST") return void sendJson(res, 405, { error: "method not allowed" });
      let body: Record<string, unknown>;
      try {
        const raw = await readBody(req, maxBodyBytes);
        body = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {};
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          throw new BadRequest("request body must be a JSON object");
        }
      } catch (e) {
        if (e instanceof BodyTooLarge) return void sendJson(res, 413, { error: "request body too large" });
        return void sendJson(res, 400, { error: e instanceof BadRequest ? e.message : "invalid JSON body" });
      }

      const state = await loadGraphState(root);
      if (state.status !== "ok" || !state.graph) {
        return void sendJson(res, 409, { status: state.status, error: state.error });
      }

      try {
        const graph = state.graph;
        const result =
          route === "query"
            ? apiQuery(graph, body)
            : route === "context"
              ? apiContext(graph, body)
              : route === "affected"
                ? apiAffected(graph, body)
                : route === "changes"
                  ? apiChanges(graph, root, body)
                  : apiFlow(graph, body);
        return void sendJson(res, 200, result);
      } catch (e) {
        if (e instanceof BadRequest) return void sendJson(res, 400, { error: e.message });
        throw e;
      }
    }

    return void sendJson(res, 404, { error: `unknown endpoint: /api/${route}` });
  }

  async function handleStatic(res: http.ServerResponse, method: string, pathname: string): Promise<void> {
    if (!staticDir) return void sendJson(res, 404, { error: "not found" });
    if (method !== "GET" && method !== "HEAD") return void sendJson(res, 405, { error: "method not allowed" });

    const file = await resolveStatic(staticDir, pathname);
    if (file) return void (await sendFile(res, method, file.path, file.contentType));

    // SPA fallback: only for extension-less routes (client-side routes), never for
    // a missing asset like /app.js (which should 404 honestly).
    const hasExt = /\.[a-z0-9]+$/i.test(pathname);
    if (!hasExt) {
      const idx = indexHtmlPath(staticDir);
      const exists = await fs.stat(idx).catch(() => null);
      if (exists && exists.isFile()) {
        return void (await sendFile(res, method, idx, contentTypeFor(idx)));
      }
    }
    return void sendJson(res, 404, { error: "not found" });
  }

  async function sendFile(
    res: http.ServerResponse,
    method: string,
    filePath: string,
    contentType: string,
  ): Promise<void> {
    try {
      const data = await fs.readFile(filePath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": data.length,
        "X-Content-Type-Options": "nosniff",
        // The graph can change between scans; don't let the browser cache stale UI data.
        "Cache-Control": "no-cache",
      });
      res.end(method === "HEAD" ? undefined : data);
    } catch {
      sendJson(res, 404, { error: "not found" });
    }
  }

  // Reject malformed HTTP without crashing the process.
  server.on("clientError", (_err, socket) => {
    if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  return server;
}
