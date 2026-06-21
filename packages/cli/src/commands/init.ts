import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Logger, KAWN_VERSION } from "@kawngraph/shared";
import { ensureKawnDir, kawnDir } from "@kawngraph/core";

export interface InitArgs {
  root: string;
  logger: Logger;
}

const IGNORE_TEMPLATE = `# .kawnignore — paths KawnGraph should skip (in addition to sensible defaults)
# A bare name is treated as a directory ignored anywhere (e.g. "fixtures").
# Lines with a slash or "*" are matched against the path (e.g. "docs/legacy/*").
# Note: SQL is never ignored by default.

# fixtures
# **/snapshots/*
`;

export async function runInit(args: InitArgs): Promise<void> {
  const { root, logger } = args;
  await ensureKawnDir(root);

  const config = { kawnVersion: KAWN_VERSION, createdAt: new Date().toISOString() };
  await fs.writeFile(path.join(kawnDir(root), "config.json"), JSON.stringify(config, null, 2) + "\n", "utf8");

  const ignorePath = path.join(root, ".kawnignore");
  try {
    await fs.access(ignorePath);
  } catch {
    await fs.writeFile(ignorePath, IGNORE_TEMPLATE, "utf8");
    logger.info("created .kawnignore");
  }

  logger.success(`initialized KawnGraph in ${path.join(root, ".kawn")}`);
  logger.info("next: run `kawn scan` to build the graph");
}
