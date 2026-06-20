/**
 * Deterministic, seedable randomness. The A/B order is randomized per repeat so
 * neither condition is systematically advantaged by ordering effects (caches,
 * warm-up), yet a given `--seed` reproduces the exact same schedule — essential
 * for a benchmark you can re-run and trust.
 */
import type { Condition } from "./types";

/** mulberry32 — tiny, fast, well-distributed 32-bit PRNG. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A reusable RNG with the helpers the runner needs. */
export class Rng {
  private readonly next: () => number;
  constructor(public readonly seed: number) {
    this.next = makeRng(seed);
  }
  /** float in [0, 1) */
  float(): number {
    return this.next();
  }
  /** true with probability 0.5 */
  coin(): boolean {
    return this.next() < 0.5;
  }
  /** Fisher–Yates shuffle (returns a new array) */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

/** Randomized A/B order for a single repeat: ["with","without"] or ["without","with"]. */
export function conditionOrder(rng: Rng): Condition[] {
  return rng.coin() ? ["with", "without"] : ["without", "with"];
}
