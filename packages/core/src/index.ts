export * from "./graph/graphTypes";
export { buildGraph } from "./graph/graphBuilder";
export type { BuildOptions } from "./graph/graphBuilder";
export { serializeGraph } from "./graph/serializeGraph";
export {
  atharDir,
  graphPath,
  reportPath,
  ensureAtharDir,
  writeGraph,
  writeReport,
  readGraph,
  graphExists,
} from "./graph/graphStore";

export { scanRepo } from "./scanner/scanRepo";
export type { ScanRepoOptions } from "./scanner/scanRepo";
export { classifyFile } from "./scanner/classifyFile";
export type { FileKind } from "./scanner/classifyFile";
export { loadIgnoreRules, isIgnoredPath } from "./scanner/loadIgnoreRules";
export type { IgnoreRules } from "./scanner/loadIgnoreRules";

export { generateReport } from "./report/generateReport";

export { affected, affectedFiles } from "./impact/affected";
export type { AffectedResult, AffectedNode } from "./impact/affected";
export { shortestPath } from "./impact/shortestPath";
export { flowBetween, MAX_FLOW_NODES } from "./impact/flowBetween";
export type { FlowResult, FlowStep } from "./impact/flowBetween";
export { scoreRisks } from "./impact/riskScore";

export { buildContextPack, queryGraph } from "./context/buildContextPack";
export type { BuildContextOptions } from "./context/buildContextPack";
export { rankContext, extractKeywords } from "./context/rankContext";
export type { RankedNode, RankOptions } from "./context/rankContext";
export { estimateTokens } from "./context/tokenBudget";
