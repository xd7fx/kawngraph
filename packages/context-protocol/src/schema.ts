import type { ContextMode, Evidence, Layer, NodeType, RiskLevel } from "@kawngraph/shared";
import type { ProtocolCapabilities } from "./capabilities";

/**
 * The Universal Context Pack (UCP) — KawnGraph's agent-neutral wire format.
 *
 * The point of the protocol is portability: any coding agent (Claude, Codex,
 * Cursor, an in-house tool) can consume a pack without knowing how KawnGraph built
 * it. To make that possible, the shape is deliberately self-describing:
 *
 *   - sections are **role-tagged** (`primary`/`supporting`/`data`/`verification`)
 *     so a consumer can treat "must-read code" and "tables" generically;
 *   - every item explains **why** it's here, which **layer** it belongs to, its
 *     **evidence** (provenance), and its **rank** — the four things an agent
 *     needs to decide whether and how to use it;
 *   - the producer advertises its **capabilities** and **protocol version** so a
 *     reader can negotiate rather than guess.
 */

export interface UcpLocation {
  /** repo-relative path to read */
  path: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface UcpRank {
  /** relevance score (higher = more relevant) */
  score: number;
  /** 1-based position within the item's section (1 = most relevant) */
  position: number;
}

/** A single recommended piece of context. Vendor-neutral and self-explaining. */
export interface UcpItem {
  /** stable, content-addressable KawnGraph node id */
  id: string;
  /** what kind of thing this is */
  kind: NodeType;
  /** human-readable label */
  label: string;
  /** which project layer this belongs to */
  layer: Layer;
  /** where to read it */
  location: UcpLocation;
  /** WHY it earned a place in the pack (deterministic, human-readable) */
  why: string;
  /** how it ranked */
  rank: UcpRank;
  /** provenance — never empty; at minimum the item's own source location */
  evidence: Evidence[];
  /** rough tokens an agent spends reading what this points at */
  tokensEstimate: number;
}

/** Semantic role of a section, so consumers can treat sections generically. */
export type UcpSectionRole = "primary" | "supporting" | "data" | "verification";

/** A named, ordered bucket of items (most relevant first). */
export interface UcpSection {
  /** machine id, e.g. `must_read`, `related_docs`, `tables`, `tests` */
  id: string;
  /** display title */
  title: string;
  /** semantic role */
  role: UcpSectionRole;
  items: UcpItem[];
}

export interface UcpRisk {
  level: RiskLevel;
  kind: string;
  message: string;
  nodeId?: string;
  evidence?: Evidence;
}

export interface UcpExclusion {
  id: string;
  label: string;
  reason: string;
}

export interface UcpBudget {
  /** requested token budget */
  limit: number;
  /** estimated tokens the included items use */
  used: number;
}

/** Who produced the pack and when — so a consumer knows what it's reading. */
export interface UcpProvenance {
  /** the tool that produced the pack (e.g. `kawn`) */
  producer: string;
  /** KawnGraph version that produced it */
  kawnVersion: string;
  /** ISO-8601 timestamp */
  generatedAt: string;
}

/**
 * The top-level Universal Context Pack. See the file header for the design
 * rationale. This is what crosses the boundary between KawnGraph and any agent.
 */
export interface UniversalContextPack {
  /** protocol version (`major.minor`) */
  protocolVersion: string;
  /** the task the pack was built for */
  task: string;
  /** retrieval mode used to build it */
  mode: ContextMode;
  /** 0..1 — how much to trust this pack */
  confidence: number;
  budget: UcpBudget;
  provenance: UcpProvenance;
  /** producer guarantees (evidence/ranking/determinism/…) */
  capabilities: ProtocolCapabilities;
  /** role-tagged, ordered buckets — nothing mixed blindly */
  sections: UcpSection[];
  risks: UcpRisk[];
  /** items considered but left out, each with a reason */
  excluded: UcpExclusion[];
}

/**
 * Map a node kind to its project layer. Used as a fallback when a pack is
 * converted without the originating graph (the graph is the source of truth for
 * a node's layer; this keeps conversion lossless-enough when it is absent).
 */
export function layerForNodeType(type: NodeType): Layer {
  switch (type) {
    case "file":
    case "symbol":
    case "function":
    case "class":
    case "route":
    case "env":
      return "code";
    case "table":
    case "migration":
      return "data";
    case "doc":
    case "section":
      return "docs";
    case "decision":
      return "decision";
    case "image":
    case "diagram":
      return "visual";
    case "package":
      return "config";
    case "test":
      return "test";
    default:
      return "code";
  }
}
