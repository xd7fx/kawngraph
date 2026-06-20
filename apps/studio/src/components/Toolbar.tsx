/** Top toolbar: project identity, graph status, counts, last scan, theme. */
import { type ReactNode } from "react";
import { Moon, PanelLeft, PanelRight, Sun } from "lucide-react";
import { useStudio } from "../studioContext";
import { formatInt } from "../lib/format";

function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function Toolbar({
  onToggleLeft,
  onToggleRight,
}: {
  onToggleLeft: () => void;
  onToggleRight: () => void;
}): ReactNode {
  const { graph, health, prefs } = useStudio();
  const theme = prefs.prefs.theme;

  return (
    <header className="toolbar">
      <button type="button" className="icon-btn only-mobile" data-tip="Filters" onClick={onToggleLeft}>
        <PanelLeft size={16} />
      </button>

      <div className="brand">
        <span className="dot">أ</span>
        <span className="nowrap">Athar Studio</span>
      </div>

      <div className="toolbar-stats">
        <div className="stat" title={health.root}>
          <span className="k">Project</span>
          <span className="v">{basename(health.root)}</span>
        </div>
        <div className="stat">
          <span className="k">Status</span>
          <span className="v row" style={{ gap: 6 }}>
            <span className={`status-dot ${health.status}`} />
            {health.status}
          </span>
        </div>
        <div className="stat">
          <span className="k">Nodes</span>
          <span className="v">{formatInt(graph.stats.nodes)}</span>
        </div>
        <div className="stat">
          <span className="k">Edges</span>
          <span className="v">{formatInt(graph.stats.edges)}</span>
        </div>
        <div className="stat">
          <span className="k">Scanned</span>
          <span className="v" title={graph.generatedAt}>
            {relativeTime(graph.generatedAt)}
          </span>
        </div>
      </div>

      <div className="toolbar-actions">
        <button
          type="button"
          className="icon-btn"
          data-tip={theme === "light" ? "Dark theme" : "Light theme"}
          onClick={() => prefs.setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button type="button" className="icon-btn only-narrow" data-tip="Details" onClick={onToggleRight}>
          <PanelRight size={16} />
        </button>
      </div>
    </header>
  );
}
