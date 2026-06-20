import * as fs from "node:fs/promises";
import { AtharGraph } from "@athar/shared";
import { graphPath } from "@athar/core";

export type GraphStatus = "ok" | "missing" | "malformed";

export interface GraphState {
  status: GraphStatus;
  /** absolute path we read (or would read) the graph from */
  path: string;
  graph?: AtharGraph;
  /** human-readable problem when status !== "ok" */
  error?: string;
  /** ISO timestamp the graph was generated, when known */
  generatedAt?: string;
}

function looksLikeGraph(value: unknown): value is AtharGraph {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  return Array.isArray(g.nodes) && Array.isArray(g.edges);
}

/**
 * Read `<root>/.athar/graph.json` once, READ-ONLY, and classify the result. This
 * never writes, never scans, and never rebuilds — a missing or malformed graph is
 * a reported state the UI renders, not an error that crashes the server.
 */
export async function loadGraphState(root: string): Promise<GraphState> {
  const path = graphPath(root);
  let raw: string;
  try {
    raw = await fs.readFile(path, "utf8");
  } catch {
    return {
      status: "missing",
      path,
      error: "No .athar/graph.json found. Run `athar scan` to build the graph first.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      status: "malformed",
      path,
      error: `graph.json is not valid JSON (${e instanceof Error ? e.message : String(e)}). Re-run \`athar scan\`.`,
    };
  }

  if (!looksLikeGraph(parsed)) {
    return {
      status: "malformed",
      path,
      error: "graph.json is missing a nodes/edges array. Re-run `athar scan`.",
    };
  }

  return { status: "ok", path, graph: parsed, generatedAt: parsed.generatedAt };
}
