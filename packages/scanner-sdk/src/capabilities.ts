/**
 * Capability declarations. A plugin states up front which node and edge types it
 * can emit, whether it carries evidence, whether it resolves imports, and whether
 * it contributes cross-file edges. The registry validates output against these and
 * the Studio legend can be built from registered plugins instead of hard-coding.
 */
import type { NodeType, EdgeType } from "@kawngraph/shared";

export interface ScannerCapabilities {
  /** node types this plugin can emit */
  nodeTypes: NodeType[];
  /** edge types this plugin can emit */
  edgeTypes: EdgeType[];
  /** true if every edge it emits carries Evidence */
  emitsEvidence: boolean;
  /** true if it resolves relative imports (its files form the import target set) */
  resolvesImports?: boolean;
  /** true if it contributes cross-file edges in finalize() */
  crossFile?: boolean;
}

/** Union of node/edge types across a set of plugins. Deterministic (sorted). */
export function mergeCapabilities(caps: ScannerCapabilities[]): {
  nodeTypes: NodeType[];
  edgeTypes: EdgeType[];
} {
  const nodeTypes = new Set<NodeType>();
  const edgeTypes = new Set<EdgeType>();
  for (const c of caps) {
    for (const n of c.nodeTypes) nodeTypes.add(n);
    for (const e of c.edgeTypes) edgeTypes.add(e);
  }
  return {
    nodeTypes: [...nodeTypes].sort(),
    edgeTypes: [...edgeTypes].sort(),
  };
}
