import * as path from "node:path";
import { Logger } from "@kawngraph/shared";
import { disconnectAgent, isAgentId, ALL_AGENT_IDS, type Scope } from "@kawngraph/agents";

export interface DisconnectArgs {
  root: string;
  agent: string;
  scope: Scope;
  json: boolean;
  logger: Logger;
}

/**
 * `kawn disconnect <agent>` — remove ONLY KawnGraph's entry from the agent's config,
 * restoring everything else verbatim (a backup is taken first). Reversible and
 * idempotent: removing what is not there is a clean no-op.
 */
export async function runDisconnect(args: DisconnectArgs): Promise<void> {
  const { logger } = args;
  const root = path.resolve(args.root);

  if (!isAgentId(args.agent)) {
    logger.error(`invalid agent "${args.agent}". Use one of: ${ALL_AGENT_IDS.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (args.scope === "user") {
    logger.error("user (global) scope is not modified by this release — KawnGraph manages project-scoped integrations only.");
    process.exitCode = 1;
    return;
  }

  const result = await disconnectAgent(args.agent, { root, scope: args.scope, logger });

  if (args.json) {
    process.stdout.write(JSON.stringify({ ok: true, ...result }, null, 2) + "\n");
    return;
  }
  for (const note of result.notes) logger.info(`${args.agent}: ${note}`);
  for (const [file, backup] of Object.entries(result.backups)) {
    logger.info(`${args.agent}: backed up ${file} → ${backup}`);
  }
  if (result.changed) logger.success(`disconnected ${args.agent}.`);
  else logger.info(`${args.agent} was not connected — nothing to do.`);
}
