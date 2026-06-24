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
 * GitHub Copilot (VS Code Agent Mode) integration.
 *
 * Config format verified 2026-06-24 against
 * https://code.visualstudio.com/docs/agents/reference/mcp-configuration : a
 * workspace `.vscode/mcp.json` whose top-level key is **`servers`** (NOT
 * `mcpServers`, unlike Cursor/Claude), each stdio entry
 * `{ "type": "stdio", "command", "args", "env" }`. Committing `.vscode/mcp.json`
 * shares the server with the team (VS Code ≥ 1.99). KawnGraph never edits VS Code
 * user settings.
 */
const SPEC: JsonMcpSpec = {
  agent: "copilot",
  displayName: "GitHub Copilot (VS Code)",
  relFile: path.join(".vscode", "mcp.json"),
  serversKey: "servers",
  buildEntry: (launch: McpLaunchSpec) => buildStdioEntry(launch, true),
  configFormat: {
    file: ".vscode/mcp.json",
    ownedKey: "servers.kawn",
    docUrl: "https://code.visualstudio.com/docs/agents/reference/mcp-configuration",
    verifiedOn: "2026-06-24",
  },
};

export const copilotAdapter: AgentAdapter = {
  id: "copilot",
  displayName: SPEC.displayName,
  kind: "mcp",
  supports: { mcp: true, slashCommands: false, contextFiles: false, promptExport: false },
  autoSelectable: true,
  configFormat: SPEC.configFormat,

  async detect(root: string, scope: Scope): Promise<DetectResult> {
    const base = await detectJsonMcp(root, scope, SPEC);
    // `.vscode/` alone is any VS Code project, so use Copilot-specific signals.
    for (const rel of [path.join(".github", "copilot-instructions.md"), path.join(".vscode", "mcp.json")]) {
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
      agent: "copilot",
      ok: probe.ok,
      detail: probe.ok
        ? `handshake ok · tools: ${probe.tools.join(", ")}${probe.contextOk ? " · kawn_context ok" : ""}`
        : probe.detail,
    };
  },
};
