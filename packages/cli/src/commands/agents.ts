import * as path from "node:path";
import { Logger } from "@athar/shared";
import { ADAPTERS, detectAgents, type Scope } from "@athar/agents";

export interface AgentsArgs {
  root: string;
  scope: Scope;
  json: boolean;
  logger: Logger;
}

/**
 * `athar agents` — list the supported coding agents, the exact file each
 * integration manages, the authoritative doc the format was verified against and
 * when, plus whether each is detected/connected in this project.
 */
export async function runAgents(args: AgentsArgs): Promise<void> {
  const root = path.resolve(args.root);
  const detected = await detectAgents(root, args.scope);
  const byId = new Map(detected.map((d) => [d.agent, d]));

  if (args.json) {
    const rows = ADAPTERS.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      configFormat: a.configFormat,
      detected: byId.get(a.id) ?? null,
    }));
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    return;
  }

  const out: string[] = [];
  out.push("Supported agents:");
  out.push("");
  for (const a of ADAPTERS) {
    const d = byId.get(a.id);
    const state = d?.installed ? "connected" : d?.present ? "detected" : "not detected";
    out.push(`  ${a.displayName} (${a.id}) — ${state}`);
    out.push(`    file:     ${a.configFormat.file}  ·  owns ${a.configFormat.ownedKey}`);
    out.push(`    verified: ${a.configFormat.verifiedOn}  ·  ${a.configFormat.docUrl}`);
  }
  process.stdout.write(out.join("\n") + "\n");
}
