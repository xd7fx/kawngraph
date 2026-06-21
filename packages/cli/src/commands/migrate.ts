import * as path from "node:path";
import { Logger } from "@kawngraph/shared";
import { migrateLegacyData, type MigrateResult } from "@kawngraph/core";

export interface MigrateArgs {
  root: string;
  dryRun: boolean;
  json: boolean;
  logger: Logger;
}

/**
 * `kawn migrate` — move a pre-rebrand `.athar/` data directory to the canonical
 * `.kawn/`. Safe by construction: never deletes `.athar/`, never overwrites an
 * existing `.kawn/`. `--dry-run` prints the plan and writes nothing.
 */
export async function runMigrate(args: MigrateArgs): Promise<void> {
  const { logger } = args;
  const root = path.resolve(args.root);
  const result = await migrateLegacyData(root, { dryRun: args.dryRun });

  if (args.json) {
    process.stdout.write(JSON.stringify(serializable(result), null, 2) + "\n");
    if (result.status === "conflict") process.exitCode = 1;
    return;
  }

  switch (result.status) {
    case "no-legacy":
      logger.info(result.notes[0] ?? "nothing to migrate.");
      return;

    case "conflict":
      // The first note is the conflict explanation + remediation.
      for (const n of result.notes) logger.error(n);
      process.exitCode = 1;
      return;

    case "planned":
      logger.info(`Plan: copy ${result.items.length} item(s) from ${result.legacy.path} → ${result.target}`);
      for (const it of result.items) logger.info(`  [copy] ${it.rel}`);
      for (const n of result.notes) logger.info(n);
      return;

    case "migrated":
      for (const it of result.items) logger.success(`migrated ${it.rel}`);
      for (const n of result.notes) logger.info(n);
      if (result.recommendRescan) {
        logger.warn("run `kawn scan` to rebuild the graph for the current code.");
      } else {
        logger.success("migration complete — your graph now lives in .kawn/.");
      }
      return;
  }
}

function serializable(r: MigrateResult): Record<string, unknown> {
  return {
    status: r.status,
    target: r.target,
    targetExisted: r.targetExisted,
    recommendRescan: r.recommendRescan,
    legacy: {
      present: r.legacy.present,
      path: r.legacy.path,
      files: r.legacy.files,
      schemaVersion: r.legacy.schemaVersion,
      hasGraph: r.legacy.hasGraph,
      compatible: r.legacy.compatible,
    },
    items: r.items.map((i) => ({ rel: i.rel, kind: i.kind, from: i.from, to: i.to })),
    notes: r.notes,
  };
}
