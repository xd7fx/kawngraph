import * as fs from "node:fs";
import { execFileSync } from "node:child_process";
import { graphExists, graphFreshness } from "@kawngraph/core";
import type { Logger } from "@kawngraph/shared";
import { detectAgents } from "../detect";
import { resolveMcpLaunch, resolveProbeLaunch } from "../launch";
import { probeMcpServer } from "../mcpProbe";
import { readIntegrations } from "../integrations";
import type { McpLaunchSpec, Scope } from "../types";

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
  remediation?: string;
}

export interface DoctorReport {
  root: string;
  ok: boolean;
  summary: { pass: number; warn: number; fail: number };
  checks: CheckResult[];
}

export interface DoctorOptions {
  root: string;
  scope?: Scope;
  logger?: Logger;
  /** skip the live MCP handshake (faster; no child process) */
  skipProbe?: boolean;
  launchOverride?: Partial<McpLaunchSpec>;
}

/**
 * Read-only health audit for an KawnGraph-integrated project. Every check is
 * non-destructive — `doctor` never scans, never writes the graph, never edits
 * agent config. It only reports what is and is not healthy, with the one safe
 * command that fixes each problem.
 */
export async function runDoctor(opts: DoctorOptions): Promise<DoctorReport> {
  const root = opts.root;
  const scope = opts.scope ?? "project";
  const checks: CheckResult[] = [];

  // 1. Node runtime
  const major = Number(process.versions.node.split(".")[0]);
  checks.push({
    id: "node-version",
    title: "Node.js runtime",
    status: major >= 18 ? "pass" : "fail",
    detail: `Node ${process.versions.node}`,
    remediation: major >= 18 ? undefined : "Install Node.js 18 or newer.",
  });

  // 2. Graph presence + freshness
  if (!(await graphExists(root))) {
    checks.push({
      id: "graph",
      title: "Agent Context Graph",
      status: "fail",
      detail: "No .kawn/graph.json found.",
      remediation: "kawn scan",
    });
  } else {
    const fresh = await graphFreshness(root);
    const status: CheckStatus =
      fresh.status === "fresh"
        ? "pass"
        : fresh.status === "missing" || fresh.status === "malformed" || fresh.status === "incompatible"
          ? "fail"
          : "warn";
    checks.push({
      id: "graph",
      title: "Agent Context Graph",
      status,
      detail: `${fresh.status} — ${fresh.detail}`,
      remediation: fresh.remediation,
    });
  }

  // 3. MCP server resolvable
  const launch = resolveMcpLaunch(root, opts.launchOverride);
  // An npx launch needs nothing on disk (it fetches @kawngraph/mcp on demand);
  // a local-node launch resolves only if the built server file exists.
  const serverResolved =
    launch.source === "npx"
      ? true
      : launch.source === "global-bin"
        ? Boolean(launch.serverEntry)
        : Boolean(launch.serverEntry && fs.existsSync(launch.serverEntry));
  checks.push({
    id: "mcp-resolve",
    title: "MCP server resolvable",
    status: serverResolved ? (launch.portable ? "pass" : "warn") : "fail",
    detail: serverResolved
      ? `${launch.command} ${launch.args.join(" ")} (${launch.source}${launch.portable ? "" : ", machine-specific local source build"})`
      : `could not locate the local MCP server build (${launch.source}).`,
    remediation: serverResolved
      ? undefined
      : "Run `pnpm build` in the monorepo, or use the published `kawngraph` package (it launches @kawngraph/mcp via npx).",
  });

  // 4. Live MCP handshake (+ retrieval smoke test when a graph exists)
  if (!opts.skipProbe && serverResolved) {
    const withGraph = await graphExists(root);
    const probe = await probeMcpServer(resolveProbeLaunch(root, launch), {
      smokeQuery: withGraph ? "doctor smoke check" : undefined,
      cwd: root,
    });
    const ok = probe.ok && (!withGraph || probe.contextOk === true);
    checks.push({
      id: "mcp-handshake",
      title: "MCP handshake + retrieval",
      status: ok ? "pass" : "fail",
      detail: ok
        ? `${probe.serverName ?? "kawn"} v${probe.serverVersion ?? "?"} · tools: ${probe.tools.join(", ")}${withGraph ? " · kawn_context ok" : ""}`
        : probe.contextError
          ? `${probe.detail}: ${probe.contextError}`
          : probe.detail,
      remediation: ok ? undefined : withGraph ? undefined : "kawn scan",
    });
  }

  // 5. Detected agents + KawnGraph connection state
  const detected = await detectAgents(root, scope);
  const present = detected.filter((d) => d.present || d.installed);
  if (present.length === 0) {
    checks.push({
      id: "agents",
      title: "Agent integrations",
      status: "warn",
      detail: "No supported agent (Claude Code, Codex, Cursor) detected in this project.",
      remediation: "kawn setup --agent all",
    });
  } else {
    for (const d of present) {
      checks.push({
        id: `agent-${d.agent}`,
        title: `Integration · ${d.agent}`,
        status: d.installed ? "pass" : "warn",
        detail: d.installed
          ? `connected (${d.evidence.join(", ")})`
          : `detected but not connected (${d.evidence.join(", ")})`,
        remediation: d.installed ? undefined : `kawn connect ${d.agent}`,
      });
    }
  }

  // 6. Integration manifest consistency (recorded targets still exist)
  const manifest = await readIntegrations(root);
  for (const rec of manifest.integrations) {
    const target = rec.launch.command === "node" ? rec.launch.args[0] : null;
    const ok =
      rec.launch.command === "node"
        ? Boolean(target && fs.existsSync(target))
        : Boolean(findOnPath(rec.launch.command));
    if (!ok) {
      checks.push({
        id: `manifest-${rec.agent}`,
        title: `Recorded server · ${rec.agent}`,
        status: "warn",
        detail: `the launch target recorded for ${rec.agent} no longer resolves (${rec.launch.command} ${rec.launch.args.join(" ")}).`,
        remediation: `kawn connect ${rec.agent} --force`,
      });
    }
  }

  const summary = {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };
  return { root, ok: summary.fail === 0, summary, checks };
}

function findOnPath(name: string): boolean {
  const finder = process.platform === "win32" ? "where" : "which";
  try {
    execFileSync(finder, [name], { stdio: "ignore", timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}
