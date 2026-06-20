import { ADAPTERS } from "./registry";
import type { AgentId, AgentSelector, DetectResult, Scope } from "./types";

/** Run every adapter's detector against a project root. */
export async function detectAgents(root: string, scope: Scope = "project"): Promise<DetectResult[]> {
  return Promise.all(ADAPTERS.map((a) => a.detect(root, scope)));
}

export interface Selection {
  agents: AgentId[];
  /** explanation when the selection is empty or surprising */
  note?: string;
}

/**
 * Turn a `--agent` selector plus detection results into the concrete list of
 * agents to act on. `auto` targets agents actually used in this project; if none
 * are detected it returns an empty list with a note rather than guessing.
 */
export function resolveSelection(selector: AgentSelector, detected: DetectResult[]): Selection {
  if (selector === "all") return { agents: detected.map((d) => d.agent) };
  if (selector === "auto") {
    const present = detected.filter((d) => d.present || d.installed).map((d) => d.agent);
    if (present.length > 0) return { agents: present };
    return {
      agents: [],
      note: "No supported agent detected here. Pass --agent claude|codex|cursor|all to choose explicitly.",
    };
  }
  return { agents: [selector] };
}
