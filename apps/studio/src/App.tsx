/**
 * KawnGraph Universe root: loads the read-only graph over the local API, owns shared
 * state (tab, selection, cross-view seeds, drawers, theme, locale), exposes the
 * studio actions via context, and renders the toolbar / sidebar / view / inspector.
 */
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BookOpen,
  Database,
  Layers,
  Network,
  Orbit,
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
import type { KawnGraph, KawnNode, HealthResponse, SummaryResponse } from "./types";
import { dirFor, makeT, type MessageKey } from "./i18n";
import { I18nProvider, useT } from "./i18nReact";
import { Toolbar } from "./components/Toolbar";
import { Mark } from "./components/Mark";
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

// The Universe view pulls in Three.js (~hundreds of KB), so it's code-split and
// only fetched when the user actually opens the tab — the default Graph view
// stays lightweight.
const UniverseView = lazy(() =>
  import("./views/UniverseView").then((m) => ({ default: m.UniverseView })),
);

const TABS: { id: TabId; labelKey: MessageKey; icon: LucideIcon }[] = [
  { id: "graph", labelKey: "nav.graph", icon: Network },
  { id: "universe", labelKey: "nav.universe", icon: Orbit },
  { id: "context", labelKey: "nav.context", icon: Package2 },
  { id: "impact", labelKey: "nav.impact", icon: Layers },
  { id: "flow", labelKey: "nav.flow", icon: Spline },
  { id: "docs", labelKey: "nav.docs", icon: BookOpen },
  { id: "data", labelKey: "nav.data", icon: Database },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
];

type Phase = "loading" | "ready" | "missing" | "error";

/** Minimal chrome for the pre-ready states (loading / unreachable / no graph). */
function Shell({ children }: { children: ReactNode }): ReactNode {
  const t = useT();
  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <Mark className="brand-mark" />
          <span className="nowrap">{t("brand.name")}</span>
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
  const locale = prefs.prefs.locale;
  // App sits ABOVE its own <I18nProvider>, so it can't read the locale via the
  // hook — it derives the translator directly from the known locale instead.
  const t = makeT(locale);

  const [phase, setPhase] = useState<Phase>("loading");
  const [graph, setGraph] = useState<KawnGraph | null>(null);
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

  // Apply language + writing direction so RTL locales mirror the whole layout
  // and assistive tech announces the right language.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", locale);
    root.setAttribute("dir", dirFor(locale));
  }, [locale]);

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
      // Keep server-sent (English, technical) messages verbatim; fall back to a
      // localized generic message when the failure isn't an API error.
      setLoadError(err instanceof ApiRequestError ? err.message : "");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nodeById = useMemo(() => {
    const m = new Map<string, KawnNode>();
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
      goTab: (next) => {
        setTab(next);
        setLeftOpen(false);
      },
      openRightPanel: () => setRightOpen(true),
    }),
    [nodeById],
  );

  let content: ReactNode;

  if (phase === "loading") {
    content = (
      <Shell>
        <div className="col" style={{ alignItems: "center", gap: 10 }}>
          <Spinner />
          <span className="muted">{t("state.loadingGraph")}</span>
        </div>
      </Shell>
    );
  } else if (phase === "error") {
    content = (
      <Shell>
        <div className="banner error" style={{ maxWidth: 480 }}>
          <Unplug size={18} className="banner-icon" />
          <div>
            <h3>{t("state.cantReachTitle")}</h3>
            <p>{loadError || t("state.unreachableFallback")}</p>
            <button type="button" className="btn" onClick={() => void load()}>
              <RefreshCw size={14} /> {t("state.retry")}
            </button>
          </div>
        </div>
      </Shell>
    );
  } else if (phase === "missing" || !graph || !health) {
    const malformed = health?.status === "malformed";
    content = (
      <Shell>
        <div className="banner warn" style={{ maxWidth: 540 }}>
          <TriangleAlert size={18} className="banner-icon" />
          <div>
            <h3>{malformed ? t("state.graphUnreadable") : t("state.noGraph")}</h3>
            <p>{malformed ? t("state.malformedBody") : t("state.noGraphBody")}</p>
            {malformed && health?.error && (
              <p>
                <code className="mono wrap-anywhere">{health.error}</code>
              </p>
            )}
            {health?.path && (
              <p>
                <code className="mono wrap-anywhere">{health.path}</code>
              </p>
            )}
            <p>{t("state.generateHint")}</p>
            <p>
              <code>kawn scan {health?.root ?? "."}</code>
            </p>
            <button type="button" className="btn" onClick={() => void load()}>
              <RefreshCw size={14} /> {t("state.retry")}
            </button>
          </div>
        </div>
      </Shell>
    );
  } else {
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

    content = (
      <StudioContext.Provider value={value}>
        <div className="app">
          <Toolbar
            onToggleLeft={() => setLeftOpen((v) => !v)}
            onToggleRight={() => setRightOpen((v) => !v)}
          />
          <div className="body">
            <Sidebar open={leftOpen} />
            <main className="main">
              <nav className="tabs" aria-label={t("nav.views")}>
                {TABS.map((tb) => {
                  const Icon = tb.icon;
                  return (
                    <button
                      key={tb.id}
                      type="button"
                      className={`tab ${tab === tb.id ? "active" : ""}`}
                      aria-current={tab === tb.id}
                      onClick={() => setTab(tb.id)}
                    >
                      <Icon size={14} /> {t(tb.labelKey)}
                    </button>
                  );
                })}
              </nav>
              <div
                className={`main-content ${tab === "graph" || tab === "universe" ? "no-pad" : ""}`}
              >
                {tab === "graph" && <GraphView />}
                {tab === "universe" && (
                  <Suspense
                    fallback={
                      <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
                        <Spinner />
                      </div>
                    }
                  >
                    <UniverseView />
                  </Suspense>
                )}
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

  return <I18nProvider locale={locale}>{content}</I18nProvider>;
}
