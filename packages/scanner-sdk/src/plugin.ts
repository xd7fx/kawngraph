/**
 * The ScannerPlugin contract. One plugin owns one language/format family. The SDK
 * deliberately has NO auto-loading: a host must explicitly register each plugin,
 * so a dependency can never silently inject a scanner into someone's graph.
 */
import type { ScannerCapabilities } from "./capabilities";
import type { ScanContext, ScanContribution, ScanFile, FinalizeContext } from "./types";

export interface ScannerPlugin {
  /** stable unique id, e.g. "builtin:typescript" */
  id: string;
  /** plugin implementation version (informational) */
  version: string;
  /** Scanner SDK contract version this plugin targets, e.g. "1" */
  apiVersion: string;
  /** human label for legends/diagnostics */
  displayName?: string;
  /** language tags, e.g. ["typescript","javascript"] */
  languages: string[];
  /** file extensions it handles, e.g. [".ts",".tsx"] (informational; detect() decides) */
  extensions: string[];
  capabilities: ScannerCapabilities;
  /** lower runs earlier; determines deterministic phase order (default 100) */
  order?: number;
  /** true if this file belongs to this plugin. Must be pure & cheap. */
  detect(file: ScanFile): boolean;
  /** scan one detected file into a contribution. May be async. */
  scan(file: ScanFile, content: string, ctx: ScanContext): ScanContribution | Promise<ScanContribution>;
  /** optional cross-file pass after all files are scanned. */
  finalize?(ctx: FinalizeContext): ScanContribution | Promise<ScanContribution>;
}

/**
 * Identity helper for defining a plugin with editor autocomplete and a single
 * definition point. It does NOT register the plugin (no auto-loading by design).
 */
export function defineScannerPlugin(plugin: ScannerPlugin): ScannerPlugin {
  return plugin;
}
