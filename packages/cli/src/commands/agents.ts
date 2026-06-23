import * as path from "node:path";
import { Logger } from "@kawngraph/shared";
import { ADAPTERS, detectAgents, type AgentCapabilities, type Scope } from "@kawngraph/agents";

export interface AgentsArgs {
  root: string;
  scope: Scope;
  json: boolean;
  /** `list` = full capability matrix (default); `status` = compact connection state */
  view?: "list" | "status";
  logger: Logger;
}

function capsLine(s: AgentCapabilities): string {
  const on = Object.entries(s)
    .filter(([, v]) => v)
    .map(([k]) => k);
  return on.length ? on.join(", ") : "—";
}

/**
 * `kawn agents` — the honest integration matrix: every supported agent, HOW
 * KawnGraph reaches it (MCP / context-file / export / local-LLM), what each
 * adapter can produce, the exact file it manages, the doc the format was verified
 * against and when, and whether it's detected/connected here.
 *
 * `kawn agents status` prints just the connection state.
 */
export async function runAgents(args: AgentsArgs): Promise<void> {
  const root = path.resolve(args.root);
  const detected = await detectAgents(root, args.scope);
  const byId = new Map(detected.map((d) => [d.agent, d]));
  const stateOf = (id: string): string => {
    const d = byId.get(id as never);
    return d?.installed ? "connected" : d?.present ? "detected" : "not detected";
  };

  if (args.json) {
    const rows = ADAPTERS.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      kind: a.kind,
      supports: a.supports,
      autoSelectable: a.autoSelectable,
      configFormat: a.configFormat,
      state: stateOf(a.id),
      detected: byId.get(a.id) ?? null,
    }));
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    return;
  }

  const out: string[] = [];
  if (args.view === "status") {
    out.push("Agent connection status:");
    out.push("");
    for (const a of ADAPTERS) out.push(`  ${a.displayName} (${a.id}) — ${stateOf(a.id)}`);
    process.stdout.write(out.join("\n") + "\n");
    return;
  }

  out.push("Supported agents (one core graph · an adapter per tool):");
  out.push("");
  for (const a of ADAPTERS) {
    out.push(`  ${a.displayName} (${a.id}) — ${stateOf(a.id)}  ·  via ${a.kind}${a.autoSelectable ? "" : "  (opt-in)"}`);
    out.push(`    supports: ${capsLine(a.supports)}`);
    out.push(`    file:     ${a.configFormat.file}  ·  owns ${a.configFormat.ownedKey}`);
    out.push(`    verified: ${a.configFormat.verifiedOn}  ·  ${a.configFormat.docUrl}`);
  }
  out.push("");
  out.push("  Setup:  kawn setup <id>  ·  kawn setup all  ·  kawn setup local --provider ollama|lmstudio");
  out.push("  Remove: kawn agents uninstall <id>");
  process.stdout.write(out.join("\n") + "\n");
}
