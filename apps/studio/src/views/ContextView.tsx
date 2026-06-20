/** Context tab: build a token-budgeted Context Pack via the existing engine. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  Database,
  FileText,
  FlaskConical,
  PackageOpen,
  Route as RouteIcon,
  Sparkles,
} from "lucide-react";
import { api, ApiRequestError } from "../api";
import { useStudio } from "../studioContext";
import { confidencePct, contextPackToJson, contextPackToMarkdown, formatInt } from "../lib/format";
import { CopyButton, EntityRow, Empty, Meter, Spinner } from "../components/ui";
import type { ContextItem, ContextMode, ContextPack } from "../types";

function PackSection({
  title,
  icon: Icon,
  items,
  onSelect,
  layerOf,
}: {
  title: string;
  icon: typeof FileText;
  items: ContextItem[];
  onSelect: (id: string) => void;
  layerOf: (item: ContextItem) => string;
}): ReactNode {
  if (items.length === 0) return null;
  return (
    <section className="card">
      <div className="card-title">
        <Icon size={13} /> {title} ({items.length})
      </div>
      <div className="col" style={{ gap: 5 }}>
        {items.map((it) => (
          <EntityRow
            key={it.id}
            node={{ ...it, layer: layerOf(it) }}
            reason={it.reason}
            onClick={() => onSelect(it.id)}
            right={
              <span className="tag" title="estimated tokens" style={{ flexShrink: 0 }}>
                ~{formatInt(it.tokensEstimate)}
              </span>
            }
          />
        ))}
      </div>
    </section>
  );
}

export function ContextView(): ReactNode {
  const { contextSeed, actions, prefs, nodeById } = useStudio();
  const layerOf = (item: ContextItem): string => nodeById.get(item.id)?.layer ?? "code";
  const [task, setTask] = useState(contextSeed);
  const [budget, setBudget] = useState(8000);
  const [mode, setMode] = useState<ContextMode>("all");
  const [includeTests, setIncludeTests] = useState(true);
  const [includeData, setIncludeData] = useState(true);
  const [pack, setPack] = useState<ContextPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (taskText: string, budgetVal: number, modeVal: ContextMode) => {
      const trimmed = taskText.trim();
      if (!trimmed) {
        setError("Describe a task first.");
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      try {
        const result = await api.context({ task: trimmed, budget: budgetVal, mode: modeVal }, ctrl.signal);
        setPack(result);
        prefs.pushRecentTask(trimmed);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError(err instanceof ApiRequestError ? err.message : "Failed to build context pack.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [prefs],
  );

  // Seed + auto-run when navigated here from another view ("Build context").
  const lastSeed = useRef<string | null>(null);
  useEffect(() => {
    if (contextSeed && contextSeed !== lastSeed.current) {
      lastSeed.current = contextSeed;
      setTask(contextSeed);
      void run(contextSeed, budget, mode);
    }
  }, [contextSeed, run, budget, mode]);

  const tables = includeData ? (pack?.tables ?? []) : [];
  const tests = includeTests ? (pack?.tests ?? []) : [];

  const exportPack = (): ContextPack | null => {
    if (!pack) return null;
    return { ...pack, tables, tests };
  };

  return (
    <div className="section-stack">
      <section className="card">
        <form
          className="col"
          style={{ gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void run(task, budget, mode);
          }}
        >
          <div className="field">
            <label htmlFor="ctx-task">Task</label>
            <textarea
              id="ctx-task"
              className="textarea"
              placeholder='e.g. "fix the Zid OAuth callback token storage"'
              value={task}
              dir="auto"
              onChange={(e) => setTask(e.target.value)}
            />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ctx-budget">Token budget</label>
              <input
                id="ctx-budget"
                className="input"
                type="number"
                min={500}
                max={200000}
                step={500}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label htmlFor="ctx-mode">Mode</label>
              <select
                id="ctx-mode"
                className="select"
                value={mode}
                onChange={(e) => setMode(e.target.value as ContextMode)}
              >
                <option value="all">all — code + docs</option>
                <option value="code">code only</option>
                <option value="docs">docs only</option>
              </select>
            </div>
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 14 }}>
            <label className="checkbox">
              <input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} />
              Include tests
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={includeData} onChange={(e) => setIncludeData(e.target.checked)} />
              Include data tables
            </label>
            <div className="grow" />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <Spinner /> : <Sparkles size={14} />} Generate
            </button>
          </div>

          {prefs.prefs.recentTasks.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              <span className="faint" style={{ fontSize: "var(--fs-xs)" }}>
                Recent:
              </span>
              {prefs.prefs.recentTasks.slice(0, 5).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="tag"
                  style={{ cursor: "pointer", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  onClick={() => {
                    setTask(t);
                    void run(t, budget, mode);
                  }}
                  title={t}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </form>
      </section>

      {error && (
        <div className="banner error">
          <AlertTriangle size={18} className="banner-icon" />
          <div>
            <h3>Couldn't build the pack</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!pack && !error && !loading && (
        <Empty
          icon={PackageOpen}
          title="No context pack yet"
          hint="Describe a task and generate a token-budgeted slice of the graph."
        />
      )}

      {pack && (
        <>
          <section className="card">
            <div className="row spread" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="badge">mode: {pack.mode}</span>
                <span className="badge">budget: {formatInt(pack.budget)} tok</span>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <CopyButton getText={() => contextPackToMarkdown(exportPack() ?? pack)} label="Copy Markdown" />
                <CopyButton getText={() => contextPackToJson(exportPack() ?? pack)} label="Copy JSON" />
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Confidence</label>
                <div className="row" style={{ gap: 8 }}>
                  <Meter
                    value={confidencePct(pack.confidence)}
                    max={100}
                    tone={pack.confidence >= 0.66 ? "ok" : pack.confidence >= 0.33 ? undefined : "warn"}
                  />
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>{confidencePct(pack.confidence)}%</strong>
                </div>
              </div>
              <div className="field">
                <label>Token usage</label>
                <div className="row" style={{ gap: 8 }}>
                  <Meter value={pack.tokensUsed} max={pack.budget} tone={pack.tokensUsed > pack.budget ? "warn" : undefined} />
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatInt(pack.tokensUsed)}/{formatInt(pack.budget)}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <PackSection title="Must read" icon={Boxes} items={pack.mustRead} onSelect={actions.selectNode} layerOf={layerOf} />
          <PackSection title="Related docs" icon={FileText} items={pack.relatedDocs} onSelect={actions.selectNode} layerOf={layerOf} />
          {includeData && <PackSection title="Data / tables" icon={Database} items={pack.tables} onSelect={actions.selectNode} layerOf={layerOf} />}
          {includeTests && <PackSection title="Tests" icon={FlaskConical} items={pack.tests} onSelect={actions.selectNode} layerOf={layerOf} />}

          {pack.risks.length > 0 && (
            <section className="card">
              <div className="card-title">
                <AlertTriangle size={13} /> Risks ({pack.risks.length})
              </div>
              <div className="col" style={{ gap: 6 }}>
                {pack.risks.map((r, i) => (
                  <div key={i} className={`risk ${r.level}`}>
                    <div className="row spread">
                      <strong>{r.kind}</strong>
                      <span className="tag">{r.level}</span>
                    </div>
                    <div className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 2 }}>
                      {r.message}
                    </div>
                    {r.nodeId && (
                      <button type="button" className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => actions.selectNode(r.nodeId!)}>
                        <RouteIcon size={12} /> Inspect node
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {pack.excluded.length > 0 && (
            <section className="card card-sunken">
              <div className="card-title">Excluded (over budget) — {pack.excluded.length}</div>
              <div className="col" style={{ gap: 4 }}>
                {pack.excluded.map((e) => (
                  <div key={e.id} className="row spread" style={{ fontSize: "var(--fs-sm)" }}>
                    <span className="wrap-anywhere" dir="auto">{e.label}</span>
                    <span className="faint nowrap">{e.reason}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
