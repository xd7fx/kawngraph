import * as path from "node:path";
import { Logger } from "@kawngraph/shared";
import {
  scanRepo,
  generateReport,
  writeGraph,
  writeReport,
  writeManifestForGraph,
  detectLegacyData,
  graphExists,
  LEGACY_DIR_NAME,
} from "@kawngraph/core";

export interface ScanArgs {
  root: string;
  ignore?: string[];
  logger: Logger;
}

export async function runScan(args: ScanArgs): Promise<void> {
  const { ignore, logger } = args;
  const root = path.resolve(args.root);

  // Deprecation nudge: a legacy .athar/ exists but no canonical graph yet.
  // We always write to .kawn/ (never .athar/), so this is purely a hint — it
  // keeps us from silently leaving the user's old data dir behind.
  const legacy = await detectLegacyData(root);
  if (legacy.present && !(await graphExists(root))) {
    logger.warn(
      `found a legacy ${LEGACY_DIR_NAME}/ data directory — building the graph at .kawn/ instead. ` +
        `Run \`kawn migrate\` to carry over the old graph, or ignore this and keep the fresh scan.`,
    );
  }

  const graph = await scanRepo({ root, ignore, logger });
  await writeGraph(root, graph);
  await writeReport(root, generateReport(graph));
  const manifest = await writeManifestForGraph(root, graph);

  logger.success(`wrote ${path.join(root, ".kawn", "graph.json")}`);
  logger.success(`wrote ${path.join(root, ".kawn", "report.md")}`);
  logger.success(`wrote ${path.join(root, ".kawn", "manifest.json")}`);

  const layers = Object.entries(graph.stats.byLayer)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join("  ");
  logger.info(`nodes by layer — ${layers || "(none)"}`);
  logger.info(
    `freshness: ${manifest.trackedFileCount} files · ${manifest.gitHead ? `git ${manifest.gitHead.slice(0, 8)}` : "no git"}`,
  );
}
