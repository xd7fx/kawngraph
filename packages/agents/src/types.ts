import type { Logger } from "@kawngraph/shared";

/**
 * Every coding agent / target KawnGraph can wire up to the Agent Context Graph.
 * The idea: ONE core graph + Context Pack, and an adapter per agent — never
 * bespoke logic per tool. Tools that speak MCP get a server registration; tools
 * that don't get a context-file or a prompt/JSON export of the SAME pack.
 */
export type AgentId =
  | "claude"
  | "codex"
  | "cursor"
  | "copilot"
  | "gemini"
  | "aider"
  | "local"
  | "generic";

/**
 * How an adapter delivers KawnGraph to its agent:
 *  - `mcp`          — registers the read-only MCP server in the agent's config.
 *  - `context-file` — writes a KawnGraph context file the agent reads (e.g. Aider `--read`).
 *  - `export`       — emits the pack as a Markdown prompt / JSON for any tool.
 *  - `local-llm`    — records an OPTIONAL local LLM endpoint (Ollama / LM Studio)
 *                     used only for summarization/reranking; never for scanning.
 */
export type AgentKind = "mcp" | "context-file" | "export" | "local-llm";

/**
 * What an adapter can produce for its agent. Surfaced by `kawn agents` so the
 * matrix is honest: not every tool speaks MCP, but every tool can consume the
 * same Context Pack through at least one of these.
 */
export interface AgentCapabilities {
  /** registers the KawnGraph MCP server in the agent's own config */
  mcp: boolean;
  /** ships KawnGraph slash commands / prompts for the agent */
  slashCommands: boolean;
  /** writes a context file the agent reads directly */
  contextFiles: boolean;
  /** can emit a Markdown/JSON prompt bundle the agent (or a human) can paste */
  promptExport: boolean;
}

/**
 * Where an integration is written. `project` (committed to the repo, shared by
 * the team) is the default and strongly preferred. `user` touches the developer's
 * global config and is only ever used when explicitly requested.
 */
export type Scope = "project" | "user";

/** Selector accepted by the CLI's `--agent` flag. */
export type AgentSelector = AgentId | "auto" | "all";

/**
 * How the KawnGraph MCP server should be launched. Honest about provenance: until
 * `@kawngraph/mcp` is published, integrations reference a locally resolved server,
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
  /** the config key/table this adapter owns within the file (e.g. `mcpServers.kawn`) */
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
  /** the keys/tables KawnGraph now owns in those files */
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
  /** KawnGraph's own integration is already present at the resolved scope */
  installed: boolean;
  /** the agent itself appears to be used here (its config dir/file exists) */
  present: boolean;
  /** evidence paths (relative) that triggered the detection */
  evidence: string[];
}

/** Adapter-specific options (e.g. the `local` provider). Most adapters ignore it. */
export interface AdapterOptions {
  /** local-LLM provider for the `local` adapter */
  provider?: "ollama" | "lmstudio";
  /** override the local-LLM base URL (default per provider) */
  baseUrl?: string;
  /** local-LLM model id (provider-specific; optional) */
  model?: string;
}

/** Everything an adapter needs to plan, install, verify, or remove an integration. */
export interface AdapterContext {
  /** absolute, normalized project root */
  root: string;
  scope: Scope;
  launch: McpLaunchSpec;
  logger: Logger;
  /** overwrite an existing non-KawnGraph entry of the same name when true */
  force: boolean;
  /** adapter-specific options (e.g. the `local` provider) */
  options?: AdapterOptions;
}

/** Authoritative config-format provenance, surfaced by `kawn agents`. */
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
  /** how this adapter delivers KawnGraph to its agent */
  readonly kind: AgentKind;
  /** what this adapter can produce (honest capability matrix) */
  readonly supports: AgentCapabilities;
  /**
   * Whether `kawn setup` (auto) may install this without being named explicitly.
   * MCP/context-file adapters are auto-selectable when their agent is detected;
   * `generic` and `local` are opt-in only (you ask for them by name).
   */
  readonly autoSelectable: boolean;
  readonly configFormat: ConfigFormatInfo;
  detect(root: string, scope: Scope): Promise<DetectResult>;
  plan(ctx: AdapterContext): Promise<InstallPlan>;
  install(ctx: AdapterContext): Promise<InstallResult>;
  verify(ctx: AdapterContext): Promise<VerifyResult>;
  uninstall(ctx: AdapterContext): Promise<UninstallResult>;
}

/** Convenience: a fully-false capability set to spread over. */
export const NO_CAPABILITIES: AgentCapabilities = {
  mcp: false,
  slashCommands: false,
  contextFiles: false,
  promptExport: false,
};

/** The MCP server name KawnGraph registers under, across every agent. */
export const KAWN_SERVER_NAME = "kawn";

/**
 * The pre-rebrand MCP server name. KawnGraph used to register under `athar`, so a
 * project set up before the rename still carries an `athar` entry/table. Setup and
 * connect migrate it to `${KAWN_SERVER_NAME}` (replace, never duplicate); disconnect
 * removes it too. We only ever touch an entry under THIS exact name — never a
 * differently-named server the user owns.
 */
export const LEGACY_SERVER_NAME = "athar";
