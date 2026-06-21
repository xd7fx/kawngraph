/**
 * Frontend mirror of the KawnGraph graph data model and the studio-server API
 * envelopes. These are TYPE SHAPES ONLY — all graph/query/context/impact logic
 * lives in @kawngraph/core and is reached over the read-only HTTP API. We mirror the
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

export interface KawnNode {
  id: string;
  type: NodeType;
  layer: Layer;
  label: string;
  sourcePath: string;
  lineStart?: number;
  lineEnd?: number;
  metadata?: Record<string, unknown>;
}

export interface KawnEdge {
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

export interface KawnGraph {
  kawnVersion: string;
  generatedAt: string;
  root: string;
  stats: GraphStats;
  nodes: KawnNode[];
  edges: KawnEdge[];
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
  kawnVersion: string;
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

// ---- API envelopes (exactly what @kawngraph/studio-server returns) ----

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
  kawnVersion: string;
  generatedAt: string;
  root: string;
  stats: GraphStats;
  topConnected: TopConnected[];
}

export interface QueryHit {
  node: KawnNode;
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
  node: KawnNode;
  depth: number;
  via: string;
}

export interface AffectedResponse {
  query: string;
  depth: number;
  matched: KawnNode[];
  affected: AffectedNode[];
  files: string[];
}

export interface FlowStep {
  from: KawnNode;
  to: KawnNode;
  edge: KawnEdge;
  reversed: boolean;
}

export interface FlowResponse {
  from: string;
  to: string;
  found: boolean;
  nodes: KawnNode[];
  steps: FlowStep[];
}

// ---- Changes (git diff impact) ----

export type ChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "typechange"
  | "other";

export type GitErrorCode = "git-missing" | "not-a-repo" | "bad-ref" | "no-head" | "git-failed";

export interface ChangedFileImpact {
  path: string;
  status: ChangeStatus;
  oldPath?: string;
  /** true when the file maps to at least one node in the current graph. */
  inGraph: boolean;
  fileNode?: KawnNode;
  symbols: KawnNode[];
}

export interface ReachNode {
  node: KawnNode;
  depth: number;
  via: string;
}

export interface ChangeImpact {
  /** Human-readable description of what was compared. */
  label: string;
  /** The diff range in PR mode, or null in working-tree mode. */
  range: string | null;
  files: ChangedFileImpact[];
  /** Changed paths that map to no node in the graph (rescan to include). */
  unmappedFiles: string[];
  changedNodes: KawnNode[];
  impacted: ReachNode[];
  /** true when the impact was cut off at the node cap (more dependents exist). */
  impactTruncated: boolean;
  /** Downstream source files to re-check (impacted paths minus changed paths). */
  filesToRecheck: string[];
  relatedDocs: KawnNode[];
  relatedTables: KawnNode[];
  relatedTests: KawnNode[];
  risks: ContextRisk[];
}

/**
 * Discriminated by `ok`: on success `impact` is present; when git is unavailable
 * (not installed / not a repo / unborn HEAD / bad ref) `gitError` explains why,
 * so the view can render a friendly state instead of a failure banner.
 */
export interface ChangesResponse {
  ok: boolean;
  impact?: ChangeImpact;
  gitError?: { code: GitErrorCode; message: string };
}

/** A normalized API error (the server returns `{ error: string }` on 4xx). */
export interface ApiError {
  error: string;
  status: number;
}
