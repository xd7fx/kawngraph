/** Settings tab: theme, graph render limit, project info, local-data controls. */
import { useState, type ReactNode } from "react";
import { Eraser, Info, Lock, Moon, ShieldCheck, Sun } from "lucide-react";
import { useStudio } from "../studioContext";
import { formatInt } from "../lib/format";

export function SettingsView(): ReactNode {
  const { prefs, graph, summary, health } = useStudio();
  const [cleared, setCleared] = useState(false);
  const filters = prefs.prefs.filters;

  return (
    <div className="section-stack">
      <section className="card">
        <div className="card-title">
          <Sun size={13} /> Appearance
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className={`btn ${prefs.prefs.theme === "light" ? "btn-primary" : ""}`}
            onClick={() => prefs.setTheme("light")}
          >
            <Sun size={14} /> Light
          </button>
          <button
            type="button"
            className={`btn ${prefs.prefs.theme === "dark" ? "btn-primary" : ""}`}
            onClick={() => prefs.setTheme("dark")}
          >
            <Moon size={14} /> Dark
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-title">Graph rendering</div>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="set-limit">
            Initial node render limit — {formatInt(filters.renderLimit)}
          </label>
          <input
            id="set-limit"
            type="range"
            min={50}
            max={1000}
            step={50}
            value={filters.renderLimit}
            onChange={(e) => prefs.setFilters({ ...filters, renderLimit: Number(e.target.value) })}
          />
          <span className="faint" style={{ fontSize: "var(--fs-xs)" }}>
            Large graphs render up to this many nodes before showing a "show more" guard, keeping the
            canvas responsive.
          </span>
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <Info size={13} /> Project
        </div>
        <dl className="kv" style={{ gridTemplateColumns: "140px 1fr" }}>
          <dt>Root</dt>
          <dd className="mono wrap-anywhere">{health.root}</dd>
          <dt>Graph file</dt>
          <dd className="mono wrap-anywhere">{health.path}</dd>
          <dt>Athar version</dt>
          <dd>{graph.atharVersion}</dd>
          <dt>Generated</dt>
          <dd>{graph.generatedAt}</dd>
          <dt>Nodes / edges</dt>
          <dd>
            {formatInt(graph.stats.nodes)} / {formatInt(graph.stats.edges)}
          </dd>
          {summary && (
            <>
              <dt>Layers</dt>
              <dd>
                {Object.entries(summary.stats.byLayer)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(" · ")}
              </dd>
            </>
          )}
        </dl>
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <span className="badge">
            <ShieldCheck size={12} /> read-only
          </span>
          <span className="badge">
            <Lock size={12} /> local only
          </span>
        </div>
        <p className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 8 }}>
          Studio never writes to your repository and never rebuilds the graph. To refresh it, run{" "}
          <code className="mono">athar scan {health.root}</code> in a terminal, then reload.
        </p>
      </section>

      <section className="card">
        <div className="card-title">
          <Eraser size={13} /> Local preferences
        </div>
        <p className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 0 }}>
          Only display preferences are stored in this browser: theme, panel sizes, graph filters,
          recent task strings ({prefs.prefs.recentTasks.length}), and saved views (
          {prefs.prefs.savedViews.length}). No graph contents, code, or repository data is ever
          persisted.
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            prefs.clearAll();
            setCleared(true);
            window.setTimeout(() => setCleared(false), 1500);
          }}
        >
          <Eraser size={14} /> {cleared ? "Cleared" : "Clear local preferences"}
        </button>
      </section>
    </div>
  );
}
