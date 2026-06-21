import * as path from "node:path";
import { graphExists } from "@kawngraph/core";
import { KAWN_VERSION, type Logger } from "@kawngraph/shared";
import { detectAgents, resolveSelection, type Selection } from "./detect";
import { getAdapter } from "./registry";
import { resolveMcpLaunch } from "./launch";
import { probeMcpServer, type McpProbeResult } from "./mcpProbe";
import { removeIntegrationRecord, upsertIntegration } from "./integrations";
import type {
  AdapterContext,
  AgentId,
  AgentSelector,
  DetectResult,
  InstallPlan,
  InstallResult,
  McpLaunchSpec,
  Scope,
  UninstallResult,
} from "./types";

export interface SetupOptions {
  /** project root (absolute or relative; resolved internally) */
  root: string;
  scope?: Scope;
  selector?: AgentSelector;
  force?: boolean;
  logger: Logger;
  /** override the resolved MCP launch command (tests / advanced use) */
  launchOverride?: Partial<McpLaunchSpec>;
}

export interface SetupPlan {
  root: string;
  scope: Scope;
  launch: McpLaunchSpec;
  detected: DetectResult[];
  selection: Selection;
  plans: InstallPlan[];
}

export interface SetupReport {
  root: string;
  scope: Scope;
  launch: McpLaunchSpec;
  results: InstallResult[];
  blocked: { agent: AgentId; reason: string }[];
  /** global MCP handshake result, when verification was requested */
  mcp?: McpProbeResult;
  /** detection re-run after install, to confirm entries landed */
  recheck?: DetectResult[];
  notes: string[];
}

function ctxFor(root: string, scope: Scope, launch: McpLaunchSpec, force: boolean, logger: Logger): AdapterContext {
  return { root, scope, launch, logger, force };
}

/** Compute (but do not apply) the full setup plan. Pure with respect to disk. */
export async function planSetup(opts: SetupOptions): Promise<SetupPlan> {
  const root = path.resolve(opts.root);
  const scope = opts.scope ?? "project";
  const force = opts.force ?? false;
  const launch = resolveMcpLaunch(root, opts.launchOverride);
  const detected = await detectAgents(root, scope);
  const selection = resolveSelection(opts.selector ?? "auto", detected);
  const plans: InstallPlan[] = [];
  for (const agent of selection.agents) {
    const adapter = getAdapter(agent);
    plans.push(await adapter.plan(ctxFor(root, scope, launch, force, opts.logger)));
  }
  return { root, scope, launch, detected, selection, plans };
}

export interface ApplyOptions extends SetupOptions {
  /** run a live MCP handshake + kawn_context smoke test after installing */
  verify?: boolean;
}

/** Install integrations for the selected agents and record ownership. */
export async function applySetup(opts: ApplyOptions): Promise<SetupReport> {
  const root = path.resolve(opts.root);
  const scope = opts.scope ?? "project";
  const force = opts.force ?? false;
  const launch = resolveMcpLaunch(root, opts.launchOverride);
  const detected = await detectAgents(root, scope);
  const selection = resolveSelection(opts.selector ?? "auto", detected);

  const results: InstallResult[] = [];
  const blocked: { agent: AgentId; reason: string }[] = [];
  const notes: string[] = [];
  if (selection.note) notes.push(selection.note);

  for (const agent of selection.agents) {
    const adapter = getAdapter(agent);
    const ctx = ctxFor(root, scope, launch, force, opts.logger);
    const plan = await adapter.plan(ctx);
    if (plan.blocked) {
      blocked.push({ agent, reason: plan.blocked });
      continue;
    }
    const result = await adapter.install(ctx);
    results.push(result);
    if (result.changed) {
      await upsertIntegration(root, {
        agent,
        scope,
        installedAt: new Date().toISOString(),
        kawnVersion: KAWN_VERSION,
        files: result.written,
        ownedKeys: result.ownedKeys,
        backups: result.backups,
        launch: { command: launch.command, args: launch.args, source: launch.source, portable: launch.portable },
      });
    }
  }

  const report: SetupReport = { root, scope, launch, results, blocked, notes };
  if (opts.verify && selection.agents.length > 0) {
    // Only run the live retrieval smoke test when a graph exists; otherwise just
    // prove the server launches and lists tools (the graph is built separately).
    const withGraph = await graphExists(root);
    report.mcp = await probeMcpServer(launch, {
      smokeQuery: withGraph ? "verify kawn setup" : undefined,
      cwd: root,
    });
    report.recheck = await detectAgents(root, scope);
  }
  return report;
}

/** Install a single agent (used by `kawn connect <agent>`). */
export async function connectAgent(agent: AgentId, opts: Omit<SetupOptions, "selector"> & { verify?: boolean }): Promise<SetupReport> {
  return applySetup({ ...opts, selector: agent, verify: opts.verify });
}

/** Remove a single agent's integration, restoring the user's config (used by `kawn disconnect <agent>`). */
export async function disconnectAgent(
  agent: AgentId,
  opts: Omit<SetupOptions, "selector">,
): Promise<UninstallResult> {
  const root = path.resolve(opts.root);
  const scope = opts.scope ?? "project";
  const launch = resolveMcpLaunch(root, opts.launchOverride);
  const adapter = getAdapter(agent);
  const result = await adapter.uninstall(ctxFor(root, scope, launch, opts.force ?? false, opts.logger));
  if (result.changed) await removeIntegrationRecord(root, agent, scope);
  return result;
}
