/** Top toolbar: project identity, graph status, counts, last scan, theme, language. */
import { type ReactNode } from "react";
import { Globe, Moon, PanelLeft, PanelRight, Sun } from "lucide-react";
import { useStudio } from "../studioContext";
import { useT } from "../i18nReact";
import { LOCALE_LABELS, type TFn } from "../i18n";
import { formatInt } from "../lib/format";
import { Mark } from "./Mark";

function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

function relativeTime(iso: string | undefined, t: TFn): string {
  if (!iso) return t("time.dash");
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return t("time.dash");
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return t("time.justNow");
  const mins = Math.round(secs / 60);
  if (mins < 60) return t("time.minutesAgo", { n: mins });
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return t("time.hoursAgo", { n: hrs });
  const days = Math.round(hrs / 24);
  return t("time.daysAgo", { n: days });
}

export function Toolbar({
  onToggleLeft,
  onToggleRight,
}: {
  onToggleLeft: () => void;
  onToggleRight: () => void;
}): ReactNode {
  const { graph, health, prefs } = useStudio();
  const t = useT();
  const theme = prefs.prefs.theme;
  const locale = prefs.prefs.locale;
  const nextLocale = locale === "ar" ? "en" : "ar";

  return (
    <header className="toolbar">
      <button
        type="button"
        className="icon-btn only-mobile"
        data-tip={t("toolbar.filters")}
        aria-label={t("toolbar.filters")}
        onClick={onToggleLeft}
      >
        <PanelLeft size={16} />
      </button>

      <div className="brand">
        <Mark className="brand-mark" />
        <span className="nowrap">{t("brand.name")}</span>
      </div>

      <div className="toolbar-stats">
        <div className="stat" title={health.root}>
          <span className="k">{t("toolbar.project")}</span>
          <span className="v">{basename(health.root)}</span>
        </div>
        <div className="stat">
          <span className="k">{t("toolbar.status")}</span>
          <span className="v row" style={{ gap: 6 }}>
            <span className={`status-dot ${health.status}`} />
            {health.status}
          </span>
        </div>
        <div className="stat">
          <span className="k">{t("toolbar.nodes")}</span>
          <span className="v">{formatInt(graph.stats.nodes)}</span>
        </div>
        <div className="stat">
          <span className="k">{t("toolbar.edges")}</span>
          <span className="v">{formatInt(graph.stats.edges)}</span>
        </div>
        <div className="stat">
          <span className="k">{t("toolbar.scanned")}</span>
          <span className="v" title={graph.generatedAt}>
            {relativeTime(graph.generatedAt, t)}
          </span>
        </div>
      </div>

      <div className="toolbar-actions">
        <button
          type="button"
          className="icon-btn"
          data-tip={LOCALE_LABELS[nextLocale]}
          aria-label={`${t("toolbar.language")}: ${LOCALE_LABELS[nextLocale]}`}
          onClick={() => prefs.setLocale(nextLocale)}
        >
          <Globe size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          data-tip={theme === "light" ? t("toolbar.darkTheme") : t("toolbar.lightTheme")}
          aria-label={theme === "light" ? t("toolbar.darkTheme") : t("toolbar.lightTheme")}
          onClick={() => prefs.setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button
          type="button"
          className="icon-btn only-narrow"
          data-tip={t("toolbar.details")}
          aria-label={t("toolbar.details")}
          onClick={onToggleRight}
        >
          <PanelRight size={16} />
        </button>
      </div>
    </header>
  );
}
