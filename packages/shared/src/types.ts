/**
 * Core Athar graph data model.
 *
 * A project is represented as a directed graph of nodes and edges, organized
 * into layers. Every edge must carry evidence (see {@link Evidence}); nothing is
 * asserted without a source.
 */

export type Layer =
  | "code"
  | "data"
  | "config"
  | "docs"
  | "visual"
  | "decision"
  | "test"
  | "runtime";

export type NodeType =
  | "file"
  | "symbol"
  | "function"
  | "class"
  | "route"
  | "table"
  | "migration"
  | "doc"
  | "section"
  | "decision"
  | "image"
  | "diagram"
  | "package"
  | "test"
  | "env";

export type EdgeType =
  | "imports"
  | "exports"
  | "calls"
  | "defines"
  | "reads_table"
  | "writes_table"
  | "tests"
  | "documents"
  | "explains"
  | "mentions"
  | "depicts"
  | "belongs_to"
  | "references"
  | "changed_by"
  | "depends_on";

/**
 * How strongly we trust an edge.
 * - `extracted`: parsed directly from source (e.g. an AST import).
 * - `linked`: resolved by deterministic rules (relative import -> file).
 * - `semantic`: inferred by similarity/AI. Always opt-in.
 * - `manual`: asserted by a human.
 */
export type Confidence = "extracted" | "linked" | "semantic" | "manual";

export interface Evidence {
  sourcePath: string;
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;
}

export interface AtharNode {
  id: string;
  type: NodeType;
  layer: Layer;
  label: string;
  sourcePath: string;
  lineStart?: number;
  lineEnd?: number;
  metadata?: Record<string, unknown>;
}

export interface AtharEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  confidence: Confidence;
  evidence?: Evidence;
}

export interface GraphStats {
  nodes: number;
  edges: number;
  byLayer: Record<string, number>;
  byType: Record<string, number>;
  byEdgeType: Record<string, number>;
}

export interface AtharGraph {
  atharVersion: string;
  generatedAt: string;
  root: string;
  stats: GraphStats;
  nodes: AtharNode[];
  edges: AtharEdge[];
}

/** What every scanner returns: a bag of nodes and edges to merge into the graph. */
export interface ScanResult {
  nodes: AtharNode[];
  edges: AtharEdge[];
}

export const EMPTY_SCAN_RESULT: ScanResult = { nodes: [], edges: [] };
