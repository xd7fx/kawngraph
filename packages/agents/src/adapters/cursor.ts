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
 * Cursor integration.
 *
 * Config format verified 2026-06-19 against https://cursor.com/docs/context/mcp:
 * a project-scoped `.cursor/mcp.json` with a `mcpServers` map using the same
 * shape as Claude Desktop — `{ "command", "args", "env" }` (no `type` field).
 */
const SPEC: JsonMcpSpec = {
  agent: "cursor",
  displayName: "Cursor",
  relFile: path.join(".cursor", "mcp.json"),
  buildEntry: (launch: McpLaunchSpec) => buildStdioEntry(launch, false),
  configFormat: {
    file: ".cursor/mcp.json",
    ownedKey: "mcpServers.kawn",
    docUrl: "https://cursor.com/docs/context/mcp",
    verifiedOn: "2026-06-19",
  },
};

export const cursorAdapter: AgentAdapter = {
  id: "cursor",
  displayName: SPEC.displayName,
  kind: "mcp",
  supports: { mcp: true, slashCommands: false, contextFiles: false, promptExport: false },
  autoSelectable: true,
  configFormat: SPEC.configFormat,

  async detect(root: string, scope: Scope): Promise<DetectResult> {
    const base = await detectJsonMcp(root, scope, SPEC);
    if (fs.existsSync(path.join(root, ".cursor"))) {
      base.present = true;
      if (!base.evidence.includes(".cursor")) base.evidence.push(".cursor");
    }
    return base;
  },

  plan: (ctx: AdapterContext) => planJsonMcp(ctx, SPEC),
  install: (ctx: AdapterContext) => installJsonMcp(ctx, SPEC),
  uninstall: (ctx: AdapterContext) => uninstallJsonMcp(ctx, SPEC),

  async verify(ctx: AdapterContext): Promise<VerifyResult> {
    const probe = await probeMcpServer(ctx.launch, { smokeQuery: "verify kawn integration", cwd: ctx.root });
    return {
      agent: "cursor",
      ok: probe.ok,
      detail: probe.ok
        ? `handshake ok · tools: ${probe.tools.join(", ")}${probe.contextOk ? " · kawn_context ok" : ""}`
        : probe.detail,
    };
  },
};
