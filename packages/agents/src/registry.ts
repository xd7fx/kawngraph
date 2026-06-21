import { claudeAdapter } from "./adapters/claude";
import { codexAdapter } from "./adapters/codex";
import { cursorAdapter } from "./adapters/cursor";
import type { AgentAdapter, AgentId } from "./types";

/** Every agent KawnGraph can integrate with. Order is the display/iteration order. */
export const ADAPTERS: readonly AgentAdapter[] = [claudeAdapter, codexAdapter, cursorAdapter];

export const ALL_AGENT_IDS: AgentId[] = ADAPTERS.map((a) => a.id);

export function getAdapter(id: AgentId): AgentAdapter {
  const found = ADAPTERS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown agent "${id}". Known agents: ${ALL_AGENT_IDS.join(", ")}.`);
  return found;
}

export function isAgentId(value: string): value is AgentId {
  return (ALL_AGENT_IDS as string[]).includes(value);
}
