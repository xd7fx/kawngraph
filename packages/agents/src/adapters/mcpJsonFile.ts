import * as path from "node:path";
import { atomicWriteFile, backupFile, removeEmptyParentDir, removeFileIfExists } from "../config/atomicWrite";
import { readJsonFile, formatJson, isPlainObject } from "../config/safeJson";
import { getIntegration } from "../integrations";
import { deepEqual } from "../util";
import { KAWN_SERVER_NAME, LEGACY_SERVER_NAME } from "../types";
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
 * top-level server map. The map key is `mcpServers` for Claude Code's `.mcp.json`
 * and Cursor's `.cursor/mcp.json`, but `servers` for VS Code / Copilot's
 * `.vscode/mcp.json` — so the key is parameterized via `serversKey` and no
 * agent-specific branching leaks into the CLI. The only other per-agent
 * differences are the file path and the exact server-entry shape.
 */
export interface JsonMcpSpec {
  agent: AgentId;
  displayName: string;
  /** file managed by this adapter, relative to the project root */
  relFile: string;
  /** top-level map of server-name → entry. Default `mcpServers`; `servers` for VS Code. */
  serversKey?: string;
  /** build the server entry written under `<serversKey>.kawn` */
  buildEntry(launch: McpLaunchSpec): Record<string, unknown>;
  configFormat: ConfigFormatInfo;
}

const keyOf = (spec: JsonMcpSpec): string => spec.serversKey ?? "mcpServers";
const ownedKeyOf = (spec: JsonMcpSpec): string => `${keyOf(spec)}.${KAWN_SERVER_NAME}`;

/** True when `servers` still carries the pre-rebrand `athar` registration. */
function hasLegacyEntry(servers: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(servers, LEGACY_SERVER_NAME);
}

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
  const key = keyOf(spec);
  const read = await readJsonFile<Record<string, unknown>>(abs);
  const evidence: string[] = [];
  let present = false;
  let installed = false;
  if (read.exists) {
    present = true;
    evidence.push(spec.relFile);
    const servers = read.data && isPlainObject(read.data[key]) ? (read.data[key] as Record<string, unknown>) : undefined;
    installed = Boolean(servers && Object.prototype.hasOwnProperty.call(servers, KAWN_SERVER_NAME));
  }
  return { agent: spec.agent, present, installed, evidence };
}

export async function planJsonMcp(ctx: AdapterContext, spec: JsonMcpSpec): Promise<InstallPlan> {
  const abs = path.join(ctx.root, spec.relFile);
  const key = keyOf(spec);
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
  if (read.exists && current[key] !== undefined && !isPlainObject(current[key])) {
    return {
      agent: spec.agent,
      scope: ctx.scope,
      files: [],
      alreadyInstalled: false,
      notes,
      blocked: `${spec.relFile} has a non-object "${key}" — refusing to edit it.`,
    };
  }

  const servers = isPlainObject(current[key]) ? (current[key] as Record<string, unknown>) : {};
  const existingEntry = servers[KAWN_SERVER_NAME];
  const legacyPresent = hasLegacyEntry(servers);
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

  // A pre-rebrand `athar` registration must be carried over, not left as an
  // orphan beside the new `kawn` entry — so even a byte-identical `kawn` entry is
  // "not already installed" while the legacy entry lingers.
  if (legacyPresent) {
    notes.push(`Migrating a legacy "${LEGACY_SERVER_NAME}" MCP entry to "${KAWN_SERVER_NAME}" in ${spec.relFile}.`);
  }

  const alreadyInstalled = existingEntry !== undefined && deepEqual(existingEntry, desired) && !legacyPresent;
  const merged = mergeEntry(current, desired, key);
  const preview = formatJson(merged);
  const planned: PlannedFile = {
    absPath: abs,
    relPath: spec.relFile,
    exists: read.exists,
    action: alreadyInstalled ? "unchanged" : read.exists ? "update" : "create",
    ownedKey: ownedKeyOf(spec),
    summary: alreadyInstalled
      ? `${spec.relFile} already registers KawnGraph — no change`
      : legacyPresent
        ? `migrate "${LEGACY_SERVER_NAME}" → "${KAWN_SERVER_NAME}" in ${key} in ${spec.relFile}`
        : read.exists
          ? `add "${KAWN_SERVER_NAME}" to ${key} in ${spec.relFile}`
          : `create ${spec.relFile} with the KawnGraph MCP server`,
    preview,
  };
  if (!ctx.launch.portable) {
    notes.push(
      `The generated command points at your local KawnGraph checkout (${ctx.launch.source}); it is machine-specific. A published install writes a portable \`npx @kawngraph/mcp\` command instead.`,
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
    ownedKeys: [ownedKeyOf(spec)],
    notes: plan.notes,
  };
  if (plan.alreadyInstalled) return result;

  const backup = await backupFile(abs, ctx.root);
  if (backup) result.backups[spec.relFile] = path.relative(ctx.root, backup);

  // Write exactly what plan() read and validated above. Re-reading the file here
  // would reopen a window in which a config corrupted between plan and write is
  // silently treated as empty and clobbered; plan()'s malformed / foreign-entry
  // refusal is authoritative.
  const preview = plan.files[0]?.preview;
  if (preview === undefined) throw new Error(`${spec.relFile}: internal error — plan produced no content to write`);
  await atomicWriteFile(abs, preview);
  result.changed = true;
  result.written.push(spec.relFile);
  return result;
}

export async function uninstallJsonMcp(ctx: AdapterContext, spec: JsonMcpSpec): Promise<UninstallResult> {
  const abs = path.join(ctx.root, spec.relFile);
  const key = keyOf(spec);
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
  const servers = isPlainObject(current[key]) ? { ...(current[key] as Record<string, unknown>) } : {};
  const hasKawn = Object.prototype.hasOwnProperty.call(servers, KAWN_SERVER_NAME);
  const hasLegacy = hasLegacyEntry(servers);
  if (!hasKawn && !hasLegacy) {
    result.notes.push(`${spec.relFile} has no "${KAWN_SERVER_NAME}" server — nothing to remove.`);
    return result;
  }

  const backup = await backupFile(abs, ctx.root);
  if (backup) result.backups[spec.relFile] = path.relative(ctx.root, backup);

  delete servers[KAWN_SERVER_NAME];
  // Also clear any leftover pre-rebrand `athar` registration — it is ours too.
  if (hasLegacy) delete servers[LEGACY_SERVER_NAME];
  const removed = [...(hasKawn ? [KAWN_SERVER_NAME] : []), ...(hasLegacy ? [LEGACY_SERVER_NAME] : [])]
    .map((s) => `"${s}"`)
    .join(" and ");
  const otherTopKeys = Object.keys(current).filter((k) => k !== key);
  const prior = await getIntegration(ctx.root, spec.agent, ctx.scope);
  const createdByUs = Boolean(prior) && !prior!.backups[spec.relFile];

  if (Object.keys(servers).length === 0 && otherTopKeys.length === 0 && createdByUs) {
    // We created this file and it now holds nothing of ours — remove it cleanly.
    await removeFileIfExists(abs);
    await removeEmptyParentDir(abs, ctx.root);
    result.notes.push(`removed ${spec.relFile} (created by KawnGraph, now empty).`);
  } else {
    const next: Record<string, unknown> = { [key]: servers, ...stripKey(current, key) };
    await atomicWriteFile(abs, formatJson(next));
    result.notes.push(`removed ${removed} from ${spec.relFile}, preserved everything else.`);
  }
  result.changed = true;
  result.touched.push(spec.relFile);
  return result;
}

function stripKey(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const { [key]: _omit, ...rest } = obj;
  void _omit;
  return rest;
}

function mergeEntry(current: Record<string, unknown>, entry: Record<string, unknown>, key: string): Record<string, unknown> {
  const servers = isPlainObject(current[key]) ? { ...(current[key] as Record<string, unknown>) } : {};
  servers[KAWN_SERVER_NAME] = entry;
  // Carry over a pre-rebrand registration: drop the old `athar` entry so we never
  // leave a duplicate beside the canonical `kawn` one. Unrelated servers stay put.
  delete servers[LEGACY_SERVER_NAME];
  // Keep the server map first for readability, preserve all other keys verbatim.
  return { [key]: servers, ...stripKey(current, key) };
}
