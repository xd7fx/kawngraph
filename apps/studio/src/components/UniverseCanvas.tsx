/**
 * The Athar Universe: a WebGL rendering of the whole graph as a star field.
 *
 * Scalability is the whole point, so the renderer is built to stay cheap as the
 * graph grows:
 *   - ALL nodes live in ONE `THREE.Points` draw call (a single GPU buffer), so
 *     thousands of nodes cost one draw, not thousands of DOM elements.
 *   - Edges are ONE budgeted `THREE.LineSegments` (capped) — faint structure,
 *     never the bottleneck.
 *   - Labels are HTML, capped, and only drawn for the focus + its neighbours and
 *     the galaxy centres. This is the level-of-detail trick: the GPU shows the
 *     shape, text shows up only where you're looking.
 *
 * The imperative Three.js scene is isolated in `UniverseEngine` so the React
 * component only wires lifecycle + props → engine method calls. The engine owns
 * every GPU resource and disposes all of them on teardown (no context leaks).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Orbit } from "lucide-react";
import { layout3d, type GalaxyCluster, type Layout3D } from "../graph/layout3d";
import { layerColor, humanize } from "../graph/nodeStyle";
import type { AtharEdge, AtharNode } from "../types";
import { Empty } from "./ui";

/** Theme-derived colors handed to the engine (kept out of Three so it's pure). */
interface UniverseTheme {
  background: string;
  edge: string;
  label: string;
  marker: string;
}

const THEMES: Record<"light" | "dark", UniverseTheme> = {
  light: { background: "#f6f8fa", edge: "#cbd5e1", label: "#0f172a", marker: "#2563eb" },
  dark: { background: "#0b1220", edge: "#334155", label: "#e6edf6", marker: "#60a5fa" },
};

/** Budgets — bounds that keep a huge graph from ever rendering everything. */
const EDGE_BUDGET = 6000; // line segments drawn at once
const LABEL_NODE_BUDGET = 28; // HTML labels for nodes (galaxies are always shown)

interface LabelTarget {
  id: string;
  text: string;
  sub: string;
  pos: THREE.Vector3;
  galaxy: boolean;
}

/** Build a soft round sprite so points read as discs, not squares. */
function makeDiscTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const r = size / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.6, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Build a ring sprite used to mark the selected node. */
function makeRingTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = size * 0.08;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Bounds → center + radius for camera framing (robust to any layout). */
function boundsOf(positions: Float32Array): { center: THREE.Vector3; radius: number } {
  if (positions.length === 0) return { center: new THREE.Vector3(), radius: 100 };
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < positions.length; i += 3) {
    min.x = Math.min(min.x, positions[i]);
    min.y = Math.min(min.y, positions[i + 1]);
    min.z = Math.min(min.z, positions[i + 2]);
    max.x = Math.max(max.x, positions[i]);
    max.y = Math.max(max.y, positions[i + 1]);
    max.z = Math.max(max.z, positions[i + 2]);
  }
  const center = min.clone().add(max).multiplyScalar(0.5);
  const radius = Math.max(1, center.distanceTo(max));
  return { center, radius };
}

class UniverseEngine {
  private mount: HTMLElement;
  private overlay: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private disc: THREE.Texture;
  private ring: THREE.Texture;
  private marker: THREE.Sprite;

  private points: THREE.Points | null = null;
  private lines: THREE.LineSegments | null = null;
  private nodes: AtharNode[] = [];
  private idToIndex = new Map<string, number>();
  private positions = new Float32Array(0);
  private baseColors = new Float32Array(0);
  private clusters: GalaxyCluster[] = [];
  private pointSize = 3;

  private labelTargets: LabelTarget[] = [];
  private labelEls = new Map<string, HTMLDivElement>();

  private theme: UniverseTheme;
  private raf = 0;
  private frameQueued = false;
  private interacting = false;
  private disposed = false;
  private resizeObs: ResizeObserver;
  private down: { x: number; y: number; t: number } | null = null;

  onSelect: ((node: AtharNode) => void) | null = null;

  constructor(mount: HTMLElement, overlay: HTMLElement, theme: UniverseTheme) {
    this.mount = mount;
    this.overlay = overlay;
    this.theme = theme;

    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    // Throws / returns no context on machines without WebGL — surfaced to React.
    if (!this.renderer.getContext()) throw new Error("WebGL unavailable");
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    mount.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(theme.background);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200000);
    this.camera.position.set(160, 120, 220);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.8;
    this.controls.zoomToCursor = true;

    this.disc = makeDiscTexture();
    this.ring = makeRingTexture();
    this.marker = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.ring,
        color: new THREE.Color(theme.marker),
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.marker.visible = false;
    this.marker.renderOrder = 2;
    this.scene.add(this.marker);

    // Render-on-demand: only draw when something actually changes (interaction,
    // data, theme, resize). The loop idles when the scene is still — cheaper, and
    // it lets headless tools/screenshots see a settled page instead of a forever
    // animating one. Damping is preserved by re-arming while the camera eases.
    this.controls.addEventListener("change", this.invalidate);
    this.controls.addEventListener("start", this.handleStart);
    this.controls.addEventListener("end", this.handleEnd);

    // Picking: only a deliberate click (small move, quick) selects — drags orbit.
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.handleDown);
    el.addEventListener("pointerup", this.handleUp);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(mount);
    document.addEventListener("visibilitychange", this.handleVisibility);

    this.invalidate();
  }

  // ---- public API -----------------------------------------------------------

  setData(nodes: AtharNode[], edges: AtharEdge[], layout: Layout3D): void {
    this.disposePoints();
    this.disposeLines();
    this.nodes = nodes;
    this.clusters = layout.clusters;
    this.idToIndex = new Map(nodes.map((n, i) => [n.id, i]));

    const count = nodes.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const p = layout.positions.get(nodes[i].id) ?? { x: 0, y: 0, z: 0 };
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      c.set(layerColor(nodes[i].layer));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    this.positions = positions;
    this.baseColors = colors.slice();

    // Point size scales with the scene so it reads at any graph size.
    const { center, radius } = boundsOf(positions);
    this.pointSize = THREE.MathUtils.clamp(radius * 0.012, 2, 7);
    this.raycaster.params.Points = { threshold: this.pointSize * 0.9 };

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: this.pointSize,
      map: this.disc,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      alphaTest: 0.35,
      depthWrite: true,
    });
    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    this.buildEdges(edges);
    this.marker.scale.setScalar(this.pointSize * 6);
    this.setSelection(null, null);
    this.frame(center, radius);
  }

  /** Recolor for emphasis (no geometry rebuild) + refresh labels + marker. */
  setSelection(selectedId: string | null, emphasized: ReadonlySet<string> | null): void {
    if (!this.points) return;
    const attr = this.points.geometry.getAttribute("color") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const bg = new THREE.Color(this.theme.background);
    const n = this.nodes.length;
    for (let i = 0; i < n; i++) {
      const lit = !emphasized || emphasized.has(this.nodes[i].id);
      if (lit) {
        arr[i * 3] = this.baseColors[i * 3];
        arr[i * 3 + 1] = this.baseColors[i * 3 + 1];
        arr[i * 3 + 2] = this.baseColors[i * 3 + 2];
      } else {
        // Fade unrelated stars toward the background so the focus stands out.
        arr[i * 3] = THREE.MathUtils.lerp(this.baseColors[i * 3], bg.r, 0.82);
        arr[i * 3 + 1] = THREE.MathUtils.lerp(this.baseColors[i * 3 + 1], bg.g, 0.82);
        arr[i * 3 + 2] = THREE.MathUtils.lerp(this.baseColors[i * 3 + 2], bg.b, 0.82);
      }
    }
    attr.needsUpdate = true;

    // Selection marker.
    const selIdx = selectedId != null ? this.idToIndex.get(selectedId) : undefined;
    if (selIdx != null) {
      this.marker.position.set(
        this.positions[selIdx * 3],
        this.positions[selIdx * 3 + 1],
        this.positions[selIdx * 3 + 2],
      );
      this.marker.visible = true;
    } else {
      this.marker.visible = false;
    }

    this.rebuildLabels(selectedId, emphasized);
    this.invalidate();
  }

  setTheme(theme: UniverseTheme): void {
    this.theme = theme;
    this.scene.background = new THREE.Color(theme.background);
    (this.marker.material as THREE.SpriteMaterial).color.set(theme.marker);
    if (this.lines) {
      (this.lines.material as THREE.LineBasicMaterial).color.set(theme.edge);
    }
    for (const el of this.labelEls.values()) el.style.color = theme.label;
    this.invalidate();
  }

  /** Re-frame the camera to fit the whole scene. */
  frame(center?: THREE.Vector3, radius?: number): void {
    const b = center && radius ? { center, radius } : boundsOf(this.positions);
    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = (b.radius / Math.sin(fov / 2)) * 1.15;
    const dir = new THREE.Vector3(0.55, 0.4, 1).normalize();
    this.camera.position.copy(b.center).add(dir.multiplyScalar(dist));
    this.camera.near = Math.max(0.1, dist * 0.01);
    this.camera.far = dist * 8 + b.radius * 4;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(b.center);
    this.controls.update();
    this.invalidate();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.controls.removeEventListener("change", this.invalidate);
    this.controls.removeEventListener("start", this.handleStart);
    this.controls.removeEventListener("end", this.handleEnd);
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.handleDown);
    el.removeEventListener("pointerup", this.handleUp);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.resizeObs.disconnect();
    this.disposePoints();
    this.disposeLines();
    this.controls.dispose();
    this.disc.dispose();
    this.ring.dispose();
    (this.marker.material as THREE.SpriteMaterial).dispose();
    this.scene.remove(this.marker);
    for (const node of this.labelEls.values()) node.remove();
    this.labelEls.clear();
    this.renderer.dispose();
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  // ---- internals ------------------------------------------------------------

  private buildEdges(edges: AtharEdge[]): void {
    const segs: number[] = [];
    let drawn = 0;
    for (const e of edges) {
      if (drawn >= EDGE_BUDGET) break;
      const a = this.idToIndex.get(e.from);
      const b = this.idToIndex.get(e.to);
      if (a == null || b == null) continue;
      segs.push(
        this.positions[a * 3],
        this.positions[a * 3 + 1],
        this.positions[a * 3 + 2],
        this.positions[b * 3],
        this.positions[b * 3 + 1],
        this.positions[b * 3 + 2],
      );
      drawn++;
    }
    if (segs.length === 0) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.theme.edge),
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(geom, mat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = -1;
    this.scene.add(this.lines);
  }

  private rebuildLabels(selectedId: string | null, emphasized: ReadonlySet<string> | null): void {
    const targets: LabelTarget[] = [];
    // Galaxy labels: always present, one per layer (≤ 8) — the map legend.
    for (const cl of this.clusters) {
      targets.push({
        id: `galaxy:${cl.layer}`,
        text: humanize(cl.layer),
        sub: `${cl.count}`,
        pos: new THREE.Vector3(cl.center.x, cl.center.y + cl.radius + this.pointSize * 2, cl.center.z),
        galaxy: true,
      });
    }
    // Node labels: the focus + its neighbourhood, capped and deterministic.
    if (emphasized) {
      const ids = [...emphasized]
        .filter((id) => this.idToIndex.has(id))
        .sort((a, b) => (a === selectedId ? -1 : b === selectedId ? 1 : a < b ? -1 : 1))
        .slice(0, LABEL_NODE_BUDGET);
      for (const id of ids) {
        const idx = this.idToIndex.get(id)!;
        targets.push({
          id: `node:${id}`,
          text: this.nodes[idx].label,
          sub: this.nodes[idx].type,
          pos: new THREE.Vector3(
            this.positions[idx * 3],
            this.positions[idx * 3 + 1] + this.pointSize * 1.6,
            this.positions[idx * 3 + 2],
          ),
          galaxy: false,
        });
      }
    }
    this.labelTargets = targets;

    // Reconcile DOM: reuse elements by id, drop the rest.
    const wanted = new Set(targets.map((t) => t.id));
    for (const [id, el] of this.labelEls) {
      if (!wanted.has(id)) {
        el.remove();
        this.labelEls.delete(id);
      }
    }
    for (const t of targets) {
      let el = this.labelEls.get(t.id);
      if (!el) {
        el = document.createElement("div");
        el.className = t.galaxy ? "uni-label galaxy" : "uni-label";
        el.style.color = this.theme.label;
        this.overlay.appendChild(el);
        this.labelEls.set(t.id, el);
      }
      el.textContent = t.galaxy ? `${t.text} · ${t.sub}` : t.text;
    }
  }

  private positionLabels(): void {
    const w = this.overlay.clientWidth;
    const h = this.overlay.clientHeight;
    const v = new THREE.Vector3();
    for (const t of this.labelTargets) {
      const el = this.labelEls.get(t.id);
      if (!el) continue;
      v.copy(t.pos).project(this.camera);
      if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) {
        el.style.display = "none";
        continue;
      }
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      el.style.display = "block";
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  private resize(): void {
    const width = Math.max(1, this.mount.clientWidth);
    const height = Math.max(1, this.mount.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  private pick(event: PointerEvent): void {
    if (!this.points || !this.onSelect) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.points, false);
    if (hits.length > 0 && hits[0].index != null) {
      const node = this.nodes[hits[0].index];
      if (node) this.onSelect(node);
    }
  }

  private handleDown = (e: PointerEvent): void => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private handleUp = (e: PointerEvent): void => {
    const d = this.down;
    this.down = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved < 5 && performance.now() - d.t < 500) this.pick(e);
  };

  private handleVisibility = (): void => {
    if (document.visibilityState === "visible") this.invalidate();
  };

  private handleStart = (): void => {
    this.interacting = true;
    this.invalidate();
  };

  private handleEnd = (): void => {
    this.interacting = false;
    this.invalidate();
  };

  /** Queue one frame (deduped). The frame re-arms itself while the camera eases. */
  private invalidate = (): void => {
    if (this.frameQueued || this.disposed) return;
    this.frameQueued = true;
    this.raf = requestAnimationFrame(this.renderFrame);
  };

  private renderFrame = (): void => {
    this.frameQueued = false;
    if (this.disposed) return;
    const moving = this.controls.update(); // true while damping is still easing
    this.renderer.render(this.scene, this.camera);
    this.positionLabels();
    if (moving || this.interacting) this.invalidate();
  };

  private disposePoints(): void {
    if (!this.points) return;
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.points = null;
  }

  private disposeLines(): void {
    if (!this.lines) return;
    this.scene.remove(this.lines);
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
    this.lines = null;
  }
}

export interface UniverseCanvasProps {
  nodes: AtharNode[];
  edges: AtharEdge[];
  selectedId?: string | null;
  highlight?: ReadonlySet<string> | null;
  colorMode?: "light" | "dark";
  fitSignal?: string;
  onSelectNode?: (node: AtharNode) => void;
}

export function UniverseCanvas(props: UniverseCanvasProps): ReactNode {
  const { nodes, edges, selectedId = null, highlight = null, colorMode = "light", fitSignal } = props;
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<UniverseEngine | null>(null);
  const onSelectRef = useRef(props.onSelectNode);
  onSelectRef.current = props.onSelectNode;
  const [failed, setFailed] = useState(false);

  const layout = useMemo(() => layout3d(nodes), [nodes]);
  const theme = THEMES[colorMode];

  // Which nodes to keep lit + label: the selection's neighbourhood, or a
  // highlighted edge's endpoints. Built here so the engine stays graph-agnostic.
  const emphasized = useMemo<ReadonlySet<string> | null>(() => {
    if (selectedId) {
      const adj = new Set<string>([selectedId]);
      for (const e of edges) {
        if (e.from === selectedId) adj.add(e.to);
        if (e.to === selectedId) adj.add(e.from);
      }
      return adj;
    }
    if (highlight) return highlight;
    return null;
  }, [selectedId, highlight, edges]);

  // Mount the engine exactly once; React effects below drive it via props.
  useEffect(() => {
    const mount = mountRef.current;
    const overlay = overlayRef.current;
    if (!mount || !overlay) return;
    let engine: UniverseEngine;
    try {
      engine = new UniverseEngine(mount, overlay, THEMES[colorMode]);
    } catch {
      setFailed(true);
      return;
    }
    engine.onSelect = (node) => onSelectRef.current?.(node);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // colorMode intentionally excluded: theme is applied via the effect below so
    // a theme switch never tears down the WebGL context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setData(nodes, edges, layout);
  }, [nodes, edges, layout]);

  useEffect(() => {
    engineRef.current?.setSelection(selectedId, emphasized);
  }, [selectedId, emphasized, nodes, edges]);

  useEffect(() => {
    engineRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (fitSignal !== undefined) engineRef.current?.frame();
  }, [fitSignal]);

  if (failed) {
    return (
      <div className="graph-wrap">
        <Empty
          icon={Orbit}
          title="3D view unavailable"
          hint="Your browser or device couldn't start WebGL. The 2D Graph view works everywhere."
        />
      </div>
    );
  }

  return (
    <div className="uni-wrap">
      <div ref={mountRef} className="uni-canvas" />
      <div ref={overlayRef} className="uni-overlay" aria-hidden />
      {nodes.length === 0 && (
        <div className="uni-empty">
          <Empty icon={Orbit} title="Nothing to show" hint="No nodes match the current filters." />
        </div>
      )}
    </div>
  );
}
