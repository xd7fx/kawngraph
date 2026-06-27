/**
 * Constellation Map — a 2D star-map renderer for the graph. Nodes are circular
 * points coloured by layer, edges are thin lines, and the layout is the
 * deterministic force-directed `layout2d` (organic, never stacked columns). A
 * single <canvas> draws everything (no DOM-per-node), with pan/zoom/fit,
 * hover highlight, click-to-select, search emphasis, and level-of-detail labels
 * (dots when zoomed out; labels on hover/selection/search and when zoomed in).
 *
 * It is the flat sibling of the 3D UniverseCanvas and replaces the old React
 * Flow card layout for the Map view only (Impact/Flow keep their diagram canvas).
 */
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { layerColor } from "../graph/nodeStyle";
import { layout2d } from "../graph/layout2d";
import type { KawnEdge, KawnNode } from "../types";
import { Empty } from "./ui";
import { Workflow } from "lucide-react";

export interface ConstellationCanvasProps {
  nodes: KawnNode[];
  edges: KawnEdge[];
  selectedId?: string | null;
  highlight?: ReadonlySet<string> | null;
  search?: string;
  colorMode?: "light" | "dark";
  fitSignal?: string;
  onSelectNode?: (node: KawnNode) => void;
  onSelectEdge?: (edge: KawnEdge) => void;
}

interface View {
  x: number;
  y: number;
  scale: number;
}

const LABEL_ZOOM = 1.35; // above this, high-degree nodes get auto labels
const LABEL_ZOOM_MORE = 2.1; // above this, most nodes get labels
const MAX_AUTO_LABELS = 46; // clutter guard for auto (zoom) labels

function nodeRadius(degree: number): number {
  return 4.2 + Math.min(5.8, Math.sqrt(degree) * 1.5);
}

export function ConstellationCanvas(props: ConstellationCanvasProps): ReactNode {
  const { nodes, edges, onSelectNode, onSelectEdge } = props;
  const colorMode = props.colorMode ?? "light";

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, scale: 1 });
  const hoverRef = useRef<string | null>(null);
  const dragRef = useRef<{ active: boolean; moved: boolean; px: number; py: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const layout = useMemo(() => layout2d(nodes, edges), [nodes, edges]);

  // Adjacency for hover/selection neighbour highlighting.
  const adj = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) {
      (m.get(e.from) ?? m.set(e.from, new Set()).get(e.from)!).add(e.to);
      (m.get(e.to) ?? m.set(e.to, new Set()).get(e.to)!).add(e.from);
    }
    return m;
  }, [edges]);

  // Keep the latest props/derived data in a ref so the imperative draw() never
  // goes stale without re-binding event listeners.
  const stateRef = useRef({ nodes, edges, layout, adj, props, colorMode });
  stateRef.current = { nodes, edges, layout, adj, props, colorMode };

  function fit(): void {
    const cv = canvasRef.current;
    if (!cv) return;
    const w = cv.clientWidth || 1;
    const h = cv.clientHeight || 1;
    const r = stateRef.current.layout.radius || 1;
    const scale = Math.min(w / (r * 2 + 80), h / (r * 2 + 80));
    viewRef.current = { x: w / 2, y: h / 2, scale: Math.max(0.05, Math.min(scale, 1.4)) };
  }

  function requestDraw(): void {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }

  function draw(): void {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 1;
    const h = cv.clientHeight || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const { layout, adj, nodes, edges, props, colorMode } = stateRef.current;
    const view = viewRef.current;
    const dark = colorMode === "dark";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const toScreen = (p: { x: number; y: number }) => ({ x: p.x * view.scale + view.x, y: p.y * view.scale + view.y });

    // Faint world-space dot grid for spatial reference (the "space" backdrop).
    const gridStep = 64 * view.scale;
    if (gridStep > 14) {
      ctx.fillStyle = dark ? "rgba(148,163,184,0.06)" : "rgba(100,116,139,0.07)";
      const ox = view.x % gridStep;
      const oy = view.y % gridStep;
      for (let gx = ox; gx < w; gx += gridStep) {
        for (let gy = oy; gy < h; gy += gridStep) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const search = (props.search ?? "").trim().toLowerCase();
    const matches = (n: KawnNode): boolean =>
      !!search && (n.label.toLowerCase().includes(search) || n.id.toLowerCase().includes(search) || n.type.toLowerCase().includes(search));
    const selectedId = props.selectedId ?? null;
    const hoverId = hoverRef.current;
    const focusId = hoverId ?? selectedId;
    const focusNeighbors = focusId ? adj.get(focusId) ?? new Set<string>() : null;
    const propHighlight = props.highlight ?? null;

    const isActive = (id: string): boolean => !focusId || id === focusId || (focusNeighbors?.has(id) ?? false);
    const dimmedByProp = (id: string): boolean => !!propHighlight && !propHighlight.has(id);

    // --- edges ---
    for (const e of edges) {
      const a = layout.positions.get(e.from);
      const b = layout.positions.get(e.to);
      if (!a || !b) continue;
      const touchesFocus = !!focusId && (e.from === focusId || e.to === focusId);
      const dim = dimmedByProp(e.from) || dimmedByProp(e.to) || (!!focusId && !touchesFocus);
      const pa = toScreen(a);
      const pb = toScreen(b);
      ctx.strokeStyle = touchesFocus
        ? dark
          ? "rgba(125,211,252,0.55)"
          : "rgba(37,99,235,0.5)"
        : dark
          ? `rgba(148,163,184,${dim ? 0.05 : 0.14})`
          : `rgba(100,116,139,${dim ? 0.06 : 0.16})`;
      ctx.lineWidth = touchesFocus ? 1.4 : 0.8;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // --- decide auto (zoom) labels: top-degree nodes, capped ---
    const autoLabel = new Set<string>();
    if (view.scale >= LABEL_ZOOM) {
      const degThreshold = view.scale >= LABEL_ZOOM_MORE ? 1 : 3;
      const cand = nodes
        .filter((n) => (layout.degrees.get(n.id) ?? 0) >= degThreshold)
        .sort((p, q) => (layout.degrees.get(q.id) ?? 0) - (layout.degrees.get(p.id) ?? 0))
        .slice(0, view.scale >= LABEL_ZOOM_MORE ? MAX_AUTO_LABELS * 3 : MAX_AUTO_LABELS);
      for (const n of cand) autoLabel.add(n.id);
    }

    // --- nodes ---
    const labelled: Array<{ n: KawnNode; sx: number; sy: number; r: number }> = [];
    for (const n of nodes) {
      const p = layout.positions.get(n.id);
      if (!p) continue;
      const s = toScreen(p);
      if (s.x < -40 || s.x > w + 40 || s.y < -40 || s.y > h + 40) continue; // cull off-screen
      const deg = layout.degrees.get(n.id) ?? 0;
      const r = nodeRadius(deg);
      const selected = n.id === selectedId;
      const hovered = n.id === hoverId;
      const match = matches(n);
      let alpha = 1;
      if (search && !match) alpha = 0.22;
      else if (dimmedByProp(n.id)) alpha = 0.18;
      else if (!isActive(n.id)) alpha = 0.32;

      ctx.globalAlpha = alpha;
      const color = layerColor(n.layer);
      // halo for hovered / selected / search match
      if (hovered || selected || match) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, r + (hovered ? 7 : 5), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha * 0.18;
        ctx.fill();
        ctx.globalAlpha = alpha;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, selected ? r + 1.5 : r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = selected ? 2.2 : 1;
      ctx.strokeStyle = selected
        ? dark
          ? "#e5e7eb"
          : "#0b1118"
        : dark
          ? "rgba(2,6,12,0.6)"
          : "rgba(255,255,255,0.85)";
      ctx.stroke();
      ctx.globalAlpha = 1;

      const showLabel = hovered || selected || match || autoLabel.has(n.id);
      if (showLabel) labelled.push({ n, sx: s.x, sy: s.y, r });
    }

    // --- labels (drawn last, on top) ---
    if (labelled.length) {
      ctx.font = "11px ui-sans-serif, system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "middle";
      for (const { n, sx, sy, r } of labelled) {
        const text = n.label.length > 28 ? n.label.slice(0, 27) + "…" : n.label;
        const tw = ctx.measureText(text).width;
        const lx = sx + r + 5;
        const ly = sy;
        ctx.fillStyle = dark ? "rgba(8,13,20,0.82)" : "rgba(255,255,255,0.9)";
        ctx.fillRect(lx - 3, ly - 8, tw + 6, 16);
        ctx.fillStyle = dark ? "#e5e7eb" : "#0b1118";
        ctx.fillText(text, lx, ly + 0.5);
      }
    }
  }

  // Hit-test: nearest node within a small screen radius of (mx, my).
  function nodeAt(mx: number, my: number): KawnNode | null {
    const { layout, nodes } = stateRef.current;
    const view = viewRef.current;
    let best: KawnNode | null = null;
    let bestD = Infinity;
    for (const n of nodes) {
      const p = layout.positions.get(n.id);
      if (!p) continue;
      const sx = p.x * view.scale + view.x;
      const sy = p.y * view.scale + view.y;
      const r = nodeRadius(layout.degrees.get(n.id) ?? 0) + 6;
      const d = (sx - mx) ** 2 + (sy - my) ** 2;
      if (d <= r * r && d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  function edgeAt(mx: number, my: number): KawnEdge | null {
    const { layout, edges } = stateRef.current;
    const view = viewRef.current;
    let best: KawnEdge | null = null;
    let bestD = 6; // px tolerance
    for (const e of edges) {
      const a = layout.positions.get(e.from);
      const b = layout.positions.get(e.to);
      if (!a || !b) continue;
      const ax = a.x * view.scale + view.x;
      const ay = a.y * view.scale + view.y;
      const bx = b.x * view.scale + view.x;
      const by = b.y * view.scale + view.y;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((mx - ax) * dx + (my - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + t * dx;
      const py = ay + t * dy;
      const dist = Math.hypot(mx - px, my - py);
      if (dist < bestD) {
        bestD = dist;
        best = e;
      }
    }
    return best;
  }

  function zoomBy(factor: number, cx?: number, cy?: number): void {
    const cv = canvasRef.current;
    if (!cv) return;
    const view = viewRef.current;
    const ax = cx ?? cv.clientWidth / 2;
    const ay = cy ?? cv.clientHeight / 2;
    const next = Math.max(0.05, Math.min(6, view.scale * factor));
    // keep the point under the cursor stable
    view.x = ax - ((ax - view.x) * next) / view.scale;
    view.y = ay - ((ay - view.y) * next) / view.scale;
    view.scale = next;
    requestDraw();
  }

  // Mount: size, fit, draw, and wire resize.
  useEffect(() => {
    fit();
    draw();
    const ro = new ResizeObserver(() => requestDraw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fit when the graph or the fit signal changes.
  useEffect(() => {
    fit();
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, props.fitSignal]);

  // Redraw on selection / highlight / search / theme changes.
  useEffect(() => {
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selectedId, props.highlight, props.search, colorMode]);

  // Pointer + wheel handlers (native listeners so wheel can be non-passive).
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rel = (e: PointerEvent | WheelEvent): [number, number] => {
      const rect = cv.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const [mx, my] = rel(e);
      zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, mx, my);
    };
    const onDown = (e: PointerEvent): void => {
      const [mx, my] = rel(e);
      dragRef.current = { active: true, moved: false, px: mx, py: my };
      cv.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent): void => {
      const [mx, my] = rel(e);
      const drag = dragRef.current;
      if (drag?.active) {
        const ddx = mx - drag.px;
        const ddy = my - drag.py;
        if (Math.abs(ddx) + Math.abs(ddy) > 3) drag.moved = true;
        viewRef.current.x += ddx;
        viewRef.current.y += ddy;
        drag.px = mx;
        drag.py = my;
        requestDraw();
        return;
      }
      const hit = nodeAt(mx, my);
      const id = hit?.id ?? null;
      if (id !== hoverRef.current) {
        hoverRef.current = id;
        cv.style.cursor = id ? "pointer" : "grab";
        requestDraw();
      }
    };
    const onUp = (e: PointerEvent): void => {
      const drag = dragRef.current;
      dragRef.current = null;
      try {
        cv.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (drag && !drag.moved) {
        const [mx, my] = rel(e);
        const hit = nodeAt(mx, my);
        if (hit) onSelectNode?.(hit);
        else {
          const eh = edgeAt(mx, my);
          if (eh) onSelectEdge?.(eh);
        }
      }
    };
    const onLeave = (): void => {
      if (hoverRef.current) {
        hoverRef.current = null;
        requestDraw();
      }
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", onLeave);
    return () => {
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSelectNode, onSelectEdge]);

  if (nodes.length === 0) {
    return (
      <div className="graph-wrap">
        <Empty icon={Workflow} title="Nothing to show" hint="No nodes match the current filters." />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="constellation-wrap" style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }} />
      <div className="constellation-zoom">
        <button type="button" className="icon-btn" data-tip="Zoom in" onClick={() => zoomBy(1.25)}>
          <Plus size={15} />
        </button>
        <button type="button" className="icon-btn" data-tip="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
          <Minus size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          data-tip="Fit"
          onClick={() => {
            fit();
            requestDraw();
          }}
        >
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  );
}
