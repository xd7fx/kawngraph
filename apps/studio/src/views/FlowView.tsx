/** Flow tab: bounded shortest path between two nodes, with per-step evidence. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, List, Network, Route, Spline, Unplug } from "lucide-react";
import { api, ApiRequestError } from "../api";
import { useStudio } from "../studioContext";
import { humanize } from "../graph/nodeStyle";
import { GraphCanvas } from "../components/GraphCanvas";
import { ConfidenceBadge, Empty, Loc, NodeTypeIcon, Spinner } from "../components/ui";
import type { AtharEdge, FlowResponse } from "../types";

export function FlowView(): ReactNode {
  const { flowSeed, prefs, actions } = useStudio();
  const [from, setFrom] = useState(flowSeed.from);
  const [to, setTo] = useState(flowSeed.to);
  const [view, setView] = useState<"list" | "graph">("list");
  const [result, setResult] = useState<FlowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (a: string, b: string) => {
    if (!a.trim() || !b.trim()) {
      setError("Enter both a source and a target.");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const res = await api.flow({ from: a.trim(), to: b.trim() }, ctrl.signal);
      setResult(res);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof ApiRequestError ? err.message : "Flow lookup failed.");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  const lastSeed = useRef<string>("");
  useEffect(() => {
    const key = `${flowSeed.from}→${flowSeed.to}`;
    if (key === lastSeed.current) return;
    lastSeed.current = key;
    setFrom(flowSeed.from);
    setTo(flowSeed.to);
    if (flowSeed.from.trim() && flowSeed.to.trim()) void run(flowSeed.from, flowSeed.to);
  }, [flowSeed, run]);

  const graphData = useMemo(() => {
    if (!result?.found) return { nodes: [], edges: [] };
    const seen = new Set<string>();
    const edges: AtharEdge[] = [];
    for (const s of result.steps) {
      if (!seen.has(s.edge.id)) {
        seen.add(s.edge.id);
        edges.push(s.edge);
      }
    }
    return { nodes: result.nodes, edges };
  }, [result]);

  const swap = (): void => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div className="section-stack">
      <section className="card">
        <form
          className="col"
          style={{ gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void run(from, to);
          }}
        >
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field grow">
              <label htmlFor="flow-from">From</label>
              <input id="flow-from" className="input" placeholder="source node (id, #symbol, or label)" value={from} dir="auto" onChange={(e) => setFrom(e.target.value)} />
            </div>
            <button type="button" className="icon-btn" data-tip="Swap" onClick={swap} style={{ marginBottom: 4 }}>
              <ArrowLeftRight size={16} />
            </button>
            <div className="field grow">
              <label htmlFor="flow-to">To</label>
              <input id="flow-to" className="input" placeholder="target node (id, #symbol, or label)" value={to} dir="auto" onChange={(e) => setTo(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginBottom: 4 }}>
              {loading ? <Spinner /> : <Spline size={14} />} Trace flow
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div className="banner error">
          <Unplug size={18} className="banner-icon" />
          <div>
            <h3>Flow lookup failed</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!result && !error && !loading && (
        <Empty icon={Route} title="No flow traced yet" hint="Pick a source and target to see the shortest evidence-backed path between them." />
      )}

      {result && !result.found && (
        <div className="banner warn">
          <Unplug size={18} className="banner-icon" />
          <div>
            <h3>No path found</h3>
            <p>
              There is no connection between <code>{result.from}</code> and <code>{result.to}</code> in the
              graph (within the traversal bound). Try different endpoints or check the node names.
            </p>
          </div>
        </div>
      )}

      {result?.found && (
        <>
          <section className="card">
            <div className="row spread" style={{ flexWrap: "wrap", gap: 8 }}>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="badge">{result.nodes.length} nodes</span>
                <span className="badge">{result.steps.length} steps</span>
              </div>
              <div className="row" style={{ gap: 2 }}>
                <button type="button" className={`icon-btn ${view === "list" ? "active" : ""}`} data-tip="Step list" onClick={() => setView("list")}>
                  <List size={15} />
                </button>
                <button type="button" className={`icon-btn ${view === "graph" ? "active" : ""}`} data-tip="Path graph" onClick={() => setView("graph")}>
                  <Network size={15} />
                </button>
              </div>
            </div>
          </section>

          {view === "graph" ? (
            <section className="card" style={{ padding: 0, height: 420 }}>
              <GraphCanvas
                nodes={graphData.nodes}
                edges={graphData.edges}
                highlight={new Set(graphData.nodes.map((n) => n.id))}
                showLabels
                colorMode={prefs.prefs.theme}
                onSelectNode={(n) => actions.selectNode(n)}
                onSelectEdge={(ed) => actions.selectEdge(ed)}
              />
            </section>
          ) : (
            <section className="card">
              {result.nodes.map((node, i) => {
                const step = result.steps[i];
                return (
                  <div key={node.id}>
                    <button
                      type="button"
                      className="row"
                      style={{ gap: 8, background: "none", border: "none", padding: "4px 0", cursor: "pointer", width: "100%", textAlign: "left" }}
                      onClick={() => actions.selectNode(node.id)}
                    >
                      <NodeTypeIcon type={node.type} layer={node.layer} size={22} />
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600, display: "block" }} className="wrap-anywhere" dir="auto">
                          {node.label}
                        </span>
                        <span className="mono faint" style={{ fontSize: "var(--fs-xs)" }}>
                          {node.id}
                        </span>
                      </span>
                    </button>
                    {step && (
                      <div className="flow-step" style={{ margin: "2px 0 2px 10px" }}>
                        <div className="flow-rail">
                          <div className="line" />
                        </div>
                        <button
                          type="button"
                          className="card card-sunken grow"
                          style={{ textAlign: "left", cursor: "pointer", padding: 8, margin: "4px 0" }}
                          onClick={() => actions.selectEdge(step.edge)}
                        >
                          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                            <span className="pill">{humanize(step.edge.type)}</span>
                            <ConfidenceBadge confidence={step.edge.confidence} />
                            {step.reversed && <span className="tag" data-tip="Edge points the other way">reversed</span>}
                          </div>
                          {step.edge.evidence && (
                            <div style={{ marginTop: 6 }}>
                              <Loc node={step.edge.evidence} />
                              {step.edge.evidence.snippet && (
                                <pre className="snippet" style={{ marginTop: 4, maxHeight: 100 }} dir="auto">
                                  {step.edge.evidence.snippet}
                                </pre>
                              )}
                            </div>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}
