/**
 * @kawngraph/benchmark — a subscription-authenticated, multi-agent, multi-project
 * behavioral benchmark for KawnGraph.
 *
 * It runs real Claude (and, best-effort, Codex) sessions WITH and WITHOUT KawnGraph
 * over isolated, commit-pinned copies of a project and measures retrieval quality
 * and task outcomes. It never requires an API key, never reads/prints/persists a
 * credential, and never fabricates a metric: a failed or unauthenticated session
 * is reported as failed, not scored.
 */
export * from "./types";

export { runBenchmark } from "./runner";
export type { BenchmarkOptions, BenchmarkOutcome } from "./runner";

export { preflight, readinessFor, isAvailable, formatReadiness, codexHome, codexAuthPath } from "./preflight";
export type { PreflightResult } from "./preflight";

export { computeMetrics, computeKawnPack, gradeChangeBoundary, namedFiles } from "./metrics";
export { Rng, makeRng, conditionOrder } from "./random";
export { redact, deepRedact, REDACTED } from "./redact";

export { loadProjectsFile, findProjectByPath, genericProject, resolveProjectPath, assertGoldApproved } from "./suites";

export { initExternalProject } from "./init";
export type { InitOptions, InitResult } from "./init";

export { getAdapter, claudeAdapter, codexAdapter, parseClaudeLines, parseCodexLines } from "./adapters";
export type { AgentAdapter, AdapterResult, RunInput } from "./adapters";

export { writeReports, writeTranscript, toCsv, toMarkdown, aggregateSide, mergeReports, readReportFile } from "./reports";
export type { WrittenReports } from "./reports";

export { norm, relToRoot, classifyTool, extractFile, toToolCall, isKawnTool } from "./normalize";

export {
  prepareProject,
  sessionWorkspace,
  writeWithConfig,
  snapshotDir,
  diffSnapshot,
  cleanup as cleanupStaged,
} from "./isolation";
export type { StagedProject, SessionWorkspace, PrepareOptions, DirSnapshot } from "./isolation";
