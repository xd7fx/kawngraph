/**
 * Typed client for the @kawngraph/studio-server read-only HTTP API.
 *
 * All paths are relative ("/api/...") so the same bundle works when served by
 * the studio-server in production and behind the Vite dev proxy in development.
 * Every endpoint is read-only; the POST endpoints are computational (query,
 * context, affected, flow) and never mutate files.
 */
import type {
  AffectedResponse,
  KawnGraph,
  ContextMode,
  ContextPack,
  FlowResponse,
  HealthResponse,
  QueryResponse,
  SummaryResponse,
} from "./types";

export class ApiRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

async function parseError(res: Response): Promise<never> {
  let message = `request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body && typeof body.error === "string") message = body.error;
  } catch {
    /* non-JSON error body — keep the generic message */
  }
  throw new ApiRequestError(message, res.status);
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" }, signal });
  if (!res.ok) return parseError(res);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) return parseError(res);
  return (await res.json()) as T;
}

export const api = {
  health: (signal?: AbortSignal) => getJson<HealthResponse>("/api/health", signal),
  graph: (signal?: AbortSignal) => getJson<KawnGraph>("/api/graph", signal),
  summary: (signal?: AbortSignal) => getJson<SummaryResponse>("/api/summary", signal),

  query: (
    body: { query: string; mode?: ContextMode; limit?: number },
    signal?: AbortSignal,
  ) => postJson<QueryResponse>("/api/query", body, signal),

  context: (
    body: { task: string; budget?: number; mode?: ContextMode },
    signal?: AbortSignal,
  ) => postJson<ContextPack>("/api/context", body, signal),

  affected: (
    body: { symbol: string; depth?: number },
    signal?: AbortSignal,
  ) => postJson<AffectedResponse>("/api/affected", body, signal),

  flow: (
    body: { from: string; to: string; maxNodes?: number },
    signal?: AbortSignal,
  ) => postJson<FlowResponse>("/api/flow", body, signal),
};
