/** Left sidebar: graph search, layer/type/edge filters, and saved view presets. */
import { useState, type ReactNode } from "react";
import { Bookmark, Eye, Filter, Save, Search, Trash2 } from "lucide-react";
import { useStudio } from "../studioContext";
import { humanize, layerColor, layerOrderIndex, nodeIcon } from "../graph/nodeStyle";
import type { GraphFilters, SavedView } from "../usePrefs";

function TypeGlyph({ type }: { type: string }): ReactNode {
  const Icon = nodeIcon(type);
  return <Icon size={13} className="faint" />;
}

export function Sidebar({ open }: { open: boolean }): ReactNode {
  const { graph, prefs, search, setSearch } = useStudio();
  const f = prefs.prefs.filters;
  const [viewName, setViewName] = useState("");

  const patch = (next: Partial<GraphFilters>): void => prefs.setFilters({ ...f, ...next });
  const toggle = (list: string[], key: string): string[] =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

  const layers = Object.entries(graph.stats.byLayer).sort(
    (a, b) => layerOrderIndex(a[0]) - layerOrderIndex(b[0]),
  );
  const types = Object.entries(graph.stats.byType).sort((a, b) => b[1] - a[1]);
  const edges = Object.entries(graph.stats.byEdgeType).sort((a, b) => b[1] - a[1]);

  const filtersActive =
    f.hiddenLayers.length > 0 ||
    f.hiddenNodeTypes.length > 0 ||
    f.hiddenEdgeTypes.length > 0 ||
    f.hideIsolated;

  const resetFilters = (): void =>
    patch({ hiddenLayers: [], hiddenNodeTypes: [], hiddenEdgeTypes: [], hideIsolated: false });

  const renderRows = (
    entries: [string, number][],
    hidden: string[],
    onToggle: (key: string) => void,
    opts?: { swatch?: (k: string) => string; icon?: boolean },
  ): ReactNode =>
    entries.map(([key, count]) => (
      <label key={key} className="filter-row">
        <input type="checkbox" checked={!hidden.includes(key)} onChange={() => onToggle(key)} />
        {opts?.swatch && <span className="swatch" style={{ background: opts.swatch(key) }} />}
        {opts?.icon && <TypeGlyph type={key} />}
        <span className="nowrap" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {humanize(key)}
        </span>
        <span className="count">{count}</span>
      </label>
    ));

  const saveCurrent = (): void => {
    const name = viewName.trim();
    if (!name) return;
    const view: SavedView = {
      id: `${Date.now()}`,
      name,
      search,
      filters: {
        ...f,
        hiddenLayers: [...f.hiddenLayers],
        hiddenNodeTypes: [...f.hiddenNodeTypes],
        hiddenEdgeTypes: [...f.hiddenEdgeTypes],
      },
    };
    prefs.saveView(view);
    setViewName("");
  };

  const applyView = (v: SavedView): void => {
    setSearch(v.search);
    prefs.setFilters(v.filters);
  };

  return (
    <nav className={`sidebar ${open ? "" : "closed"}`} aria-label="Filters and views">
      <div className="side-section">
        <div className="search">
          <Search size={14} className="faint" />
          <input
            placeholder="Search graph…"
            value={search}
            dir="auto"
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search the graph"
          />
        </div>
      </div>

      <div className="side-section">
        <div className="side-title">
          <span className="row" style={{ gap: 6 }}>
            <Filter size={12} /> Layers
          </span>
          {filtersActive && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
              Reset
            </button>
          )}
        </div>
        {renderRows(
          layers,
          f.hiddenLayers,
          (k) => patch({ hiddenLayers: toggle(f.hiddenLayers, k) }),
          { swatch: layerColor },
        )}
      </div>

      <div className="side-section">
        <div className="side-title">Node types</div>
        {renderRows(
          types,
          f.hiddenNodeTypes,
          (k) => patch({ hiddenNodeTypes: toggle(f.hiddenNodeTypes, k) }),
          { icon: true },
        )}
      </div>

      <div className="side-section">
        <div className="side-title">Edge types</div>
        {renderRows(edges, f.hiddenEdgeTypes, (k) =>
          patch({ hiddenEdgeTypes: toggle(f.hiddenEdgeTypes, k) }),
        )}
      </div>

      <div className="side-section">
        <label className="filter-row">
          <input
            type="checkbox"
            checked={f.hideIsolated}
            onChange={() => patch({ hideIsolated: !f.hideIsolated })}
          />
          <Eye size={13} className="faint" />
          <span>Hide isolated nodes</span>
        </label>
      </div>

      <div className="side-section">
        <div className="side-title">
          <span className="row" style={{ gap: 6 }}>
            <Bookmark size={12} /> Saved views
          </span>
        </div>
        <form
          className="row"
          style={{ gap: 6, marginBottom: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            saveCurrent();
          }}
        >
          <input
            className="input"
            style={{ height: 28 }}
            placeholder="Name this view"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            aria-label="Saved view name"
          />
          <button
            type="submit"
            className="btn btn-sm"
            data-tip="Save current search + filters"
            disabled={!viewName.trim()}
          >
            <Save size={13} />
          </button>
        </form>
        {prefs.prefs.savedViews.length === 0 ? (
          <span className="faint" style={{ fontSize: "var(--fs-xs)" }}>
            Save the current search and filters as a named preset.
          </span>
        ) : (
          <div className="col" style={{ gap: 2 }}>
            {prefs.prefs.savedViews.map((v) => (
              <div key={v.id} className="saved-view">
                <button
                  type="button"
                  className="row grow"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    minWidth: 0,
                    textAlign: "left",
                  }}
                  onClick={() => applyView(v)}
                  title={`Apply “${v.name}”`}
                >
                  <Bookmark size={12} className="faint" />
                  <span
                    className="grow nowrap"
                    style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {v.name}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 24, height: 24 }}
                  data-tip="Delete view"
                  onClick={() => prefs.deleteView(v.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
