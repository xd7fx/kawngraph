/**
 * Deterministic force-directed 2D layout for the constellation Map view — a flat
 * cousin of the 3D "universe". Connected nodes attract, all nodes repel, and a
 * gentle gravity keeps the cloud centered, so the graph spreads ORGANICALLY in
 * the plane (a star-map) instead of stacking into columns.
 *
 * Determinism: positions are seeded from a hash of each node id (no Math.random)
 * and the simulation runs a fixed number of cooling iterations, so the same graph
 * always settles to the same constellation across reloads. Repulsion uses a
 * spatial grid (only nearby cells), so it stays roughly O(n) and scales past the
 * Map view's node cap. Pure + React-free, so it is unit-testable on its own.
 */
import type { KawnEdge, KawnNode } from "../types";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Layout2D {
  /** node id → plane position */
  positions: Map<string, Vec2>;
  /** node id → edge degree (drives node radius / importance) */
  degrees: Map<string, number>;
  /** half-extent of the laid-out cloud (max |coord|), for fit-to-view framing */
  radius: number;
}

/** Stable 32-bit hash of a string → float in [0, 1). No randomness. */
function hash01(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export function layout2d(
  nodes: readonly KawnNode[],
  edges: readonly KawnEdge[],
  opts?: { iterations?: number },
): Layout2D {
  const n = nodes.length;
  const positions = new Map<string, Vec2>();
  const degrees = new Map<string, number>();
  if (n === 0) return { positions, degrees, radius: 1 };
  if (n === 1) {
    positions.set(nodes[0].id, { x: 0, y: 0 });
    degrees.set(nodes[0].id, 0);
    return { positions, degrees, radius: 1 };
  }

  const index = new Map<string, number>();
  nodes.forEach((nd, i) => index.set(nd.id, i));

  const px = new Float64Array(n);
  const py = new Float64Array(n);
  // Deterministic seed: a golden-angle spiral (even spread) jittered per id so
  // the simulation starts from a stable, non-degenerate cloud.
  const GA = Math.PI * (3 - Math.sqrt(5));
  const seedR = 14 * Math.sqrt(n);
  for (let i = 0; i < n; i++) {
    const a = i * GA;
    const r = seedR * Math.sqrt((i + 0.5) / n);
    const j = hash01(nodes[i].id);
    px[i] = r * Math.cos(a) + (j - 0.5) * 12;
    py[i] = r * Math.sin(a) + (hash01(nodes[i].id + "#y") - 0.5) * 12;
  }

  // Links as index pairs (skip self-loops + dangling); accumulate degree.
  const deg = new Int32Array(n);
  const links: Array<[number, number]> = [];
  for (const e of edges) {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    links.push([a, b]);
    deg[a]++;
    deg[b]++;
  }

  const K = 42; // ideal node spacing
  const repK = K * K * 0.9; // repulsion strength
  const spring = 0.045; // link stiffness
  const gravity = 0.015; // pull toward origin
  const iterations = opts?.iterations ?? (n > 500 ? 160 : 320);

  const fx = new Float64Array(n);
  const fy = new Float64Array(n);
  const cell = K * 1.6; // spatial-grid cell ≈ repulsion cutoff
  const cutoff2 = (cell * 1.5) * (cell * 1.5);

  for (let it = 0; it < iterations; it++) {
    fx.fill(0);
    fy.fill(0);
    const cool = 1 - it / iterations;

    // --- repulsion via a spatial hash grid (only neighbouring cells) ---
    const grid = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(px[i] / cell);
      const cy = Math.floor(py[i] / cell);
      const key = cx + "," + cy;
      const b = grid.get(key);
      if (b) b.push(i);
      else grid.set(key, [i]);
    }
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(px[i] / cell);
      const cy = Math.floor(py[i] / cell);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = grid.get(gx + "," + gy);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j <= i) continue;
            let dx = px[i] - px[j];
            let dy = py[i] - py[j];
            let d2 = dx * dx + dy * dy;
            if (d2 > cutoff2) continue;
            if (d2 < 0.01) {
              // coincident: deterministic tiny shove
              dx = hash01(i + ":" + j) - 0.5;
              dy = hash01(j + ":" + i) - 0.5;
              d2 = dx * dx + dy * dy + 0.01;
            }
            const f = repK / d2;
            const inv = 1 / Math.sqrt(d2);
            const ux = dx * inv;
            const uy = dy * inv;
            fx[i] += ux * f;
            fy[i] += uy * f;
            fx[j] -= ux * f;
            fy[j] -= uy * f;
          }
        }
      }
    }

    // --- link springs (attraction toward ideal length K) ---
    for (const [a, b] of links) {
      let dx = px[b] - px[a];
      let dy = py[b] - py[a];
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - K) * spring;
      const ux = dx / d;
      const uy = dy / d;
      fx[a] += ux * f;
      fy[a] += uy * f;
      fx[b] -= ux * f;
      fy[b] -= uy * f;
    }

    // --- gravity toward the origin (keeps disconnected bits from drifting) ---
    for (let i = 0; i < n; i++) {
      fx[i] -= px[i] * gravity;
      fy[i] -= py[i] * gravity;
    }

    // --- integrate with cooling + a max step so it settles, not explodes ---
    const maxStep = 26 * cool + 1.5;
    for (let i = 0; i < n; i++) {
      let vx = fx[i];
      let vy = fy[i];
      const vm = Math.sqrt(vx * vx + vy * vy);
      if (vm > maxStep) {
        vx = (vx / vm) * maxStep;
        vy = (vy / vm) * maxStep;
      }
      px[i] += vx;
      py[i] += vy;
    }
  }

  // Center on the centroid and record positions + degree + extent.
  let cxs = 0;
  let cys = 0;
  for (let i = 0; i < n; i++) {
    cxs += px[i];
    cys += py[i];
  }
  cxs /= n;
  cys /= n;
  let radius = 1;
  for (let i = 0; i < n; i++) {
    const x = px[i] - cxs;
    const y = py[i] - cys;
    positions.set(nodes[i].id, { x, y });
    degrees.set(nodes[i].id, deg[i]);
    radius = Math.max(radius, Math.abs(x), Math.abs(y));
  }
  return { positions, degrees, radius };
}
