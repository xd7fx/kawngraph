import { claudeAdapter } from "./adapters/claude";
import { codexAdapter } from "./adapters/codex";
import { cursorAdapter } from "./adapters/cursor";
import { copilotAdapter } from "./adapters/copilot";
import { geminiAdapter } from "./adapters/gemini";
import { aiderAdapter } from "./adapters/aider";
import { genericAdapter } from "./adapters/generic";
import { localAdapter } from "./adapters/local";
import type { AgentAdapter, AgentId } from "./types";

/**
 * Every agent KawnGraph can integrate with — ONE core graph, an adapter per tool.
 * Order is the display/iteration order: MCP-native tools first, then the
 * context-file / export / local-LLM adapters. `generic` and `local` are opt-in
 * (not auto-selected); see `autoSelectable`.
 */
export const ADAPTERS: readonly AgentAdapter[] = [
  claudeAdapter,
  codexAdapter,
  cursorAdapter,
  copilotAdapter,
  geminiAdapter,
  aiderAdapter,
  genericAdapter,
  localAdapter,
];

export const ALL_AGENT_IDS: AgentId[] = ADAPTERS.map((a) => a.id);

/** Agents `setup`/`setup all` may install without being named explicitly. */
export const AUTO_AGENT_IDS: AgentId[] = ADAPTERS.filter((a) => a.autoSelectable).map((a) => a.id);

export function getAdapter(id: AgentId): AgentAdapter {
  const found = ADAPTERS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown agent "${id}". Known agents: ${ALL_AGENT_IDS.join(", ")}.`);
  return found;
}

export function isAgentId(value: string): value is AgentId {
  return (ALL_AGENT_IDS as string[]).includes(value);
}
