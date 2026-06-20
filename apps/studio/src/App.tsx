/**
 * Athar Studio root: loads the read-only graph over the local API, owns shared
 * state (tab, selection, cross-view seeds, drawers, theme), exposes the studio
 * actions via context, and renders the toolbar / sidebar / view / inspector.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  Database,
  Layers,
  Network,
  Package2,
  RefreshCw,
  Settings,
  Spline,
  TriangleAlert,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import { api, ApiRequestError } from "./api";
import { usePrefs } from "./usePrefs";
import {
  StudioContext,
  type Selection,
  type StudioActions,
  type StudioValue,
  type TabId,
} from "./studioContext";
import type { AtharGraph, AtharNode, HealthResponse, SummaryResponse } from "./types";
import { Toolbar } from "./components/Toolbar";
import { Sidebar } from "./components/Sidebar";
import { RightPanel } from "./components/RightPanel";
import { Spinner } from "./components/ui";
import { GraphView } from "./views/GraphView";
import { ContextView } from "./views/ContextView";
import { ImpactView } from "./views/ImpactView";
import { FlowView } from "./views/FlowView";
import { DocsView } from "./views/DocsView";
import { DataView } from "./views/DataView";
import { SettingsView } from "./views/SettingsView";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "graph", label: "Graph", icon: Network },
  { id: "context", label: "Context", icon: Package2 },
  { id: "impact", label: "Impact", icon: Layers },
  { id: "flow", label: "Flow", icon: Spline },
  { id: "docs", label: "Docs", icon: BookOpen },
  { id: "data", label: "Data", icon: Database },
  { id: "settings", label: "Settings", icon: Settings },
];

type Phase = "loading" | "ready" | "missing" | "error";

/** Minimal chrome for the pre-ready states (loading / unreachable / no graph). */
function Shell({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="dot">أ</span>
          <span className="nowrap">Athar Studio</span>
        </div>
      </header>
      <div className="main" style={{ display: "grid", placeItems: "center", padding: 24 }}>
        {children}
      </div>
    </div>
  );
}

export function App(): ReactNode {
  const prefs = usePrefs();

  const [phase, setPhase] = useState<Phase>("loading");
  const [graph, setGraph] = useState<AtharGraph | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loadError, setLoadError] = useState("");

  const [tab, setTab] = useState<TabId>("graph");
  const [selection, setSelection] = useState<Selection>(null);
  const [graphFocus, setGraphFocus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [contextSeed, setContextSeed] = useState("");
  const [impactSeed, setImpactSeed] = useState("");
  const [flowSeed, setFlowSeed] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  // Apply the persisted theme to the document root for the CSS variables.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", prefs.prefs.theme);
  }, [prefs.prefs.theme]);

  const load = useCallback(async () => {
    setPhase("loading");
    setLoadError("");
    try {
      const h = await api.health();
      setHealth(h);
      if (!h.ok || h.status !== "ok") {
        setPhase("missing");
        return;
      }
      const g = await api.graph();
      setGraph(g);
      try {
        setSummary(await api.summary());
      } catch {
        setSummary(null); // summary is a non-critical enrichment
      }
      setPhase("ready");
    } catch (err) {
      setLoadError(
        err instanceof ApiRequestError
          ? err.message
          : "Could not reach the Athar Studio server. Is it still running?",
      );
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nodeById = useMemo(() => {
    const m = new Map<string, AtharNode>();
    if (graph) for (const n of graph.nodes) m.set(n.id, n);
    return m;
  }, [graph]);

  const actions: StudioActions = useMemo(
    () => ({
      selectNode: (n) => {
        const node = typeof n === "string" ? nodeById.get(n) : n;
        if (!node) return;
        setSelection({ kind: "node", node });
        setRightOpen(true);
      },
      selectEdge: (edge) => {
        setSelection({ kind: "edge", edge });
        setRightOpen(true);
      },
      clearSelection: () => setSelection(null),
      openInGraph: (nodeId) => {
        const node = nodeById.get(nodeId);
        setGraphFocus(nodeId);
        if (node) setSelection({ kind: "node", node });
        setTab("graph");
        setLeftOpen(false);
      },
      showImpact: (symbol) => {
        setImpactSeed(symbol);
        setTab("impact");
        setLeftOpen(false);
      },
      buildContext: (task) => {
        setContextSeed(task);
        setTab("context");
        setLeftOpen(false);
      },
      showFlow: (from, to) => {
        setFlowSeed({ from, to });
        setTab("flow");
        setLeftOpen(false);
      },
      goTab: (t) => {
        setTab(t);
        setLeftOpen(false);
      },
      openRightPanel: () => setRightOpen(true),
    }),
    [nodeById],
  );

  if (phase === "loading") {
    return (
      <Shell>
        <div className="col" style={{ alignItems: "center", gap: 10 }}>
          <Spinner />
          <span className="muted">Loading graph…</span>
        </div>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell>
        <div className="banner error" style={{ maxWidth: 480 }}>
          <Unplug size={18} className="banner-icon" />
          <div>
            <h3>Can't reach the Studio server</h3>
            <p>{loadError}</p>
            <button type="button" className="btn" onClick={() => void load()}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "missing" || !graph || !health) {
    const malformed = health?.status === "malformed";
    return (
      <Shell>
        <div className="banner warn" style={{ maxWidth: 540 }}>
          <TriangleAlert size={18} className="banner-icon" />
          <div>
            <h3>{malformed ? "Graph could not be read" : "No graph found"}</h3>
            <p>
              {malformed
                ? `The graph file exists but could not be parsed${
                    health?.error ? `: ${health.error}` : "."
                  }`
                : "Athar Studio displays a graph that has already been generated. None was found at:"}
            </p>
            {health?.path && (
              <p>
                <code className="mono wrap-anywhere">{health.path}</code>
              </p>
            )}
            <p>Generate or refresh it from a terminal, then retry:</p>
            <p>
              <code>athar scan {health?.root ?? "."}</code>
            </p>
            <button type="button" className="btn" onClick={() => void load()}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const value: StudioValue = {
    graph,
    summary,
    health,
    nodeById,
    selection,
    actions,
    prefs,
    graphFocus,
    setGraphFocus,
    search,
    setSearch,
    contextSeed,
    impactSeed,
    flowSeed,
  };

  const drawerOpen = leftOpen || rightOpen;

  return (
    <StudioContext.Provider value={value}>
      <div className="app">
        <Toolbar
          onToggleLeft={() => setLeftOpen((v) => !v)}
          onToggleRight={() => setRightOpen((v) => !v)}
        />
        <div className="body">
          <Sidebar open={leftOpen} />
          <main className="main">
            <nav className="tabs" aria-label="Views">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`tab ${tab === t.id ? "active" : ""}`}
                    aria-current={tab === t.id}
                    onClick={() => setTab(t.id)}
                  >
                    <Icon size={14} /> {t.label}
                  </button>
                );
              })}
            </nav>
            <div className={`main-content ${tab === "graph" ? "no-pad" : ""}`}>
              {tab === "graph" && <GraphView />}
              {tab === "context" && <ContextView />}
              {tab === "impact" && <ImpactView />}
              {tab === "flow" && <FlowView />}
              {tab === "docs" && <DocsView />}
              {tab === "data" && <DataView />}
              {tab === "settings" && <SettingsView />}
            </div>
          </main>
          <RightPanel open={rightOpen} onClose={() => setRightOpen(false)} />
          {drawerOpen && (
            <div
              className="scrim show"
              aria-hidden
              onClick={() => {
                setLeftOpen(false);
                setRightOpen(false);
              }}
            />
          )}
        </div>
      </div>
    </StudioContext.Provider>
  );
}
