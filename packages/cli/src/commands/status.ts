import * as path from "node:path";
import { Logger } from "@kawngraph/shared";
import { graphFreshness } from "@kawngraph/core";
import { detectAgents, readIntegrations, type Scope } from "@kawngraph/agents";

export interface StatusArgs {
  root: string;
  scope: Scope;
  json: boolean;
  logger: Logger;
}

/**
 * `kawn status` — a fast, read-only snapshot: is the graph fresh, which agents
 * are detected, and which are connected to KawnGraph. Never rebuilds anything.
 */
export async function runStatus(args: StatusArgs): Promise<void> {
  const root = path.resolve(args.root);
  const freshness = await graphFreshness(root);
  const detected = await detectAgents(root, args.scope);
  const integrations = await readIntegrations(root);

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          root,
          freshness,
          agents: detected,
          integrations: integrations.integrations,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const out: string[] = [];
  out.push(`kawn status — ${root}`);
  out.push("");
  out.push(`graph: ${freshness.status} — ${freshness.detail}`);
  if (freshness.remediation) out.push(`       fix: ${freshness.remediation}`);
  if (freshness.scannedAt) out.push(`       scanned: ${freshness.scannedAt}`);
  out.push("");
  out.push("agents:");
  for (const d of detected) {
    const state = d.installed ? "connected" : d.present ? "detected (not connected)" : "not detected";
    out.push(`  ${d.agent.padEnd(7)} ${state}${d.evidence.length ? `  [${d.evidence.join(", ")}]` : ""}`);
  }
  if (integrations.integrations.length > 0) {
    out.push("");
    out.push("installed integrations:");
    for (const r of integrations.integrations) {
      out.push(`  ${r.agent} (${r.scope}) → ${r.files.join(", ")}  · since ${r.installedAt}`);
    }
  }
  process.stdout.write(out.join("\n") + "\n");
}
