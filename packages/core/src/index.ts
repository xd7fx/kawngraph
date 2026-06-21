export * from "./graph/graphTypes";
export { buildGraph } from "./graph/graphBuilder";
export type { BuildOptions } from "./graph/graphBuilder";
export { serializeGraph } from "./graph/serializeGraph";
export {
  kawnDir,
  graphPath,
  reportPath,
  ensureKawnDir,
  writeGraph,
  writeReport,
  readGraph,
  graphExists,
} from "./graph/graphStore";
export {
  manifestPath,
  computeGraphHash,
  currentGitHead,
  buildManifest,
  writeManifest,
  readManifest,
  graphFreshness,
  writeManifestForGraph,
} from "./graph/manifest";
export type { GraphManifest, FreshnessStatus, FreshnessResult } from "./graph/manifest";

export { scanRepo } from "./scanner/scanRepo";
export type { ScanRepoOptions } from "./scanner/scanRepo";
export { classifyFile } from "./scanner/classifyFile";
export type { FileKind } from "./scanner/classifyFile";
export { loadIgnoreRules, isIgnoredPath } from "./scanner/loadIgnoreRules";
export type { IgnoreRules } from "./scanner/loadIgnoreRules";

export { generateReport } from "./report/generateReport";

export { affected, affectedFiles } from "./impact/affected";
export type { AffectedResult, AffectedNode } from "./impact/affected";
export { reverseReachable, DEPENDENCY_EDGES } from "./impact/reachable";
export type { ReachNode, ReachOptions, ReachResult } from "./impact/reachable";
export { shortestPath } from "./impact/shortestPath";
export { flowBetween, MAX_FLOW_NODES } from "./impact/flowBetween";
export type { FlowResult, FlowStep } from "./impact/flowBetween";
export { scoreRisks } from "./impact/riskScore";
export { analyzeChangeImpact } from "./impact/changeImpact";
export type { ChangeImpact, ChangedFileImpact, ChangeImpactOptions } from "./impact/changeImpact";

export {
  gitChangedFiles,
  isGitRepo,
  parseNameStatusZ,
  GitError,
} from "./git/changedFiles";
export type {
  ChangeSet,
  ChangeSetOptions,
  ChangedFile,
  ChangeStatus,
  GitErrorCode,
} from "./git/changedFiles";

export { buildContextPack, queryGraph } from "./context/buildContextPack";
export type { BuildContextOptions } from "./context/buildContextPack";
export { rankContext, extractKeywords } from "./context/rankContext";
export type { RankedNode, RankOptions } from "./context/rankContext";
export { estimateTokens } from "./context/tokenBudget";
