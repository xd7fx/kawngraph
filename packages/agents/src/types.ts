import type { Logger } from "@athar/shared";

/** Coding agents Athar can wire up to the Agent Context Graph over MCP. */
export type AgentId = "claude" | "codex" | "cursor";

/**
 * Where an integration is written. `project` (committed to the repo, shared by
 * the team) is the default and strongly preferred. `user` touches the developer's
 * global config and is only ever used when explicitly requested.
 */
export type Scope = "project" | "user";

/** Selector accepted by the CLI's `--agent` flag. */
export type AgentSelector = AgentId | "auto" | "all";

/**
 * How the Athar MCP server should be launched. Honest about provenance: until
 * `@athar/mcp` is published, integrations reference a locally resolved server,
 * which `source` records so we can warn that it is machine-specific.
 */
export interface McpLaunchSpec {
  command: string;
  args: string[];
  env: Record<string, string>;
  /** how `command` was resolved */
  source: "npx" | "global-bin" | "local-node";
  /** true when the config is portable across machines (e.g. a published npx command) */
  portable: boolean;
  /** absolute path to the resolved server entry, when known */
  serverEntry?: string;
}

/** A single file an adapter will create or modify, described before we touch disk. */
export interface PlannedFile {
  /** absolute path */
  absPath: string;
  /** path relative to the project root, for display */
  relPath: string;
  exists: boolean;
  action: "create" | "update" | "unchanged";
  /** the config key/table this adapter owns within the file (e.g. `mcpServers.athar`) */
  ownedKey: string;
  /** human summary of the intended change */
  summary: string;
  /** preview of the exact bytes we would write (whole-file), for `--dry-run` */
  preview?: string;
}

/** A reversible plan produced by an adapter without writing anything. */
export interface InstallPlan {
  agent: AgentId;
  scope: Scope;
  files: PlannedFile[];
  /** nothing would change — the integration is already present and identical */
  alreadyInstalled: boolean;
  /** warnings worth surfacing (e.g. "project not in Codex trusted list") */
  notes: string[];
  /** set when the adapter cannot proceed safely (e.g. malformed existing config) */
  blocked?: string;
}

export interface InstallResult {
  agent: AgentId;
  scope: Scope;
  changed: boolean;
  /** files actually written, relative to root */
  written: string[];
  /** backups created, keyed by the original relative path */
  backups: Record<string, string>;
  /** the keys/tables Athar now owns in those files */
  ownedKeys: string[];
  notes: string[];
}

export interface UninstallResult {
  agent: AgentId;
  scope: Scope;
  changed: boolean;
  /** files modified or removed, relative to root */
  touched: string[];
  backups: Record<string, string>;
  notes: string[];
}

export interface VerifyResult {
  agent: AgentId;
  ok: boolean;
  detail: string;
}

/** Detection signal for one agent in a project. */
export interface DetectResult {
  agent: AgentId;
  /** Athar's own integration is already present at the resolved scope */
  installed: boolean;
  /** the agent itself appears to be used here (its config dir/file exists) */
  present: boolean;
  /** evidence paths (relative) that triggered the detection */
  evidence: string[];
}

/** Everything an adapter needs to plan, install, verify, or remove an integration. */
export interface AdapterContext {
  /** absolute, normalized project root */
  root: string;
  scope: Scope;
  launch: McpLaunchSpec;
  logger: Logger;
  /** overwrite an existing non-Athar entry of the same name when true */
  force: boolean;
}

/** Authoritative config-format provenance, surfaced by `athar agents`. */
export interface ConfigFormatInfo {
  /** the file an adapter manages, relative to the project root */
  file: string;
  /** the owned key or table within that file */
  ownedKey: string;
  docUrl: string;
  /** ISO date we last verified the format against the official docs */
  verifiedOn: string;
}

export interface AgentAdapter {
  readonly id: AgentId;
  readonly displayName: string;
  readonly configFormat: ConfigFormatInfo;
  detect(root: string, scope: Scope): Promise<DetectResult>;
  plan(ctx: AdapterContext): Promise<InstallPlan>;
  install(ctx: AdapterContext): Promise<InstallResult>;
  verify(ctx: AdapterContext): Promise<VerifyResult>;
  uninstall(ctx: AdapterContext): Promise<UninstallResult>;
}

/** The MCP server name Athar registers under, across every agent. */
export const ATHAR_SERVER_NAME = "athar";
