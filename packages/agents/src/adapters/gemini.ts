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
 * Gemini CLI integration.
 *
 * Config format verified 2026-06-24 against
 * https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md :
 * a project-scoped `.gemini/settings.json` with a top-level `mcpServers` map;
 * a stdio entry is `{ "command", "args", "env" }` (no `type` field — Gemini infers
 * stdio from `command`). KawnGraph never edits the global `~/.gemini/settings.json`.
 */
const SPEC: JsonMcpSpec = {
  agent: "gemini",
  displayName: "Gemini CLI",
  relFile: path.join(".gemini", "settings.json"),
  serversKey: "mcpServers",
  buildEntry: (launch: McpLaunchSpec) => buildStdioEntry(launch, false),
  configFormat: {
    file: ".gemini/settings.json",
    ownedKey: "mcpServers.kawn",
    docUrl: "https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md",
    verifiedOn: "2026-06-24",
  },
};

export const geminiAdapter: AgentAdapter = {
  id: "gemini",
  displayName: SPEC.displayName,
  kind: "mcp",
  supports: { mcp: true, slashCommands: false, contextFiles: false, promptExport: false },
  autoSelectable: true,
  configFormat: SPEC.configFormat,

  async detect(root: string, scope: Scope): Promise<DetectResult> {
    const base = await detectJsonMcp(root, scope, SPEC);
    for (const rel of [".gemini", "GEMINI.md"]) {
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
      agent: "gemini",
      ok: probe.ok,
      detail: probe.ok
        ? `handshake ok · tools: ${probe.tools.join(", ")}${probe.contextOk ? " · kawn_context ok" : ""}`
        : probe.detail,
    };
  },
};
