import type { KawnGraph, ContextItem, ContextPack, Evidence } from "@kawngraph/shared";
import { KAWN_PROTOCOL_CAPABILITIES } from "./capabilities";
import {
  layerForNodeType,
  type UcpItem,
  type UcpLocation,
  type UcpSection,
  type UcpSectionRole,
  type UniversalContextPack,
} from "./schema";
import { CONTEXT_PROTOCOL_VERSION } from "./version";

export interface ToUniversalOptions {
  /**
   * The graph the pack was built from. When present, each item's `layer` and
   * `evidence` are enriched from the real node + the edges that connect it.
   * When absent, layer falls back to the node-kind mapping and evidence is the
   * item's own source location (still never empty).
   */
  graph?: KawnGraph;
  /** producer name recorded in provenance (default `kawn`) */
  producer?: string;
  /** max connecting-edge evidences attached per item (default 3) */
  maxEvidencePerItem?: number;
}

const DEFAULT_MAX_EVIDENCE = 3;

interface SectionSpec {
  id: string;
  title: string;
  role: UcpSectionRole;
  items: ContextItem[];
}

/**
 * Convert a core {@link ContextPack} into the agent-neutral
 * {@link UniversalContextPack}. Pure and deterministic: identical inputs yield
 * an identical pack. Nothing is invented — every item's evidence is grounded in
 * the node's own source and, when the graph is supplied, the edges that earned
 * it a place.
 */
export function toUniversalPack(pack: ContextPack, opts: ToUniversalOptions = {}): UniversalContextPack {
  const maxEvidence = opts.maxEvidencePerItem ?? DEFAULT_MAX_EVIDENCE;
  const nodesById = indexNodes(opts.graph);
  const edgeEvidence = indexEdgeEvidence(opts.graph);

  const toItem = (ci: ContextItem, position: number): UcpItem => {
    const node = nodesById.get(ci.id);
    const layer = node?.layer ?? layerForNodeType(ci.type);

    // Evidence always starts with the item's own location, then the (bounded,
    // deterministic, deduped) evidence of the edges that connect this node.
    const evidence: Evidence[] = [];
    const seen = new Set<string>();
    const push = (e: Evidence | undefined): void => {
      if (!e || !e.sourcePath) return;
      const key = `${e.sourcePath}:${e.lineStart ?? ""}:${e.lineEnd ?? ""}:${e.snippet ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      evidence.push(e);
    };
    push(lineScoped<Evidence>({ sourcePath: ci.sourcePath }, ci.lineStart, ci.lineEnd));
    for (const e of edgeEvidence.get(ci.id) ?? []) {
      if (evidence.length >= 1 + maxEvidence) break;
      push(e);
    }

    return {
      id: ci.id,
      kind: ci.type,
      label: ci.label,
      layer,
      location: lineScoped<UcpLocation>({ path: ci.sourcePath }, ci.lineStart, ci.lineEnd),
      why: ci.reason,
      rank: { score: ci.score, position },
      evidence,
      tokensEstimate: ci.tokensEstimate,
    };
  };

  const specs: SectionSpec[] = [
    { id: "must_read", title: "Must read", role: "primary", items: pack.mustRead },
    { id: "related_docs", title: "Related docs", role: "supporting", items: pack.relatedDocs },
    { id: "tables", title: "Tables", role: "data", items: pack.tables },
    { id: "tests", title: "Tests", role: "verification", items: pack.tests },
  ];

  const sections: UcpSection[] = specs.map((s) => ({
    id: s.id,
    title: s.title,
    role: s.role,
    items: s.items.map((ci, i) => toItem(ci, i + 1)),
  }));

  return {
    protocolVersion: CONTEXT_PROTOCOL_VERSION,
    task: pack.task,
    mode: pack.mode,
    confidence: pack.confidence,
    budget: { limit: pack.budget, used: pack.tokensUsed },
    provenance: {
      producer: opts.producer ?? "kawn",
      kawnVersion: pack.kawnVersion,
      generatedAt: pack.generatedAt,
    },
    capabilities: KAWN_PROTOCOL_CAPABILITIES,
    sections,
    risks: pack.risks.map((r) => ({
      level: r.level,
      kind: r.kind,
      message: r.message,
      ...(r.nodeId !== undefined ? { nodeId: r.nodeId } : {}),
      ...(r.evidence !== undefined ? { evidence: r.evidence } : {}),
    })),
    excluded: pack.excluded.map((e) => ({ id: e.id, label: e.label, reason: e.reason })),
  };
}

/**
 * Attach `lineStart`/`lineEnd` to a base object only when they are defined, so
 * the produced pack never carries explicit `undefined` keys. This keeps the
 * in-memory object identical to its JSON round-trip — a precondition for the
 * pack being canonically hashable and losslessly serializable.
 */
function lineScoped<T extends { lineStart?: number; lineEnd?: number }>(
  base: Omit<T, "lineStart" | "lineEnd">,
  lineStart: number | undefined,
  lineEnd: number | undefined,
): T {
  const out = { ...base } as T;
  if (lineStart !== undefined) out.lineStart = lineStart;
  if (lineEnd !== undefined) out.lineEnd = lineEnd;
  return out;
}

function indexNodes(graph?: KawnGraph): Map<string, KawnGraph["nodes"][number]> {
  const map = new Map<string, KawnGraph["nodes"][number]>();
  if (!graph) return map;
  for (const n of graph.nodes) map.set(n.id, n);
  return map;
}

/**
 * Index edge evidence by the node ids it touches. An edge's evidence explains a
 * relationship the node participates in (incoming or outgoing), which is exactly
 * the provenance a reader wants for "why is this item relevant". Sorted by edge
 * id so the attached evidence is deterministic.
 */
function indexEdgeEvidence(graph?: KawnGraph): Map<string, Evidence[]> {
  const map = new Map<string, Evidence[]>();
  if (!graph) return map;
  const edges = [...graph.edges].sort((a, b) => a.id.localeCompare(b.id));
  for (const e of edges) {
    if (!e.evidence) continue;
    for (const endpoint of [e.from, e.to]) {
      const list = map.get(endpoint) ?? [];
      list.push(e.evidence);
      map.set(endpoint, list);
    }
  }
  return map;
}
