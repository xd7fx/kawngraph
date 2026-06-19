import { Logger } from "@athar/shared";
import { runScan } from "./scan";

export interface UpdateArgs {
  root: string;
  ignore?: string[];
  logger: Logger;
}

/**
 * v0.1 `update` is a full re-scan. Incremental (changed-file) updates are
 * planned for a later phase.
 */
export async function runUpdate(args: UpdateArgs): Promise<void> {
  args.logger.info("update: re-scanning (incremental updates planned for a later phase)");
  await runScan(args);
}
