import * as path from "node:path";
import { Logger } from "@kawngraph/shared";
import { graphExists, graphFreshness } from "@kawngraph/core";
import {
  planSetup,
  applySetup,
  isAgentId,
  ALL_AGENT_IDS,
  type AdapterOptions,
  type AgentSelector,
  type Scope,
  type SetupPlan,
  type SetupReport,
} from "@kawngraph/agents";
import { runScan } from "./scan";
import { confirm } from "./prompt";

export interface SetupArgs {
  root: string;
  /** raw selector: auto | all | claude | codex | cursor | copilot | gemini | aider | generic | local */
  agent: string;
  scope: Scope;
  yes: boolean;
  force: boolean;
  dryRun: boolean;
  json: boolean;
  ignore?: string[];
  /** adapter-specific options (e.g. the `local` provider) */
  options?: AdapterOptions;
  logger: Logger;
}

function parseSelector(raw: string, logger: Logger): AgentSelector | null {
  if (raw === "auto" || raw === "all" || isAgentId(raw)) return raw;
  logger.error(`invalid --agent "${raw}". Use: auto | all | ${ALL_AGENT_IDS.join(" | ")}`);
  return null;
}

/**
 * `kawn setup` — one command that connects this project to the coding agents you
 * use. It scans (with confirmation) if needed, detects Claude Code / Codex /
 * Cursor, installs reversible project-scoped MCP integrations, and verifies that
 * retrieval actually works. Honors --dry-run, --yes (non-interactive), --force,
 * --json, and --scope.
 */
export async function runSetup(args: SetupArgs): Promise<void> {
  const { logger } = args;
  const root = path.resolve(args.root);

  if (args.scope === "user") {
    logger.error(
      "user (global) scope is intentionally not modified by this release — KawnGraph installs project-scoped integrations only. Re-run without --scope user.",
    );
    process.exitCode = 1;
    return;
  }

  const selector = parseSelector(args.agent, logger);
  if (!selector) {
    process.exitCode = 1;
    return;
  }

  // Step: ensure a graph exists (build it, with consent, when missing).
  let hasGraph = await graphExists(root);
  if (!hasGraph && !args.dryRun) {
    const ok = await confirm(`No .kawn/graph.json in ${root}. Scan now to build it?`, args.yes);
    if (ok) {
      await runScan({ root, ignore: args.ignore, logger });
      hasGraph = true;
    } else {
      logger.warn("skipping scan — the integration will be installed, but agents get no context until you run `kawn scan`.");
    }
  } else if (hasGraph) {
    const fresh = await graphFreshness(root);
    if (fresh.status !== "fresh") {
      logger.info(`graph status: ${fresh.status} — ${fresh.detail}${fresh.remediation ? ` (fix: ${fresh.remediation})` : ""}`);
    }
  }

  // Step: plan (no writes yet).
  const plan = await planSetup({ root, scope: args.scope, selector, force: args.force, options: args.options, logger });

  if (plan.selection.agents.length === 0) {
    if (args.json) emitJson({ ok: true, mode: "noop", root, note: plan.selection.note });
    logger.warn(plan.selection.note ?? "no agents selected.");
    return;
  }

  describePlan(plan, logger);

  if (args.dryRun) {
    if (args.json) emitJson({ ok: true, mode: "dry-run", ...serializablePlan(plan) });
    logger.info("dry run — no files were changed.");
    return;
  }

  // Step: confirm before mutating (skipped with --yes; never hangs in CI).
  const fileCount = plan.plans.reduce((n, p) => n + p.files.filter((f) => f.action !== "unchanged").length, 0);
  const blockedInPlan = plan.plans.filter((p) => p.blocked);
  if (fileCount === 0 && blockedInPlan.length === 0) {
    if (args.json) emitJson({ ok: true, mode: "already-installed", root });
    logger.success("already connected — nothing to change.");
    return;
  }
  const proceed = await confirm(`Apply changes to ${fileCount} file(s)?`, args.yes);
  if (!proceed) {
    logger.warn("aborted — no changes made.");
    process.exitCode = 1;
    return;
  }

  // Step: install + verify (live MCP handshake; retrieval smoke test when a graph exists).
  const report = await applySetup({
    root,
    scope: args.scope,
    selector,
    force: args.force,
    options: args.options,
    logger,
    verify: true,
  });

  const ok = describeReport(report, hasGraph, logger);
  if (args.json) emitJson({ ok, mode: "apply", ...serializableReport(report) });
  if (!ok) process.exitCode = 1;
}

/** `kawn connect <agent>` — install a single agent's integration. */
export async function runConnect(agent: string, args: Omit<SetupArgs, "agent">): Promise<void> {
  await runSetup({ ...args, agent });
}

function describePlan(plan: SetupPlan, logger: Logger): void {
  logger.info(
    `target: ${plan.root}  ·  scope: ${plan.scope}  ·  launch: ${plan.launch.command} (${plan.launch.source}${plan.launch.portable ? "" : ", local"})`,
  );
  const detectedLine = plan.detected
    .map((d) => `${d.agent}${d.installed ? "✓" : d.present ? "•" : "·"}`)
    .join("  ");
  logger.info(`detected: ${detectedLine}   (✓ connected · • present · · absent)`);
  for (const p of plan.plans) {
    if (p.blocked) {
      logger.warn(`${p.agent}: BLOCKED — ${p.blocked}`);
      continue;
    }
    for (const f of p.files) {
      logger.info(`  ${p.agent}: [${f.action}] ${f.relPath} — ${f.summary}`);
    }
    for (const note of p.notes) logger.info(`  ${p.agent}: note — ${note}`);
  }
}

function describeReport(report: SetupReport, hadGraph: boolean, logger: Logger): boolean {
  for (const r of report.results) {
    if (r.changed) {
      logger.success(`${r.agent}: wrote ${r.written.join(", ")}`);
      for (const [file, backup] of Object.entries(r.backups)) {
        logger.info(`  ${r.agent}: backed up ${file} → ${backup}`);
      }
    } else {
      logger.info(`${r.agent}: no change (already connected)`);
    }
    for (const note of r.notes) logger.info(`  ${r.agent}: note — ${note}`);
  }

  let ok = true;
  for (const b of report.blocked) {
    logger.error(`${b.agent}: ${b.reason}`);
    ok = false;
  }

  if (report.mcp) {
    if (report.mcp.ok && (!hadGraph || report.mcp.contextOk)) {
      logger.success(
        `MCP verified — ${report.mcp.serverName ?? "kawn"} v${report.mcp.serverVersion ?? "?"} · tools: ${report.mcp.tools.join(", ")}${report.mcp.contextOk ? " · kawn_context ok" : " (graph not built yet; run kawn scan)"}`,
      );
    } else {
      logger.error(`MCP verification failed — ${report.mcp.contextError ?? report.mcp.detail}`);
      ok = false;
    }
  }

  if (ok) {
    logger.success("setup complete — your agents now retrieve context from KawnGraph automatically.");
  }
  return ok;
}

function serializablePlan(plan: SetupPlan) {
  return {
    root: plan.root,
    scope: plan.scope,
    launch: plan.launch,
    detected: plan.detected,
    selection: plan.selection,
    plans: plan.plans.map((p) => ({
      agent: p.agent,
      alreadyInstalled: p.alreadyInstalled,
      blocked: p.blocked,
      notes: p.notes,
      files: p.files.map((f) => ({ relPath: f.relPath, action: f.action, ownedKey: f.ownedKey, summary: f.summary })),
    })),
  };
}

function serializableReport(report: SetupReport) {
  return {
    root: report.root,
    scope: report.scope,
    launch: report.launch,
    results: report.results,
    blocked: report.blocked,
    mcp: report.mcp,
    recheck: report.recheck,
    notes: report.notes,
  };
}

function emitJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}
