import type { UniversalContextPack } from "./schema";
import { assertUniversalPack } from "./validate";

export interface ToJsonOptions {
  /** pretty-print with 2-space indentation (default true) */
  pretty?: boolean;
}

/**
 * Serialize a pack to a **canonical** JSON string: object keys are emitted in
 * sorted order at every level, so two packs with identical content produce
 * byte-identical JSON regardless of how the objects were built. That makes the
 * output safe to hash, cache, and diff.
 */
export function toJson(pack: UniversalContextPack, opts: ToJsonOptions = {}): string {
  const pretty = opts.pretty ?? true;
  return JSON.stringify(canonicalize(pack), null, pretty ? 2 : undefined);
}

/**
 * Parse and validate a JSON string into a {@link UniversalContextPack}. Throws
 * if the JSON is malformed or the value is not a valid, major-compatible pack —
 * a consumer should never act on an unvalidated pack.
 */
export function parseJson(text: string): UniversalContextPack {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (err) {
    throw new Error(`UniversalContextPack: invalid JSON — ${(err as Error).message}`);
  }
  return assertUniversalPack(value);
}

/** Recursively sort object keys; arrays keep their (meaningful) order. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
