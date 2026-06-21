/**
 * The adapter contract. Every agent is driven through this interface and reduced
 * to a {@link NormalizedSession}, so the runner, metrics, and reports stay
 * agent-agnostic.
 */
import type { Logger } from "@kawngraph/shared";
import type { AgentKind, Condition, NormalizedSession } from "../types";

export interface RunInput {
  condition: Condition;
  /** convenience mirror of `condition === "with"` */
  withKawnGraph: boolean;
  /** the session working directory (a staged, isolated copy) */
  cwd: string;
  /** path to the MCP config: the KawnGraph stdio server (WITH) or empty (WITHOUT) */
  mcpConfigPath: string;
  /** the task prompt, verbatim */
  prompt: string;
  model: string | null;
  timeoutMs: number;
  /** e2e tasks allow file edits; retrieval tasks are read-only */
  allowEdits: boolean;
  logger?: Logger;
}

export interface AdapterResult {
  session: NormalizedSession;
  /** full agent stdout, ALREADY REDACTED — safe for the runner to persist verbatim */
  transcript: string;
}

export interface AgentAdapter {
  kind: AgentKind;
  /** is the agent CLI present on PATH? (auth is handled by preflight) */
  available(): boolean;
  run(input: RunInput): Promise<AdapterResult>;
}
