export * from "./types";

export { ADAPTERS, ALL_AGENT_IDS, AUTO_AGENT_IDS, getAdapter, isAgentId } from "./registry";
export { detectAgents, resolveSelection } from "./detect";
export type { Selection } from "./detect";

export { LOCAL_BASE_URLS, localLlmConfigJson, contextBridgeMarkdown } from "./adapters/bundle";

export { resolveMcpLaunch, publishedNpxLaunch } from "./launch";
export { probeMcpServer } from "./mcpProbe";
export type { McpProbeResult, ProbeOptions } from "./mcpProbe";

export { planSetup, applySetup, connectAgent, disconnectAgent } from "./setup";
export type { SetupOptions, SetupPlan, SetupReport, ApplyOptions } from "./setup";

export {
  INTEGRATION_SCHEMA_VERSION,
  integrationManifestPath,
  readIntegrations,
  writeIntegrations,
  getIntegration,
  upsertIntegration,
  removeIntegrationRecord,
} from "./integrations";
export type { IntegrationManifest, IntegrationRecord } from "./integrations";

export { runDoctor } from "./doctor/checks";
export type { DoctorReport, DoctorOptions, CheckResult, CheckStatus } from "./doctor/checks";
export { formatDoctorText, formatDoctorJson, doctorExitCode } from "./doctor/report";

// Safe config-IO primitives, exported for tests and advanced reuse.
export { atomicWriteFile, backupFile, backupsDir } from "./config/atomicWrite";
export { readJsonFile, formatJson } from "./config/safeJson";
export {
  renderMcpServerBlock,
  upsertTomlTable,
  removeTomlTable,
  hasTomlTable,
  hasInlineMcpServer,
} from "./config/safeToml";
