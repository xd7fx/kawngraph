import { Logger, ContextMode } from "@kawngraph/shared";
import { readGraph, graphExists, queryGraph } from "@kawngraph/core";

export interface QueryArgs {
  root: string;
  query: string | undefined;
  mode: ContextMode;
  limit?: number;
  json: boolean;
  logger: Logger;
}

export async function runQuery(args: QueryArgs): Promise<void> {
  const { root, query, mode, limit, json, logger } = args;
  if (!query) {
    logger.error('usage: kawn query "<text>" [--mode code|docs|all] [--limit N] [--json]');
    process.exitCode = 1;
    return;
  }
  if (!(await graphExists(root))) {
    logger.error("no .kawn/graph.json found — run `kawn scan` first");
    process.exitCode = 1;
    return;
  }

  const graph = await readGraph(root);
  const hits = queryGraph(graph, query, mode, limit ?? 25);

  if (json) {
    process.stdout.write(JSON.stringify({ query, mode, hits }, null, 2) + "\n");
    return;
  }

  if (hits.length === 0) {
    logger.warn(`no nodes matched "${query}" in mode ${mode}`);
    return;
  }

  const out: string[] = [];
  out.push(`Query "${query}" (mode: ${mode}) — ${hits.length} hit(s):`);
  for (const h of hits) {
    const loc = h.node.lineStart ? `${h.node.sourcePath}:${h.node.lineStart}` : h.node.sourcePath;
    out.push(`  ${String(h.score).padStart(6)}  [${h.node.type}] ${h.node.label}`);
    out.push(`          ${loc}  ·  ${h.reason}`);
  }
  process.stdout.write(out.join("\n") + "\n");
}
