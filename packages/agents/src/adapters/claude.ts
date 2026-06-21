import * as fs from "node:fs";
import * as path from "node:path";
import {
  JsonMcpSpec,
  buildStdioEntry,
  detectJsonMcp,
  installJsonMcp,
  planJsonMcp,
  uninstallJsonMcp,
} from "./mcpJsonFile";
import { probeMcpServer } from "../mcpProbe";
import type { AdapterContext, AgentAdapter, DetectResult, McpLaunchSpec, Scope, VerifyResult } from "../types";

/**
 * Claude Code integration.
 *
 * Config format verified 2026-06-19 against https://code.claude.com/docs/en/mcp.md:
 * a project-scoped `.mcp.json` at the repo root with a `mcpServers` map; each
 * stdio entry is `{ "type": "stdio", "command", "args", "env" }`. Committing
 * `.mcp.json` shares the server with the team; Claude prompts each user once to
 * approve a new project MCP server. KawnGraph never touches CLAUDE.md.
 */
const SPEC: JsonMcpSpec = {
  agent: "claude",
  displayName: "Claude Code",
  relFile: ".mcp.json",
  buildEntry: (launch: McpLaunchSpec) => buildStdioEntry(launch, true),
  configFormat: {
    file: ".mcp.json",
    ownedKey: "mcpServers.kawn",
    docUrl: "https://code.claude.com/docs/en/mcp.md",
    verifiedOn: "2026-06-19",
  },
};

export const claudeAdapter: AgentAdapter = {
  id: "claude",
  displayName: SPEC.displayName,
  configFormat: SPEC.configFormat,

  async detect(root: string, scope: Scope): Promise<DetectResult> {
    const base = await detectJsonMcp(root, scope, SPEC);
    // Extra "the agent is used here" signals beyond our own config file.
    for (const rel of [".claude", "CLAUDE.md"]) {
      if (fs.existsSync(path.join(root, rel))) {
        base.present = true;
        if (!base.evidence.includes(rel)) base.evidence.push(rel);
      }
    }
    return base;
  },

  plan: (ctx: AdapterContext) => planJsonMcp(ctx, SPEC),
  install: (ctx: AdapterContext) => installJsonMcp(ctx, SPEC),
  uninstall: (ctx: AdapterContext) => uninstallJsonMcp(ctx, SPEC),

  async verify(ctx: AdapterContext): Promise<VerifyResult> {
    const probe = await probeMcpServer(ctx.launch, { smokeQuery: "verify kawn integration", cwd: ctx.root });
    return {
      agent: "claude",
      ok: probe.ok,
      detail: probe.ok
        ? `handshake ok · tools: ${probe.tools.join(", ")}${probe.contextOk ? " · kawn_context ok" : ""}`
        : probe.detail,
    };
  },
};
