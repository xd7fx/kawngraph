export type {
  AtharGraph,
  AtharNode,
  AtharEdge,
  ScanResult,
  GraphStats,
  Layer,
  NodeType,
  EdgeType,
  Confidence,
} from "@athar/shared";

export interface NodeDegree {
  id: string;
  in: number;
  out: number;
  total: number;
}
