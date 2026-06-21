/**
 * Universe tab: the whole graph as a 3D star field of per-layer galaxies.
 *
 * Reuses the exact same pure filtering + render-budget guards as the 2D Graph
 * view (so the two views always agree on what's visible), then hands the result
 * to `UniverseCanvas`, which draws it in a single GPU points pass. A larger node
 * budget than the 2D view is safe here because points are one draw call, not one
 * DOM node each — but it is still bounded, never "render everything".
 */
import { useMemo, useState, type ReactNode } from "react";
import { Crosshair, Minus, MousePointerClick, Plus, RotateCcw, TriangleAlert } from "lucide-react";
import { useStudio } from "../studioContext";
import { filterGraph, type ActiveFilters } from "../graph/filter";
import { layerColor, layerOrderIndex, humanize } from "../graph/nodeStyle";
import { UniverseCanvas } from "../components/UniverseCanvas";
import type { AtharEdge, AtharNode } from "../types";

/** GPU points scale far past DOM nodes, so the 3D guard is more generous. */
const UNIVERSE_BUDGET = 12000;

export function UniverseView(): ReactNode {
  const { graph, prefs, selection, actions, graphFocus, setGraphFocus, search } = useStudio();
  const [focusDepth, setFocusDepth] = useState(1);
  const [cap, setCap] = useState(0);

  const f = prefs.prefs.filters;
  const baseCap = Math.max(f.renderLimit, UNIVERSE_BUDGET);
  const effectiveCap = cap || baseCap;

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

  // Layer legend (a star map needs a key): layers present, in canonical order.
  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of nodes) counts.set(n.layer, (counts.get(n.layer) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => layerOrderIndex(a[0]) - layerOrderIndex(b[0]))
      .map(([layer, count]) => ({ layer, count, color: layerColor(layer) }));
  }, [nodes]);

  const focusNode = graphFocus ? graph.nodes.find((n) => n.id === graphFocus) : undefined;
  const selectedId = selection?.kind === "node" ? selection.node.id : null;
  const highlight =
    selection?.kind === "edge" ? new Set([selection.edge.from, selection.edge.to]) : null;

  const resetView = (): void => {
    setGraphFocus(null);
    setFocusDepth(1);
    setCap(0);
  };

  return (
    <div className="graph-wrap">
      <UniverseCanvas
        nodes={nodes}
        edges={edges}
        selectedId={selectedId}
        highlight={highlight}
        colorMode={prefs.prefs.theme}
        fitSignal={`${graphFocus ?? ""}:${focusDepth}:${nodes.length}`}
        onSelectNode={(n) => actions.selectNode(n)}
      />

      <div className="graph-overlay top-left col" style={{ gap: 6, alignItems: "flex-start" }}>
        <span className="chip">
          {nodes.length.toLocaleString()} {nodes.length === 1 ? "node" : "nodes"} ·{" "}
          {edges.length.toLocaleString()} {edges.length === 1 ? "edge" : "edges"}
          {filtered.removed > 0 && <span className="faint">&nbsp;· {filtered.removed} filtered</span>}
        </span>

        {focusNode && (
          <span className="chip">
            <Crosshair size={12} />
            <span className="nowrap">Focus: </span>
            <strong
              className="wrap-anywhere"
              style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}
            >
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
              onClick={() => setCap(effectiveCap + UNIVERSE_BUDGET)}
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

        <span className="chip faint">
          <MousePointerClick size={12} /> Drag to orbit · scroll to zoom · click a star
        </span>
      </div>

      {legend.length > 0 && (
        <div className="graph-overlay bottom-left">
          <div className="uni-legend chip">
            {legend.map((l) => (
              <span key={l.layer} className="uni-legend-item" title={`${l.count} ${l.layer}`}>
                <span className="uni-legend-dot" style={{ background: l.color }} />
                {humanize(l.layer)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
