/** Shared app state + cross-view actions, exposed via React context. */
import { createContext, useContext } from "react";
import type { AtharEdge, AtharGraph, AtharNode, HealthResponse, SummaryResponse } from "./types";
import type { PrefsApi } from "./usePrefs";

export type TabId =
  | "graph"
  | "universe"
  | "flow"
  | "context"
  | "impact"
  | "docs"
  | "data"
  | "settings";

export type Selection =
  | { kind: "node"; node: AtharNode }
  | { kind: "edge"; edge: AtharEdge }
  | null;

export interface StudioActions {
  /** Select a node (by value or id) and reveal the details panel. */
  selectNode: (node: AtharNode | string) => void;
  selectEdge: (edge: AtharEdge) => void;
  clearSelection: () => void;
  /** Jump to the Graph tab focused on a node's neighborhood. */
  openInGraph: (nodeId: string) => void;
  /** Jump to the Impact tab seeded with a symbol/file. */
  showImpact: (symbol: string) => void;
  /** Jump to the Context tab seeded with a task. */
  buildContext: (task: string) => void;
  /** Jump to the Flow tab seeded with from/to. */
  showFlow: (from: string, to: string) => void;
  goTab: (tab: TabId) => void;
  openRightPanel: () => void;
}

export interface StudioValue {
  graph: AtharGraph;
  summary: SummaryResponse | null;
  health: HealthResponse;
  nodeById: Map<string, AtharNode>;
  selection: Selection;
  actions: StudioActions;
  prefs: PrefsApi;
  graphFocus: string | null;
  setGraphFocus: (id: string | null) => void;
  search: string;
  setSearch: (value: string) => void;
  contextSeed: string;
  impactSeed: string;
  flowSeed: { from: string; to: string };
}

export const StudioContext = createContext<StudioValue | null>(null);

export function useStudio(): StudioValue {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio must be used inside <StudioContext.Provider>");
  return value;
}
