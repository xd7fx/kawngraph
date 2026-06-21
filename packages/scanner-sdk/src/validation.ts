/**
 * Static plugin validation (before registration) and contribution validation
 * (after each scan). Validation NEVER throws — for ANY input, including a null,
 * non-object, or otherwise malformed contribution — it returns cleaned output
 * plus diagnostics. The registry calls validateContribution OUTSIDE its per-file
 * try/catch and relies on this guarantee: one bad plugin or one malformed file
 * can never abort a scan.
 */
import type { KawnEdge, KawnNode } from "@kawngraph/shared";
import type { ScannerPlugin } from "./plugin";
import type { ScannerCapabilities } from "./capabilities";
import { SCANNER_API_VERSION, type PluginDiagnostic, type ScanContribution } from "./types";
import { diag } from "./diagnostics";

/** Major version of an apiVersion string ("1", "1.2" -> "1"). */
export function majorOf(v: string): string {
  const m = /^(\d+)/.exec(String(v ?? "").trim());
  return m ? m[1] : "";
}

/** A plugin is compatible if its apiVersion MAJOR equals the SDK's. */
export function isApiCompatible(apiVersion: string): boolean {
  const major = majorOf(apiVersion);
  return major !== "" && major === majorOf(SCANNER_API_VERSION);
}

export interface PluginValidation {
  ok: boolean;
  diagnostics: PluginDiagnostic[];
}

/** Validate a plugin's static shape before registration. */
export function validatePlugin(plugin: ScannerPlugin | null | undefined): PluginValidation {
  const ds: PluginDiagnostic[] = [];
  const id = plugin?.id;
  if (!id || typeof id !== "string") {
    ds.push(diag("error", "plugin has no id", { code: "no_id" }));
  }
  if (!plugin || typeof plugin.detect !== "function") {
    ds.push(diag("error", "plugin.detect is not a function", { pluginId: id, code: "no_detect" }));
  }
  if (!plugin || typeof plugin.scan !== "function") {
    ds.push(diag("error", "plugin.scan is not a function", { pluginId: id, code: "no_scan" }));
  }
  if (plugin && plugin.finalize !== undefined && typeof plugin.finalize !== "function") {
    ds.push(diag("error", "plugin.finalize is defined but is not a function", { pluginId: id, code: "bad_finalize" }));
  }
  if (!plugin || !isApiCompatible(plugin.apiVersion)) {
    ds.push(
      diag("error", `plugin targets incompatible apiVersion "${plugin?.apiVersion}" (sdk ${SCANNER_API_VERSION})`, {
        pluginId: id,
        code: "api_incompatible",
      }),
    );
  }
  if (plugin && plugin.capabilities == null) {
    ds.push(diag("error", "plugin has no capabilities", { pluginId: id, code: "no_capabilities" }));
  } else if (plugin && (!Array.isArray(plugin.capabilities.nodeTypes) || !Array.isArray(plugin.capabilities.edgeTypes))) {
    // capabilities.nodeTypes/edgeTypes drive output validation and the merged
    // legend; a non-array would crash mergeCapabilities and make enforcement a
    // no-op, so reject rather than limp along.
    ds.push(
      diag("error", "plugin.capabilities.nodeTypes and .edgeTypes must both be arrays", {
        pluginId: id,
        code: "bad_capabilities",
      }),
    );
  }
  // `order` drives the deterministic phase sort; a non-finite value (NaN/Infinity)
  // makes the comparator non-deterministic, defeating the SDK's core guarantee.
  if (plugin && plugin.order !== undefined && !Number.isFinite(plugin.order)) {
    ds.push(
      diag("error", `plugin.order must be a finite number (got ${String(plugin.order)})`, {
        pluginId: id,
        code: "bad_order",
      }),
    );
  }
  return { ok: !ds.some((d) => d.level === "error"), diagnostics: ds };
}

/**
 * Validate and clean one contribution. NEVER throws, for ANY input:
 *  - a non-object contribution (null, string, …) yields an empty contribution + a diagnostic
 *  - a non-array `nodes`/`edges` is treated as empty + a diagnostic
 *  - nodes/edges that are not objects, or that lack id/from/to, are dropped (diagnostic)
 *  - nodes are deduped by id and edges by id within the contribution (first wins)
 *  - an edge without evidence is WARNED (not dropped) — every relationship SHOULD
 *    carry evidence; we surface it rather than silently discarding real data.
 *  - when `capabilities` is supplied (the registry passes the plugin's), a node or
 *    edge whose `type` the plugin did not declare is WARNED (not dropped): the
 *    declaration is the contract, but honest surfacing beats losing real graph data
 *    the plugin merely forgot to declare. This is the output validation the
 *    capabilities contract promises.
 */
export function validateContribution(
  contrib: ScanContribution,
  pluginId: string,
  capabilities?: ScannerCapabilities,
): { contribution: ScanContribution; diagnostics: PluginDiagnostic[] } {
  const ds: PluginDiagnostic[] = [];

  if (!contrib || typeof contrib !== "object") {
    ds.push(
      diag("warn", "scan returned a non-object contribution (ignored)", { pluginId, code: "malformed_contribution" }),
    );
    return { contribution: { nodes: [], edges: [] }, diagnostics: ds };
  }

  const rawNodes = contrib.nodes;
  const rawEdges = contrib.edges;
  if (rawNodes != null && !Array.isArray(rawNodes)) {
    ds.push(diag("warn", "contribution.nodes is not an array (treated as empty)", { pluginId, code: "malformed_nodes" }));
  }
  if (rawEdges != null && !Array.isArray(rawEdges)) {
    ds.push(diag("warn", "contribution.edges is not an array (treated as empty)", { pluginId, code: "malformed_edges" }));
  }
  const nodeList: unknown[] = Array.isArray(rawNodes) ? rawNodes : [];
  const edgeList: unknown[] = Array.isArray(rawEdges) ? rawEdges : [];

  // Declared-type sets for capability enforcement (skip if not supplied/valid).
  const okNodeType = capabilities && Array.isArray(capabilities.nodeTypes) ? new Set<string>(capabilities.nodeTypes) : null;
  const okEdgeType = capabilities && Array.isArray(capabilities.edgeTypes) ? new Set<string>(capabilities.edgeTypes) : null;

  const nodes: KawnNode[] = [];
  const seenNode = new Set<string>();
  for (const raw of nodeList) {
    const n = raw as KawnNode | null | undefined;
    if (!n || typeof n !== "object" || !n.id) {
      ds.push(diag("warn", "node with empty id dropped", { pluginId, code: "empty_node_id" }));
      continue;
    }
    if (seenNode.has(n.id)) {
      ds.push(diag("info", `duplicate node id ${n.id} (kept first)`, { pluginId, code: "dup_node" }));
      continue;
    }
    seenNode.add(n.id);
    if (okNodeType && !okNodeType.has(n.type)) {
      ds.push(
        diag("warn", `node ${n.id} has undeclared type "${String(n.type)}"`, { pluginId, code: "node_type_undeclared" }),
      );
    }
    nodes.push(n);
  }

  const edges: KawnEdge[] = [];
  const seenEdge = new Set<string>();
  for (const raw of edgeList) {
    const e = raw as KawnEdge | null | undefined;
    if (!e || typeof e !== "object" || !e.id || !e.from || !e.to) {
      ds.push(diag("warn", "edge with empty id/from/to dropped", { pluginId, code: "empty_edge" }));
      continue;
    }
    if (seenEdge.has(e.id)) {
      ds.push(diag("info", `duplicate edge id ${e.id} (kept first)`, { pluginId, code: "dup_edge" }));
      continue;
    }
    seenEdge.add(e.id);
    if (okEdgeType && !okEdgeType.has(e.type)) {
      ds.push(
        diag("warn", `edge ${e.id} has undeclared type "${String(e.type)}"`, { pluginId, code: "edge_type_undeclared" }),
      );
    }
    if (!e.evidence) {
      ds.push(diag("warn", `edge ${e.id} has no evidence`, { pluginId, code: "missing_evidence" }));
    }
    edges.push(e);
  }

  return {
    contribution: {
      nodes,
      edges,
      unresolved: contrib.unresolved,
      diagnostics: contrib.diagnostics,
      data: contrib.data,
    },
    diagnostics: ds,
  };
}
