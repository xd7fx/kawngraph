/** Graph tab: interactive, filterable graph with neighborhood focus + guards. */
import { useMemo, useState, type ReactNode } from "react";
import { Crosshair, Minus, Plus, RotateCcw, TriangleAlert } from "lucide-react";
import { useStudio } from "../studioContext";
import { filterGraph, type ActiveFilters } from "../graph/filter";
import { layerOrderIndex } from "../graph/nodeStyle";
import { GraphCanvas } from "../components/GraphCanvas";
import type { AtharEdge, AtharNode } from "../types";

export function GraphView(): ReactNode {
  const { graph, prefs, selection, actions, graphFocus, setGraphFocus, search } = useStudio();
  const [focusDepth, setFocusDepth] = useState(1);
  const [cap, setCap] = useState(0);

  const f = prefs.prefs.filters;
  const renderLimit = f.renderLimit;
  const effectiveCap = cap || renderLimit;

  const filters: ActiveFilters = useMemo(
    () => ({
      hiddenLayers: new Set(f.hiddenLayers),
      hiddenNodeTypes: new Set(f.hiddenNodeTypes),
      hiddenEdgeTypes: new Set(f.hiddenEdgeTypes),
      hideIsolated: f.hideIsolated,
      search,
      focusId: graphFocus,
      neighborhoodDepth: focusDepth,
    }),
    [f, search, graphFocus, focusDepth],
  );

  const filtered = useMemo(() => filterGraph(graph, filters), [graph, filters]);

  const { nodes, edges, capped } = useMemo(() => {
    const ordered = [...filtered.nodes].sort(
      (a, b) => layerOrderIndex(a.layer) - layerOrderIndex(b.layer) || (a.id < b.id ? -1 : 1),
    );
    if (ordered.length <= effectiveCap) {
      return { nodes: ordered, edges: filtered.edges, capped: false };
    }
    const slice: AtharNode[] = ordered.slice(0, effectiveCap);
    const keep = new Set(slice.map((n) => n.id));
    const slicedEdges: AtharEdge[] = filtered.edges.filter((e) => keep.has(e.from) && keep.has(e.to));
    return { nodes: slice, edges: slicedEdges, capped: true };
  }, [filtered, effectiveCap]);

  const focusNode = graphFocus ? graph.nodes.find((n) => n.id === graphFocus) : undefined;
  const selectedId = selection?.kind === "node" ? selection.node.id : null;
  const highlight =
    selection?.kind === "edge"
      ? new Set([selection.edge.from, selection.edge.to])
      : null;

  const resetView = (): void => {
    setGraphFocus(null);
    setFocusDepth(1);
    setCap(0);
  };

  return (
    <div className="graph-wrap">
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        selectedId={selectedId}
        highlight={highlight}
        colorMode={prefs.prefs.theme}
        fitSignal={`${graphFocus ?? ""}:${focusDepth}:${nodes.length}`}
        onSelectNode={(n) => actions.selectNode(n)}
        onSelectEdge={(e) => actions.selectEdge(e)}
      />

      <div className="graph-overlay top-left col" style={{ gap: 6, alignItems: "flex-start" }}>
        <span className="chip">
          {nodes.length.toLocaleString()} {nodes.length === 1 ? "node" : "nodes"} ·{" "}
          {edges.length.toLocaleString()} {edges.length === 1 ? "edge" : "edges"}
          {filtered.removed > 0 && (
            <span className="faint">&nbsp;· {filtered.removed} filtered</span>
          )}
        </span>

        {focusNode && (
          <span className="chip">
            <Crosshair size={12} />
            <span className="nowrap">Focus: </span>
            <strong className="wrap-anywhere" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
              {focusNode.label}
            </strong>
            <button
              type="button"
              className="icon-btn"
              style={{ width: 20, height: 20 }}
              data-tip="Smaller neighborhood"
              onClick={() => setFocusDepth((d) => Math.max(1, d - 1))}
            >
              <Minus size={12} />
            </button>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>depth {focusDepth}</span>
            <button
              type="button"
              className="icon-btn"
              style={{ width: 20, height: 20 }}
              data-tip="Larger neighborhood"
              onClick={() => setFocusDepth((d) => Math.min(6, d + 1))}
            >
              <Plus size={12} />
            </button>
          </span>
        )}

        {capped && (
          <span className="chip warn">
            <TriangleAlert size={12} />
            Showing {nodes.length.toLocaleString()} of {filtered.nodes.length.toLocaleString()} — refine
            filters or focus a node
            <button
              type="button"
              className="btn btn-sm"
              style={{ height: 20 }}
              onClick={() => setCap(effectiveCap + renderLimit)}
            >
              Show more
            </button>
          </span>
        )}

        {(graphFocus || cap > 0) && (
          <button type="button" className="chip" onClick={resetView} style={{ cursor: "pointer" }}>
            <RotateCcw size={12} /> Reset view
          </button>
        )}
      </div>
    </div>
  );
}
