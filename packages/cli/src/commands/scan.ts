import * as path from "node:path";
import { Logger } from "@athar/shared";
import { scanRepo, generateReport, writeGraph, writeReport } from "@athar/core";

export interface ScanArgs {
  root: string;
  ignore?: string[];
  logger: Logger;
}

export async function runScan(args: ScanArgs): Promise<void> {
  const { root, ignore, logger } = args;
  const graph = await scanRepo({ root, ignore, logger });
  await writeGraph(root, graph);
  await writeReport(root, generateReport(graph));

  logger.success(`wrote ${path.join(root, ".athar", "graph.json")}`);
  logger.success(`wrote ${path.join(root, ".athar", "report.md")}`);

  const layers = Object.entries(graph.stats.byLayer)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join("  ");
  logger.info(`nodes by layer — ${layers || "(none)"}`);
}
