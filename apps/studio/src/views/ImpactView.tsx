/** Impact tab: reverse dependency / blast-radius analysis via the affected engine. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, FileCode, FlaskConical, Layers, List, Network, Target } from "lucide-react";
import { api, ApiRequestError } from "../api";
import { useStudio } from "../studioContext";
import { humanize } from "../graph/nodeStyle";
import { GraphCanvas } from "../components/GraphCanvas";
import { EntityRow, Empty, Spinner } from "../components/ui";
import type { AffectedResponse } from "../types";

export function ImpactView(): ReactNode {
  const { graph, prefs, impactSeed, actions } = useStudio();
  const [symbol, setSymbol] = useState(impactSeed);
  const [depth, setDepth] = useState(6);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "graph">("list");
  const [result, setResult] = useState<AffectedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (sym: string, depthVal: number) => {
    const trimmed = sym.trim();
    if (!trimmed) {
      setError("Enter a symbol, file, route, or table.");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const res = await api.affected({ symbol: trimmed, depth: depthVal }, ctrl.signal);
      setResult(res);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof ApiRequestError ? err.message : "Impact analysis failed.");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  const lastSeed = useRef<string | null>(null);
  useEffect(() => {
    if (impactSeed && impactSeed !== lastSeed.current) {
      lastSeed.current = impactSeed;
      setSymbol(impactSeed);
      void run(impactSeed, depth);
    }
  }, [impactSeed, run, depth]);

  const visibleAffected = useMemo(
    () => (result?.affected ?? []).filter((a) => !hiddenLayers.has(a.node.layer)),
    [result, hiddenLayers],
  );

  const byDepth = useMemo(() => {
    const direct = visibleAffected.filter((a) => a.depth === 1);
    const transitive = visibleAffected.filter((a) => a.depth > 1);
    return { direct, transitive };
  }, [visibleAffected]);

  const tests = useMemo(
    () => visibleAffected.filter((a) => a.node.type === "test" || a.node.layer === "test"),
    [visibleAffected],
  );

  const layersPresent = useMemo(() => {
    const s = new Set<string>();
    for (const a of result?.affected ?? []) s.add(a.node.layer);
    return [...s].sort();
  }, [result]);

  const impactGraph = useMemo(() => {
    if (!result) return { nodes: [], edges: [], highlight: new Set<string>() };
    const ids = new Set<string>([
      ...result.matched.map((n) => n.id),
      ...visibleAffected.map((a) => a.node.id),
    ]);
    const nodes = graph.nodes.filter((n) => ids.has(n.id));
    const edges = graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    return { nodes, edges, highlight: new Set(result.matched.map((n) => n.id)) };
  }, [result, visibleAffected, graph]);

  const toggleLayer = (layer: string): void =>
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });

  return (
    <div className="section-stack">
      <section className="card">
        <form
          className="col"
          style={{ gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void run(symbol, depth);
          }}
        >
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="imp-sym">Symbol · file · route · table</label>
              <input
                id="imp-sym"
                className="input"
                placeholder='e.g. "getStoreToken" or "src/lib/oauth.ts"'
                value={symbol}
                dir="auto"
                onChange={(e) => setSymbol(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="imp-depth">Max depth</label>
              <input
                id="imp-depth"
                className="input"
                type="number"
                min={1}
                max={24}
                value={depth}
                onChange={(e) => setDepth(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <Spinner /> : <Target size={14} />} Analyze impact
              </button>
            </div>
          </div>
        </form>
      </section>

      {error && (
        <div className="banner error">
          <AlertTriangle size={18} className="banner-icon" />
          <div>
            <h3>Impact analysis failed</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!result && !error && !loading && (
        <Empty
          icon={Layers}
          title="No impact analysis yet"
          hint="Enter a symbol or file to see everything that depends on it."
        />
      )}

      {result && (
        <>
          <section className="card">
            <div className="row spread" style={{ flexWrap: "wrap", gap: 8 }}>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {result.matched.length === 0 ? (
                  <span className="badge">no match for “{result.query}”</span>
                ) : (
                  result.matched.map((m) => (
                    <button key={m.id} type="button" className="pill" style={{ cursor: "pointer" }} onClick={() => actions.selectNode(m.id)}>
                      {m.label}
                    </button>
                  ))
                )}
                <span className="badge">{visibleAffected.length} affected</span>
                <span className="badge">{result.files.length} files</span>
                <span className="badge">depth ≤ {result.depth}</span>
              </div>
              <div className="row" style={{ gap: 2 }}>
                <button type="button" className={`icon-btn ${view === "list" ? "active" : ""}`} data-tip="Grouped list" onClick={() => setView("list")}>
                  <List size={15} />
                </button>
                <button type="button" className={`icon-btn ${view === "graph" ? "active" : ""}`} data-tip="Impact graph" onClick={() => setView("graph")}>
                  <Network size={15} />
                </button>
              </div>
            </div>

            {layersPresent.length > 1 && (
              <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <span className="faint" style={{ fontSize: "var(--fs-xs)" }}>Layers:</span>
                {layersPresent.map((l) => (
                  <label key={l} className="checkbox">
                    <input type="checkbox" checked={!hiddenLayers.has(l)} onChange={() => toggleLayer(l)} />
                    {l}
                  </label>
                ))}
              </div>
            )}
          </section>

          {result.matched.length === 0 ? (
            <Empty icon={Target} title="No matching node" hint="Try a different symbol, file path, or table name." />
          ) : view === "graph" ? (
            <section className="card" style={{ padding: 0, height: 460 }}>
              <GraphCanvas
                nodes={impactGraph.nodes}
                edges={impactGraph.edges}
                highlight={impactGraph.highlight}
                colorMode={prefs.prefs.theme}
                onSelectNode={(n) => actions.selectNode(n)}
                onSelectEdge={(ed) => actions.selectEdge(ed)}
              />
            </section>
          ) : (
            <>
              <ImpactGroup
                title="Direct impact"
                icon={Target}
                rows={byDepth.direct}
                onSelect={actions.selectNode}
                emptyHint="Nothing directly depends on the matched node."
              />
              <ImpactGroup
                title="Transitive impact"
                icon={Layers}
                rows={byDepth.transitive}
                onSelect={actions.selectNode}
                emptyHint="No deeper dependents within the chosen depth."
              />
              <section className="card">
                <div className="card-title">
                  <FlaskConical size={13} /> Tests to run ({tests.length})
                </div>
                {tests.length === 0 ? (
                  <div className="faint" style={{ fontSize: "var(--fs-sm)" }}>
                    No tests are linked to the impacted nodes.
                  </div>
                ) : (
                  <div className="col" style={{ gap: 5 }}>
                    {tests.map((a) => (
                      <EntityRow key={a.node.id} node={a.node} reason={`via ${humanize(a.via)}`} onClick={() => actions.selectNode(a.node.id)} />
                    ))}
                  </div>
                )}
              </section>
              <section className="card card-sunken">
                <div className="card-title">
                  <FileCode size={13} /> Affected files ({result.files.length})
                </div>
                {result.files.length === 0 ? (
                  <div className="faint" style={{ fontSize: "var(--fs-sm)" }}>None.</div>
                ) : (
                  <div className="col" style={{ gap: 2 }}>
                    {result.files.map((f) => (
                      <span key={f} className="mono wrap-anywhere" style={{ fontSize: "var(--fs-sm)" }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ImpactGroup({
  title,
  icon: Icon,
  rows,
  onSelect,
  emptyHint,
}: {
  title: string;
  icon: typeof Target;
  rows: { node: AffectedResponse["affected"][number]["node"]; depth: number; via: string }[];
  onSelect: (id: string) => void;
  emptyHint: string;
}): ReactNode {
  return (
    <section className="card">
      <div className="card-title">
        <Icon size={13} /> {title} ({rows.length})
      </div>
      {rows.length === 0 ? (
        <div className="faint" style={{ fontSize: "var(--fs-sm)" }}>{emptyHint}</div>
      ) : (
        <div className="col" style={{ gap: 5 }}>
          {rows.map((a) => (
            <EntityRow
              key={a.node.id}
              node={a.node}
              reason={`via ${humanize(a.via)} · depth ${a.depth}`}
              onClick={() => onSelect(a.node.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
