import type { ProtocolCapabilities } from "./capabilities";
import { CONTEXT_PROTOCOL_VERSION, isProtocolCompatible } from "./version";

/** The boolean guarantees a consumer can require a producer to advertise. */
export type CapabilityFlag =
  | "evidence"
  | "explanations"
  | "ranking"
  | "tokenBudget"
  | "layeredSections"
  | "deterministic"
  | "noLlm";

/**
 * What a consumer needs from a pack before it will rely on it. Everything is
 * optional: an empty `needs` only checks major-version compatibility.
 */
export interface ConsumerNeeds {
  /** capability flags that must be advertised as `true` */
  require?: CapabilityFlag[];
  /** node kinds the consumer can handle — the producer must not emit any others */
  nodeKinds?: string[];
  /** layers the consumer can handle — the producer must not emit any others */
  layers?: string[];
}

export interface NegotiationResult {
  /** true iff the consumer can safely rely on packs from this producer */
  ok: boolean;
  /** human-readable reasons it cannot (empty when ok) */
  reasons: string[];
}

/**
 * Decide whether a consumer can rely on a producer's packs — the API behind the
 * protocol's "advertise capabilities so a reader can **negotiate rather than
 * guess**" promise. Given the producer's advertised {@link ProtocolCapabilities}
 * and the consumer's {@link ConsumerNeeds}, it checks three things:
 *
 *   1. **version** — produced and consumer protocol versions share a major;
 *   2. **guarantees** — every required capability flag is advertised `true`;
 *   3. **coverage** — the producer never emits a node kind or layer the consumer
 *      did not say it can handle (the producer's advertised set must be a subset
 *      of the consumer's). Omitting `nodeKinds`/`layers` means "I handle anything".
 *
 * Pure and deterministic: it reads only the advertised capabilities, never a
 * model or the network, and reasons come back sorted for stable output.
 */
export function negotiate(
  produced: ProtocolCapabilities,
  needs: ConsumerNeeds = {},
  consumerVersion: string = CONTEXT_PROTOCOL_VERSION,
): NegotiationResult {
  const reasons: string[] = [];

  if (!isProtocolCompatible(produced.protocolVersion, consumerVersion)) {
    reasons.push(`protocol ${produced.protocolVersion} is not major-compatible with consumer ${consumerVersion}`);
  }

  for (const flag of needs.require ?? []) {
    if (!produced[flag]) reasons.push(`missing required capability: ${flag}`);
  }

  if (needs.nodeKinds) {
    const handled = new Set(needs.nodeKinds);
    const unhandled = produced.nodeKinds.filter((k) => !handled.has(k));
    if (unhandled.length > 0) {
      reasons.push(`producer may emit node kinds the consumer does not handle: ${unhandled.sort().join(", ")}`);
    }
  }

  if (needs.layers) {
    const handled = new Set(needs.layers);
    const unhandled = produced.layers.filter((l) => !handled.has(l));
    if (unhandled.length > 0) {
      reasons.push(`producer may emit layers the consumer does not handle: ${unhandled.sort().join(", ")}`);
    }
  }

  return { ok: reasons.length === 0, reasons: reasons.sort() };
}
