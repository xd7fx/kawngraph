import * as path from "node:path";
import { atomicWriteFile, backupFile, removeEmptyParentDir, removeFileIfExists } from "../config/atomicWrite";
import { readJsonFile, formatJson, isPlainObject } from "../config/safeJson";
import { getIntegration } from "../integrations";
import { deepEqual } from "../util";
import { KAWN_SERVER_NAME } from "../types";
import type {
  AdapterContext,
  AgentId,
  ConfigFormatInfo,
  DetectResult,
  InstallPlan,
  InstallResult,
  McpLaunchSpec,
  PlannedFile,
  Scope,
  UninstallResult,
} from "../types";

/**
 * Shared implementation for agents whose MCP integration is a JSON file with a
 * top-level `mcpServers` map (Claude Code's `.mcp.json`, Cursor's
 * `.cursor/mcp.json`). The only per-agent differences are the file path and the
 * exact server-entry shape, injected via `JsonMcpSpec` — so no agent-specific
 * branching leaks into the CLI.
 */
export interface JsonMcpSpec {
  agent: AgentId;
  displayName: string;
  /** file managed by this adapter, relative to the project root */
  relFile: string;
  /** build the server entry written under `mcpServers.kawn` */
  buildEntry(launch: McpLaunchSpec): Record<string, unknown>;
  configFormat: ConfigFormatInfo;
}

const OWNED_KEY = `mcpServers.${KAWN_SERVER_NAME}`;

export function buildStdioEntry(launch: McpLaunchSpec, withType: boolean): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  if (withType) entry.type = "stdio";
  entry.command = launch.command;
  entry.args = launch.args;
  if (Object.keys(launch.env).length > 0) entry.env = launch.env;
  return entry;
}

export async function detectJsonMcp(root: string, scope: Scope, spec: JsonMcpSpec): Promise<DetectResult> {
  const abs = path.join(root, spec.relFile);
  const read = await readJsonFile<Record<string, unknown>>(abs);
  const evidence: string[] = [];
  let present = false;
  let installed = false;
  if (read.exists) {
    present = true;
    evidence.push(spec.relFile);
    const servers = read.data && isPlainObject(read.data.mcpServers) ? read.data.mcpServers : undefined;
    installed = Boolean(servers && Object.prototype.hasOwnProperty.call(servers, KAWN_SERVER_NAME));
  }
  return { agent: spec.agent, present, installed, evidence };
}

export async function planJsonMcp(ctx: AdapterContext, spec: JsonMcpSpec): Promise<InstallPlan> {
  const abs = path.join(ctx.root, spec.relFile);
  const read = await readJsonFile<Record<string, unknown>>(abs);
  const desired = spec.buildEntry(ctx.launch);
  const notes: string[] = [];

  if (read.exists && read.malformed) {
    return {
      agent: spec.agent,
      scope: ctx.scope,
      files: [],
      alreadyInstalled: false,
      notes,
      blocked: `${spec.relFile} exists but is not valid JSON — refusing to edit it. Fix or remove the file, then retry.`,
    };
  }

  const current = isPlainObject(read.data) ? read.data : {};
  if (read.exists && current.mcpServers !== undefined && !isPlainObject(current.mcpServers)) {
    return {
      agent: spec.agent,
      scope: ctx.scope,
      files: [],
      alreadyInstalled: false,
      notes,
      blocked: `${spec.relFile} has a non-object "mcpServers" — refusing to edit it.`,
    };
  }

  const servers = isPlainObject(current.mcpServers) ? (current.mcpServers as Record<string, unknown>) : {};
  const existingEntry = servers[KAWN_SERVER_NAME];
  const prior = await getIntegration(ctx.root, spec.agent, ctx.scope);

  if (existingEntry !== undefined && !deepEqual(existingEntry, desired)) {
    const owned = Boolean(prior) || ctx.force;
    if (!owned) {
      return {
        agent: spec.agent,
        scope: ctx.scope,
        files: [],
        alreadyInstalled: false,
        notes,
        blocked: `${spec.relFile} already defines an MCP server named "${KAWN_SERVER_NAME}" that KawnGraph did not create. Re-run with --force to replace it.`,
      };
    }
    if (!prior && ctx.force) notes.push(`Replacing a pre-existing "${KAWN_SERVER_NAME}" entry in ${spec.relFile} (--force).`);
  }

  const alreadyInstalled = existingEntry !== undefined && deepEqual(existingEntry, desired);
  const merged = mergeEntry(current, desired);
  const preview = formatJson(merged);
  const planned: PlannedFile = {
    absPath: abs,
    relPath: spec.relFile,
    exists: read.exists,
    action: alreadyInstalled ? "unchanged" : read.exists ? "update" : "create",
    ownedKey: OWNED_KEY,
    summary: alreadyInstalled
      ? `${spec.relFile} already registers KawnGraph — no change`
      : read.exists
        ? `add "${KAWN_SERVER_NAME}" to mcpServers in ${spec.relFile}`
        : `create ${spec.relFile} with the KawnGraph MCP server`,
    preview,
  };
  if (!ctx.launch.portable) {
    notes.push(
      `The generated command references a local KawnGraph install (${ctx.launch.source}); it is not portable across machines until @kawngraph/mcp is published to npm.`,
    );
  }
  return { agent: spec.agent, scope: ctx.scope, files: [planned], alreadyInstalled, notes };
}

export async function installJsonMcp(ctx: AdapterContext, spec: JsonMcpSpec): Promise<InstallResult> {
  const plan = await planJsonMcp(ctx, spec);
  if (plan.blocked) throw new Error(plan.blocked);
  const abs = path.join(ctx.root, spec.relFile);
  const result: InstallResult = {
    agent: spec.agent,
    scope: ctx.scope,
    changed: false,
    written: [],
    backups: {},
    ownedKeys: [OWNED_KEY],
    notes: plan.notes,
  };
  if (plan.alreadyInstalled) return result;

  const backup = await backupFile(abs, ctx.root);
  if (backup) result.backups[spec.relFile] = path.relative(ctx.root, backup);

  const read = await readJsonFile<Record<string, unknown>>(abs);
  const current = isPlainObject(read.data) ? read.data : {};
  const merged = mergeEntry(current, spec.buildEntry(ctx.launch));
  await atomicWriteFile(abs, formatJson(merged));
  result.changed = true;
  result.written.push(spec.relFile);
  return result;
}

export async function uninstallJsonMcp(ctx: AdapterContext, spec: JsonMcpSpec): Promise<UninstallResult> {
  const abs = path.join(ctx.root, spec.relFile);
  const result: UninstallResult = {
    agent: spec.agent,
    scope: ctx.scope,
    changed: false,
    touched: [],
    backups: {},
    notes: [],
  };
  const read = await readJsonFile<Record<string, unknown>>(abs);
  if (!read.exists) {
    result.notes.push(`${spec.relFile} not present — nothing to remove.`);
    return result;
  }
  if (read.malformed || !isPlainObject(read.data)) {
    result.notes.push(`${spec.relFile} is not valid JSON — left untouched.`);
    return result;
  }
  const current = read.data;
  const servers = isPlainObject(current.mcpServers) ? { ...(current.mcpServers as Record<string, unknown>) } : {};
  if (!Object.prototype.hasOwnProperty.call(servers, KAWN_SERVER_NAME)) {
    result.notes.push(`${spec.relFile} has no "${KAWN_SERVER_NAME}" server — nothing to remove.`);
    return result;
  }

  const backup = await backupFile(abs, ctx.root);
  if (backup) result.backups[spec.relFile] = path.relative(ctx.root, backup);

  delete servers[KAWN_SERVER_NAME];
  const otherTopKeys = Object.keys(current).filter((k) => k !== "mcpServers");
  const prior = await getIntegration(ctx.root, spec.agent, ctx.scope);
  const createdByUs = Boolean(prior) && !prior!.backups[spec.relFile];

  if (Object.keys(servers).length === 0 && otherTopKeys.length === 0 && createdByUs) {
    // We created this file and it now holds nothing of ours — remove it cleanly.
    await removeFileIfExists(abs);
    await removeEmptyParentDir(abs, ctx.root);
    result.notes.push(`removed ${spec.relFile} (created by KawnGraph, now empty).`);
  } else {
    const next: Record<string, unknown> = { ...current, mcpServers: servers };
    await atomicWriteFile(abs, formatJson(next));
    result.notes.push(`removed "${KAWN_SERVER_NAME}" from ${spec.relFile}, preserved everything else.`);
  }
  result.changed = true;
  result.touched.push(spec.relFile);
  return result;
}

function mergeEntry(current: Record<string, unknown>, entry: Record<string, unknown>): Record<string, unknown> {
  const servers = isPlainObject(current.mcpServers) ? { ...(current.mcpServers as Record<string, unknown>) } : {};
  servers[KAWN_SERVER_NAME] = entry;
  // Keep mcpServers first for readability, preserve all other keys verbatim.
  const { mcpServers: _omit, ...rest } = current;
  void _omit;
  return { mcpServers: servers, ...rest };
}
