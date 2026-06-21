export type {
  KawnGraph,
  KawnNode,
  KawnEdge,
  ScanResult,
  GraphStats,
  Layer,
  NodeType,
  EdgeType,
  Confidence,
} from "@kawngraph/shared";

export interface NodeDegree {
  id: string;
  in: number;
  out: number;
  total: number;
}
