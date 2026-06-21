/**
 * @kawngraph/scanner-sdk — the versioned contract for teaching KawnGraph new languages.
 *
 * Hosts build a {@link ScannerRegistry}, explicitly register {@link ScannerPlugin}s,
 * and call `scan()`. Plugins are deterministic, evidence-backed, read-only, and
 * isolated from one another's failures. There is no auto-loading by design.
 */
export * from "./types";
export * from "./capabilities";
export * from "./plugin";
export * from "./diagnostics";
export * from "./validation";
export * from "./registry";
export * from "./testing";
