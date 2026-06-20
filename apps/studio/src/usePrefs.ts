/**
 * Local, harmless UI preferences persisted to localStorage.
 *
 * We persist ONLY display preferences — theme, panel sizes, graph filters,
 * recent task strings the user typed, and named saved views (filter presets).
 * We never persist graph contents, code snippets, secrets, or any repository
 * data. "Clear local preferences" (Settings view) wipes everything below.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "athar.studio.prefs.v1";

export type Theme = "light" | "dark";

export interface GraphFilters {
  hiddenLayers: string[];
  hiddenNodeTypes: string[];
  hiddenEdgeTypes: string[];
  hideIsolated: boolean;
  /** Max nodes rendered before a "large graph" guard kicks in. */
  renderLimit: number;
}

export interface SavedView {
  id: string;
  name: string;
  search: string;
  filters: GraphFilters;
}

export interface Prefs {
  theme: Theme;
  sidebarWidth: number;
  rightPanelWidth: number;
  recentTasks: string[];
  savedViews: SavedView[];
  filters: GraphFilters;
}

export const DEFAULT_FILTERS: GraphFilters = {
  hiddenLayers: [],
  hiddenNodeTypes: [],
  hiddenEdgeTypes: [],
  hideIsolated: false,
  renderLimit: 300,
};

export const DEFAULT_PREFS: Prefs = {
  theme: "light",
  sidebarWidth: 248,
  rightPanelWidth: 360,
  recentTasks: [],
  savedViews: [],
  filters: DEFAULT_FILTERS,
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      filters: { ...DEFAULT_FILTERS, ...(parsed.filters ?? {}) },
      recentTasks: Array.isArray(parsed.recentTasks) ? parsed.recentTasks.slice(0, 12) : [],
      savedViews: Array.isArray(parsed.savedViews) ? parsed.savedViews : [],
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export interface PrefsApi {
  prefs: Prefs;
  setTheme: (theme: Theme) => void;
  setFilters: (next: GraphFilters) => void;
  setPanelWidth: (which: "sidebar" | "right", px: number) => void;
  pushRecentTask: (task: string) => void;
  saveView: (view: SavedView) => void;
  deleteView: (id: string) => void;
  clearAll: () => void;
}

export function usePrefs(): PrefsApi {
  const [prefs, setPrefs] = useState<Prefs>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage may be unavailable (private mode); preferences are best-effort */
    }
  }, [prefs]);

  const setTheme = useCallback((theme: Theme) => setPrefs((p) => ({ ...p, theme })), []);

  const setFilters = useCallback(
    (next: GraphFilters) => setPrefs((p) => ({ ...p, filters: next })),
    [],
  );

  const setPanelWidth = useCallback(
    (which: "sidebar" | "right", px: number) =>
      setPrefs((p) => ({
        ...p,
        ...(which === "sidebar" ? { sidebarWidth: px } : { rightPanelWidth: px }),
      })),
    [],
  );

  const pushRecentTask = useCallback(
    (task: string) =>
      setPrefs((p) => {
        const trimmed = task.trim();
        if (!trimmed) return p;
        const recentTasks = [trimmed, ...p.recentTasks.filter((t) => t !== trimmed)].slice(0, 12);
        return { ...p, recentTasks };
      }),
    [],
  );

  const saveView = useCallback(
    (view: SavedView) =>
      setPrefs((p) => {
        const savedViews = [view, ...p.savedViews.filter((v) => v.id !== view.id)].slice(0, 24);
        return { ...p, savedViews };
      }),
    [],
  );

  const deleteView = useCallback(
    (id: string) => setPrefs((p) => ({ ...p, savedViews: p.savedViews.filter((v) => v.id !== id) })),
    [],
  );

  const clearAll = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setPrefs(DEFAULT_PREFS);
  }, []);

  return { prefs, setTheme, setFilters, setPanelWidth, pushRecentTask, saveView, deleteView, clearAll };
}
