import { Logger } from "@athar/shared";
import { readGraph, graphExists, affected, affectedFiles, AffectedResult } from "@athar/core";

export interface AffectedArgs {
  root: string;
  query: string | undefined;
  depth?: number;
  logger: Logger;
}

export async function runAffected(args: AffectedArgs): Promise<void> {
  const { root, query, depth, logger } = args;
  if (!query) {
    logger.error("usage: athar affected <symbol> [--depth N] [--root path]");
    process.exitCode = 1;
    return;
  }
  if (!(await graphExists(root))) {
    logger.error("no .athar/graph.json found — run `athar scan` first");
    process.exitCode = 1;
    return;
  }

  const graph = await readGraph(root);
  const result = affected(graph, query, depth ?? 6);
  if (result.matched.length === 0) {
    logger.warn(`no node matched "${query}"`);
    return;
  }
  process.stdout.write(format(result) + "\n");
}

function format(result: AffectedResult): string {
  const out: string[] = [];
  out.push(`Target "${result.query}" matched ${result.matched.length} node(s):`);
  for (const n of result.matched) out.push(`  ${n.id}`);
  out.push("");

  if (result.affected.length === 0) {
    out.push("Nothing depends on it (no callers/importers/referrers found).");
    return out.join("\n");
  }

  out.push(`Affected (${result.affected.length}), nearest first:`);
  for (const a of result.affected) {
    out.push(`  [d${a.depth}] ${a.via.padEnd(10)} ${a.node.type.padEnd(8)} ${a.node.label}  (${a.node.sourcePath})`);
  }
  out.push("");

  const files = affectedFiles(result);
  out.push(`Files to re-check (${files.length}):`);
  for (const f of files) out.push(`  - ${f}`);
  return out.join("\n");
}
