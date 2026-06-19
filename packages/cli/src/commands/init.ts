import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Logger, ATHAR_VERSION } from "@athar/shared";
import { ensureAtharDir, atharDir } from "@athar/core";

export interface InitArgs {
  root: string;
  logger: Logger;
}

const IGNORE_TEMPLATE = `# .atharignore — paths Athar should skip (in addition to sensible defaults)
# A bare name is treated as a directory ignored anywhere (e.g. "fixtures").
# Lines with a slash or "*" are matched against the path (e.g. "docs/legacy/*").
# Note: SQL is never ignored by default.

# fixtures
# **/snapshots/*
`;

export async function runInit(args: InitArgs): Promise<void> {
  const { root, logger } = args;
  await ensureAtharDir(root);

  const config = { atharVersion: ATHAR_VERSION, createdAt: new Date().toISOString() };
  await fs.writeFile(path.join(atharDir(root), "config.json"), JSON.stringify(config, null, 2) + "\n", "utf8");

  const ignorePath = path.join(root, ".atharignore");
  try {
    await fs.access(ignorePath);
  } catch {
    await fs.writeFile(ignorePath, IGNORE_TEMPLATE, "utf8");
    logger.info("created .atharignore");
  }

  logger.success(`initialized Athar in ${path.join(root, ".athar")}`);
  logger.info("next: run `athar scan` to build the graph");
}
