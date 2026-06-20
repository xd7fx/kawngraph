import type { AgentKind } from "../types";
import type { AgentAdapter } from "./types";
import { claudeAdapter } from "./claude";
import { codexAdapter } from "./codex";

export type { AgentAdapter, AdapterResult, RunInput } from "./types";
export { claudeAdapter, parseClaudeLines } from "./claude";
export { codexAdapter, parseCodexLines } from "./codex";

const ADAPTERS: Record<AgentKind, AgentAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
};

export function getAdapter(agent: AgentKind): AgentAdapter {
  return ADAPTERS[agent];
}
