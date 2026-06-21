/** Settings tab: theme, language, graph render limit, project info, local-data controls. */
import { useState, type ReactNode } from "react";
import { Eraser, Info, Languages, Lock, Moon, ShieldCheck, Sun } from "lucide-react";
import { useStudio } from "../studioContext";
import { useT } from "../i18nReact";
import { LOCALE_LABELS, LOCALES } from "../i18n";
import { formatInt } from "../lib/format";

export function SettingsView(): ReactNode {
  const { prefs, graph, summary, health } = useStudio();
  const t = useT();
  const [cleared, setCleared] = useState(false);
  const filters = prefs.prefs.filters;

  return (
    <div className="section-stack">
      <section className="card">
        <div className="card-title">
          <Sun size={13} /> {t("settings.appearance")}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className={`btn ${prefs.prefs.theme === "light" ? "btn-primary" : ""}`}
            onClick={() => prefs.setTheme("light")}
          >
            <Sun size={14} /> {t("settings.light")}
          </button>
          <button
            type="button"
            className={`btn ${prefs.prefs.theme === "dark" ? "btn-primary" : ""}`}
            onClick={() => prefs.setTheme("dark")}
          >
            <Moon size={14} /> {t("settings.dark")}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <Languages size={13} /> {t("settings.language")}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {LOCALES.map((loc) => (
            <button
              key={loc}
              type="button"
              lang={loc}
              className={`btn ${prefs.prefs.locale === loc ? "btn-primary" : ""}`}
              onClick={() => prefs.setLocale(loc)}
            >
              {LOCALE_LABELS[loc]}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-title">{t("settings.graphRendering")}</div>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="set-limit">
            {t("settings.renderLimit", { n: formatInt(filters.renderLimit) })}
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
            {t("settings.renderLimitHint")}
          </span>
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <Info size={13} /> {t("settings.project")}
        </div>
        <dl className="kv" style={{ gridTemplateColumns: "140px 1fr" }}>
          <dt>{t("settings.root")}</dt>
          <dd className="mono wrap-anywhere">{health.root}</dd>
          <dt>{t("settings.graphFile")}</dt>
          <dd className="mono wrap-anywhere">{health.path}</dd>
          <dt>{t("settings.version")}</dt>
          <dd>{graph.kawnVersion}</dd>
          <dt>{t("settings.generated")}</dt>
          <dd>{graph.generatedAt}</dd>
          <dt>{t("settings.nodesEdges")}</dt>
          <dd>
            {formatInt(graph.stats.nodes)} / {formatInt(graph.stats.edges)}
          </dd>
          {summary && (
            <>
              <dt>{t("settings.layers")}</dt>
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
            <ShieldCheck size={12} /> {t("settings.readOnly")}
          </span>
          <span className="badge">
            <Lock size={12} /> {t("settings.localOnly")}
          </span>
        </div>
        <p className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 8 }}>
          {t("settings.neverWrites")}
        </p>
        <p style={{ marginTop: 6 }}>
          <code className="mono">kawn scan {health.root}</code>
        </p>
      </section>

      <section className="card">
        <div className="card-title">
          <Eraser size={13} /> {t("settings.localPrefs")}
        </div>
        <p className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 0 }}>
          {t("settings.localPrefsBody", {
            recent: prefs.prefs.recentTasks.length,
            views: prefs.prefs.savedViews.length,
          })}
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
          <Eraser size={14} /> {cleared ? t("settings.cleared") : t("settings.clearPrefs")}
        </button>
      </section>
    </div>
  );
}
