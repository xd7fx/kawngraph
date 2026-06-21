import type { Layer, NodeType } from "@kawngraph/shared";
import { CONTEXT_PROTOCOL_VERSION } from "./version";

/**
 * What a producer guarantees about the packs it emits. A consumer reads this to
 * decide how much to trust a pack and which generic features it can rely on,
 * without hard-coding knowledge of KawnGraph internals. Capabilities are advertised,
 * not assumed.
 */
export interface ProtocolCapabilities {
  /** the protocol version these capabilities describe */
  protocolVersion: string;
  /** every item carries inline provenance (`evidence` is never empty) */
  evidence: boolean;
  /** every item carries a deterministic, human-readable `why` */
  explanations: boolean;
  /** items are scored and ordered within each section */
  ranking: boolean;
  /** the pack is bounded by a token budget */
  tokenBudget: boolean;
  /** layers are kept in separate, role-tagged sections — never mixed blindly */
  layeredSections: boolean;
  /** identical (graph, task, budget, mode) inputs yield byte-identical packs */
  deterministic: boolean;
  /** no model/network is required to produce a pack */
  noLlm: boolean;
  /** node kinds this producer may emit */
  nodeKinds: NodeType[];
  /** layers this producer may emit */
  layers: Layer[];
}

/**
 * Capabilities of the built-in KawnGraph producer. KawnGraph is structural and
 * evidence-first, so every guarantee below is true by construction.
 */
export const KAWN_PROTOCOL_CAPABILITIES: ProtocolCapabilities = {
  protocolVersion: CONTEXT_PROTOCOL_VERSION,
  evidence: true,
  explanations: true,
  ranking: true,
  tokenBudget: true,
  layeredSections: true,
  deterministic: true,
  noLlm: true,
  nodeKinds: [
    "file",
    "symbol",
    "function",
    "class",
    "route",
    "table",
    "migration",
    "doc",
    "section",
    "decision",
    "image",
    "diagram",
    "package",
    "test",
    "env",
  ],
  layers: ["code", "data", "config", "docs", "visual", "decision", "test", "runtime"],
};
