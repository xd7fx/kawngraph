/**
 * The celestial visual model for the KawnGraph Universe: a deterministic mapping
 * from a graph node's TYPE to the kind of "body" it is drawn as in the 3D view.
 * This is the vocabulary that makes a node's kind legible at a glance — a package
 * reads as a solar system, a source file as a planet, a code symbol as a moon, a
 * data table as a ringed planet, a test as a shield satellite, and everything
 * reference-like (docs, decisions, diagrams, env) as a star.
 *
 * Kept as PURE DATA with a single type-only import, exactly like the layered
 * layout maths — but deliberately split into its OWN module (rather than living
 * in `graph/nodeStyle.ts`) so it can be unit-tested under the headless CommonJS
 * test config WITHOUT pulling in the `lucide-react` icons that `nodeStyle.ts`
 * imports. The renderer turns {@link bodySize} into a per-point `gl_PointSize`
 * factor, so the whole graph keeps drawing in ONE `THREE.Points` call while
 * still showing a real size hierarchy by node kind.
 */
import type { NodeType } from "./types";

/** The fixed, bounded set of celestial archetypes a node can be drawn as. */
export type CelestialBody =
  | "solar-system" // a workspace package: the largest bodies, anchoring their deps
  | "ringed-planet" // a data table / migration: a planet with the rings of schema
  | "planet" // a source file: the everyday body the code galaxies are made of
  | "shield-satellite" // a test: a guard in orbit, protecting what it covers
  | "star" // docs / decisions / diagrams / env: luminous reference points
  | "moon"; // a symbol / function / class / route: small bodies orbiting a file

/**
 * Map a node type to its celestial body. Unknown or future types fall back to a
 * "star" so a new node kind still renders as a sensible reference point rather
 * than silently vanishing from the Universe.
 */
export function celestialBody(type: NodeType | string): CelestialBody {
  switch (type) {
    case "package":
      return "solar-system";
    case "table":
    case "migration":
      return "ringed-planet";
    case "file":
      return "planet";
    case "test":
      return "shield-satellite";
    case "symbol":
    case "function":
    case "class":
    case "route":
      return "moon";
    case "doc":
    case "section":
    case "decision":
    case "image":
    case "diagram":
    case "env":
      return "star";
    default:
      return "star";
  }
}

/**
 * Relative on-screen size per body, multiplied into the renderer's base point
 * size. The order encodes the hierarchy: a solar system dwarfs a planet, which
 * dwarfs its moons; tables sit a touch above plain files (schema is a landmark),
 * tests read clearly without shouting. `1.0` is the neutral "no change"
 * baseline, so the worst case (an all-star graph) renders exactly as before.
 */
export const BODY_SIZE: Record<CelestialBody, number> = {
  "solar-system": 2.2,
  "ringed-planet": 1.7,
  planet: 1.5,
  "shield-satellite": 1.15,
  star: 1.0,
  moon: 0.8,
};

/** The size multiplier for a node type, via its celestial body. */
export function bodySize(type: NodeType | string): number {
  return BODY_SIZE[celestialBody(type)];
}
