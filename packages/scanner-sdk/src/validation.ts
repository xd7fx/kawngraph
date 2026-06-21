/**
 * Static plugin validation (before registration) and contribution validation
 * (after each scan). Validation never throws — it returns cleaned output plus
 * diagnostics, so one bad plugin or one malformed file can never abort a scan.
 */
import type { KawnEdge, KawnNode } from "@kawngraph/shared";
import type { ScannerPlugin } from "./plugin";
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
  }
  return { ok: !ds.some((d) => d.level === "error"), diagnostics: ds };
}

/**
 * Validate and clean one contribution:
 *  - drop nodes/edges with empty id/from/to (diagnostic), keeping the rest
 *  - dedup nodes by id and edges by id within the contribution (first wins)
 *  - warn (do NOT drop) when an edge lacks evidence — every relationship SHOULD
 *    carry evidence; we surface it rather than silently discarding real data.
 */
export function validateContribution(
  contrib: ScanContribution,
  pluginId: string,
): { contribution: ScanContribution; diagnostics: PluginDiagnostic[] } {
  const ds: PluginDiagnostic[] = [];

  const nodes: KawnNode[] = [];
  const seenNode = new Set<string>();
  for (const n of contrib.nodes ?? []) {
    if (!n?.id) {
      ds.push(diag("warn", "node with empty id dropped", { pluginId, code: "empty_node_id" }));
      continue;
    }
    if (seenNode.has(n.id)) {
      ds.push(diag("info", `duplicate node id ${n.id} (kept first)`, { pluginId, code: "dup_node" }));
      continue;
    }
    seenNode.add(n.id);
    nodes.push(n);
  }

  const edges: KawnEdge[] = [];
  const seenEdge = new Set<string>();
  for (const e of contrib.edges ?? []) {
    if (!e?.id || !e.from || !e.to) {
      ds.push(diag("warn", "edge with empty id/from/to dropped", { pluginId, code: "empty_edge" }));
      continue;
    }
    if (seenEdge.has(e.id)) {
      ds.push(diag("info", `duplicate edge id ${e.id} (kept first)`, { pluginId, code: "dup_edge" }));
      continue;
    }
    seenEdge.add(e.id);
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
