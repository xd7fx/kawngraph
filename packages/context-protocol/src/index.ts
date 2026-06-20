/**
 * @athar/context-protocol — the Universal Context Protocol (UCP).
 *
 * An agent-neutral, versioned wire format for Athar's Context Pack. The core
 * builds a {@link import("@athar/shared").ContextPack}; this package turns it
 * into a portable {@link UniversalContextPack} that any coding agent can consume
 * without knowing Athar internals, render it to Markdown, serialize it
 * canonically, and validate it on the way back in.
 *
 * Nothing here is a model or a network call — conversion is pure and
 * deterministic, and every item stays grounded in evidence.
 */
export { CONTEXT_PROTOCOL_VERSION, parseProtocolVersion, isProtocolCompatible } from "./version";
export type { ProtocolVersion } from "./version";

export { ATHAR_PROTOCOL_CAPABILITIES } from "./capabilities";
export type { ProtocolCapabilities } from "./capabilities";

export { layerForNodeType } from "./schema";
export type {
  UniversalContextPack,
  UcpItem,
  UcpSection,
  UcpSectionRole,
  UcpLocation,
  UcpRank,
  UcpRisk,
  UcpExclusion,
  UcpBudget,
  UcpProvenance,
} from "./schema";

export { toUniversalPack } from "./fromContextPack";
export type { ToUniversalOptions } from "./fromContextPack";

export { validateUniversalPack, assertUniversalPack } from "./validate";
export type { ValidationResult } from "./validate";

export { toJson, parseJson } from "./json";
export type { ToJsonOptions } from "./json";

export { toMarkdown } from "./markdown";
