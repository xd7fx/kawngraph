/**
 * Frontend mirror of the Athar graph data model and the studio-server API
 * envelopes. These are TYPE SHAPES ONLY — all graph/query/context/impact logic
 * lives in @athar/core and is reached over the read-only HTTP API. We mirror the
 * interfaces (rather than importing the CommonJS package into this ESM app) to
 * keep the frontend build self-contained.
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

export type ContextMode = "code" | "docs" | "all";
export type RiskLevel = "low" | "medium" | "high";

export interface ContextItem {
  id: string;
  type: NodeType;
  label: string;
  sourcePath: string;
  lineStart?: number;
  lineEnd?: number;
  reason: string;
  score: number;
  tokensEstimate: number;
}

export interface ContextRisk {
  level: RiskLevel;
  kind: string;
  message: string;
  nodeId?: string;
  evidence?: Evidence;
}

export interface ContextExclusion {
  id: string;
  label: string;
  reason: string;
}

export interface ContextPack {
  atharVersion: string;
  generatedAt: string;
  task: string;
  mode: ContextMode;
  budget: number;
  tokensUsed: number;
  confidence: number;
  mustRead: ContextItem[];
  relatedDocs: ContextItem[];
  tables: ContextItem[];
  tests: ContextItem[];
  risks: ContextRisk[];
  excluded: ContextExclusion[];
}

// ---- API envelopes (exactly what @athar/studio-server returns) ----

export type GraphStatus = "ok" | "missing" | "malformed";

export interface HealthResponse {
  ok: boolean;
  status: GraphStatus;
  root: string;
  path: string;
  generatedAt?: string;
  nodes?: number;
  edges?: number;
  error?: string;
}

export interface TopConnected {
  id: string;
  label: string;
  type: NodeType;
  layer: Layer;
  degree: number;
}

export interface SummaryResponse {
  atharVersion: string;
  generatedAt: string;
  root: string;
  stats: GraphStats;
  topConnected: TopConnected[];
}

export interface QueryHit {
  node: AtharNode;
  score: number;
  reason: string;
}

export interface QueryResponse {
  query: string;
  mode: ContextMode;
  limit: number;
  count: number;
  hits: QueryHit[];
}

export interface AffectedNode {
  node: AtharNode;
  depth: number;
  via: string;
}

export interface AffectedResponse {
  query: string;
  depth: number;
  matched: AtharNode[];
  affected: AffectedNode[];
  files: string[];
}

export interface FlowStep {
  from: AtharNode;
  to: AtharNode;
  edge: AtharEdge;
  reversed: boolean;
}

export interface FlowResponse {
  from: string;
  to: string;
  found: boolean;
  nodes: AtharNode[];
  steps: FlowStep[];
}

/** A normalized API error (the server returns `{ error: string }` on 4xx). */
export interface ApiError {
  error: string;
  status: number;
}
