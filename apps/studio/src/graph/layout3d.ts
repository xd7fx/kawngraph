/**
 * Deterministic 3D "universe" layout: each layer becomes a galaxy (a filled
 * sphere of nodes), and the galaxies are spaced evenly around a ring so the
 * layer structure of the repo reads at a glance. Pure and React/Three-free —
 * identical input always yields identical positions, so the universe is stable
 * across reloads and the math is unit-testable on its own.
 *
 * No physics, no randomness: node placement inside a galaxy uses a golden-angle
 * spherical spiral (a Fibonacci ball), which fills space evenly and cheaply for
 * any count — the key to scaling to thousands of nodes without a layout solver.
 */
import type { KawnNode } from "../types";
import { layerOrderIndex } from "./nodeStyle";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** One layer rendered as a galaxy: a center, a radius, and how many nodes. */
export interface GalaxyCluster {
  layer: string;
  center: Vec3;
  radius: number;
  count: number;
}

export interface Layout3D {
  /** node id → world position */
  positions: Map<string, Vec3>;
  /** per-layer galaxy metadata (for labels and camera framing) */
  clusters: GalaxyCluster[];
  /** radius of the whole scene (max distance from origin to any node) */
  sceneRadius: number;
}

/** Golden angle (radians) — the irrational turn that spreads points evenly. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const CLUSTER_BASE = 26; // base galaxy radius before the count scaling
const CLUSTER_MIN = 12; // smallest galaxy radius (so tiny layers aren't dots)
const MIN_RING = 90; // smallest ring the galaxies sit on
const RING_SPACING = 1.5; // padding factor so neighbouring galaxies don't touch

/** Galaxy radius for a node count — grows with the cube root so density is even. */
function clusterRadiusFor(count: number): number {
  return Math.max(CLUSTER_MIN, CLUSTER_BASE * Math.cbrt(Math.max(1, count)));
}

/**
 * Place a node within its galaxy using a deterministic Fibonacci-ball spiral.
 * `k` is the node's index, `count` the galaxy size, `radius` its extent.
 */
function ballOffset(k: number, count: number, radius: number): Vec3 {
  if (count <= 1) return { x: 0, y: 0, z: 0 };
  // Even radial fill: cube-root keeps density uniform from core to rim.
  const rr = radius * Math.cbrt((k + 0.5) / count);
  // Direction: a point on the unit sphere from the golden-angle spiral.
  const zc = 1 - (2 * (k + 0.5)) / count; // latitude in [-1, 1]
  const rho = Math.sqrt(Math.max(0, 1 - zc * zc));
  const theta = k * GOLDEN_ANGLE;
  return {
    x: rr * rho * Math.cos(theta),
    y: rr * zc,
    z: rr * rho * Math.sin(theta),
  };
}

export function layout3d(nodes: readonly KawnNode[]): Layout3D {
  // Group nodes by layer.
  const byLayer = new Map<string, KawnNode[]>();
  for (const n of nodes) {
    let arr = byLayer.get(n.layer);
    if (!arr) {
      arr = [];
      byLayer.set(n.layer, arr);
    }
    arr.push(n);
  }

  // Deterministic layer order: the canonical layer order, then alphabetical.
  const layers = [...byLayer.keys()].sort(
    (a, b) => layerOrderIndex(a) - layerOrderIndex(b) || (a < b ? -1 : a > b ? 1 : 0),
  );

  // Size every galaxy first so we can size the ring to avoid overlap.
  const radii = layers.map((l) => clusterRadiusFor(byLayer.get(l)!.length));
  const circumferenceNeed = radii.reduce((s, r) => s + 2 * r * RING_SPACING, 0);
  const ringRadius = Math.max(MIN_RING, circumferenceNeed / (2 * Math.PI));

  const positions = new Map<string, Vec3>();
  const clusters: GalaxyCluster[] = [];
  let sceneRadius = 0;

  layers.forEach((layer, i) => {
    const arr = byLayer.get(layer)!;
    arr.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const radius = radii[i];

    // Galaxy center: evenly spaced around the ring, with a gentle vertical
    // stagger so adjacent galaxies separate in depth as well as around the ring.
    const angle = layers.length > 0 ? (i / layers.length) * Math.PI * 2 : 0;
    const center: Vec3 = {
      x: Math.cos(angle) * ringRadius,
      y: (i % 2 === 0 ? 1 : -1) * radius * 0.35,
      z: Math.sin(angle) * ringRadius,
    };
    clusters.push({ layer, center, radius, count: arr.length });

    arr.forEach((node, k) => {
      const off = ballOffset(k, arr.length, radius);
      const p: Vec3 = { x: center.x + off.x, y: center.y + off.y, z: center.z + off.z };
      positions.set(node.id, p);
      const dist = Math.hypot(p.x, p.y, p.z);
      if (dist > sceneRadius) sceneRadius = dist;
    });
  });

  return { positions, clusters, sceneRadius: sceneRadius || MIN_RING };
}
