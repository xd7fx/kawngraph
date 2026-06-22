/**
 * Shared React Flow canvas. Renders a pre-filtered set of KawnGraph nodes/edges with
 * the deterministic layered layout, a custom node (icon + label, colored by
 * layer), minimap, controls, and pan/zoom/fit. Reused by Graph, Impact, and Flow.
 */
import { useEffect, useMemo, type ReactNode } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Workflow } from "lucide-react";
import { useLayout } from "../graph/useLayout";
import { layerColor, nodeIcon } from "../graph/nodeStyle";
import { humanize } from "../graph/nodeStyle";
import type { KawnEdge, KawnNode } from "../types";
import { Empty, Spinner } from "./ui";

type KawnNodeData = { node: KawnNode; selected: boolean; dim: boolean };
type KawnEdgeData = { edge: KawnEdge };

function KawnFlowNode({ data }: NodeProps): ReactNode {
  const { node, selected, dim } = data as KawnNodeData;
  const Icon = nodeIcon(node.type);
  return (
    <div className={`rf-node${selected ? " selected" : ""}${dim ? " dim" : ""}`}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} isConnectable={false} />
      <span
        className="rf-node-icon"
        style={{ background: layerColor(node.layer), width: 22, height: 22 }}
        aria-hidden
      >
        <Icon size={13} strokeWidth={2.2} />
      </span>
      <span className="rf-node-text">
        <span className="rf-node-label" title={node.label} dir="auto">
          {node.label}
        </span>
        <span className="rf-node-type">{node.type}</span>
      </span>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { kawn: KawnFlowNode };

function Fitter({ signal }: { signal: string }): null {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = window.setTimeout(() => void fitView({ padding: 0.2, maxZoom: 1.25, duration: 200 }), 60);
    return () => window.clearTimeout(t);
  }, [signal, fitView]);
  return null;
}

export interface GraphCanvasProps {
  nodes: KawnNode[];
  edges: KawnEdge[];
  selectedId?: string | null;
  highlight?: ReadonlySet<string> | null;
  showLabels?: boolean;
  colorMode?: "light" | "dark";
  fitSignal?: string;
  onSelectNode?: (node: KawnNode) => void;
  onSelectEdge?: (edge: KawnEdge) => void;
}

export function GraphCanvas(props: GraphCanvasProps): ReactNode {
  const { nodes, edges, selectedId, highlight, colorMode = "light", onSelectNode, onSelectEdge } = props;
  const showLabels = props.showLabels ?? edges.length <= 70;

  // Layout runs synchronously for small graphs and on a Web Worker for large
  // ones; `pending` is true only while a large graph's positions are computing.
  const { positions, pending } = useLayout(nodes);

  const rfNodes = useMemo<Node[]>(() => {
    return nodes.map((n) => ({
      id: n.id,
      type: "kawn",
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: { node: n, selected: n.id === selectedId, dim: !!highlight && !highlight.has(n.id) },
      draggable: true,
    }));
  }, [nodes, positions, selectedId, highlight]);

  const rfEdges = useMemo<Edge[]>(() => {
    return edges.map((e) => {
      const dim = !!highlight && (!highlight.has(e.from) || !highlight.has(e.to));
      const stroke = dim ? "var(--border)" : "var(--border-strong)";
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        data: { edge: e } satisfies KawnEdgeData,
        label: showLabels ? humanize(e.type) : undefined,
        labelShowBg: true,
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        labelStyle: { fontSize: 10, fill: "var(--text-muted)" },
        labelBgStyle: { fill: "var(--bg-elev)", fillOpacity: 0.85 },
        style: { stroke, strokeWidth: dim ? 1 : 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13, color: stroke },
      } satisfies Edge;
    });
  }, [edges, showLabels, highlight]);

  const fitSignal = props.fitSignal ?? `${nodes.length}:${edges.length}:${selectedId ?? ""}`;

  if (nodes.length === 0) {
    return (
      <div className="graph-wrap">
        <Empty icon={Workflow} title="Nothing to show" hint="No nodes match the current filters." />
      </div>
    );
  }

  // Large graph whose worker layout hasn't landed yet: show a spinner rather
  // than briefly stacking every node at the origin.
  if (pending) {
    return (
      <div className="graph-wrap">
        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
          <div className="col" style={{ alignItems: "center", gap: 10 }}>
            <Spinner />
            <span className="muted">Laying out {nodes.length.toLocaleString()} nodes…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-wrap">
      <ReactFlowProvider>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          colorMode={colorMode}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.25 }}
          minZoom={0.1}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_e, n) => onSelectNode?.((n.data as KawnNodeData).node)}
          onEdgeClick={(_e, ed) => onSelectEdge?.((ed.data as KawnEdgeData).edge)}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => layerColor((n.data as KawnNodeData).node.layer)}
            nodeStrokeWidth={0}
            maskColor="rgba(100,116,139,0.15)"
          />
          <Fitter signal={fitSignal} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
