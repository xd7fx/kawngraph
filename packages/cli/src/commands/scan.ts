import * as path from "node:path";
import { Logger } from "@athar/shared";
import { scanRepo, generateReport, writeGraph, writeReport, writeManifestForGraph } from "@athar/core";

export interface ScanArgs {
  root: string;
  ignore?: string[];
  logger: Logger;
}

export async function runScan(args: ScanArgs): Promise<void> {
  const { ignore, logger } = args;
  const root = path.resolve(args.root);
  const graph = await scanRepo({ root, ignore, logger });
  await writeGraph(root, graph);
  await writeReport(root, generateReport(graph));
  const manifest = await writeManifestForGraph(root, graph);

  logger.success(`wrote ${path.join(root, ".athar", "graph.json")}`);
  logger.success(`wrote ${path.join(root, ".athar", "report.md")}`);
  logger.success(`wrote ${path.join(root, ".athar", "manifest.json")}`);

  const layers = Object.entries(graph.stats.byLayer)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join("  ");
  logger.info(`nodes by layer — ${layers || "(none)"}`);
  logger.info(
    `freshness: ${manifest.trackedFileCount} files · ${manifest.gitHead ? `git ${manifest.gitHead.slice(0, 8)}` : "no git"}`,
  );
}
