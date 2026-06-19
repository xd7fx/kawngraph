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
