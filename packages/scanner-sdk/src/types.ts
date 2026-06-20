/**
 * Scanner Plugin SDK — core contracts.
 *
 * A scanner plugin teaches Athar a language or file format. Plugins are pure with
 * respect to the filesystem and the network: they receive file content, never read
 * it themselves, never reach the network, and must produce identical output for
 * identical input. The registry (see {@link ./registry}) orchestrates them
 * deterministically and isolates failures.
 */
import type { AtharNode, AtharEdge } from "@athar/shared";

/**
 * The Scanner SDK contract version. Plugins declare the apiVersion they target;
 * the registry refuses to load a plugin built against an incompatible MAJOR.
 */
export const SCANNER_API_VERSION = "1" as const;
export type ScannerApiVersion = typeof SCANNER_API_VERSION;

export type DiagnosticLevel = "info" | "warn" | "error";

/** A structured, non-fatal note from a plugin or the registry. Never thrown. */
export interface PluginDiagnostic {
  level: DiagnosticLevel;
  message: string;
  /** plugin that produced (or caused) the diagnostic, when known */
  pluginId?: string;
  /** repo-relative file the diagnostic concerns, when applicable */
  sourcePath?: string;
  /** stable machine code, e.g. "file_too_large", "missing_evidence" */
  code?: string;
}

/**
 * A reference a plugin could not resolve to a node (e.g. a bare/external import).
 * Kept as honest evidence of an *unresolved* relationship rather than inventing an
 * edge to a node that does not exist.
 */
export interface UnresolvedRef {
  /** node id the reference originates from */
  from: string;
  /** raw specifier/text that could not be resolved */
  specifier: string;
  /** what kind of reference, e.g. "import", "call" */
  kind: string;
  sourcePath: string;
  lineStart?: number;
}

/** A file presented to plugins for detection/scanning. Paths are repo-relative posix. */
export interface ScanFile {
  /** repo-relative, posix-separated path */
  relPath: string;
  /** lowercased extension including the dot, e.g. ".ts" (empty string if none) */
  ext: string;
  /** byte size of the file content */
  size: number;
}

/** What a plugin contributes from scanning one file (or from finalize). */
export interface ScanContribution {
  nodes: AtharNode[];
  edges: AtharEdge[];
  /** references that could not be resolved to a node */
  unresolved?: UnresolvedRef[];
  /** structured notes; merged into the scan report, never thrown */
  diagnostics?: PluginDiagnostic[];
  /**
   * Plugin-private payload carried to this same plugin's finalize() (e.g. parsed
   * doc structures needed for a cross-file link pass). Opaque to the registry.
   */
  data?: unknown;
}

export const EMPTY_CONTRIBUTION: ScanContribution = { nodes: [], edges: [] };

/**
 * Read-only resolver/context handed to a plugin's scan(). No filesystem, no
 * network — only deterministic lookups over what the registry already knows.
 */
export interface ScanContext {
  /** repo root label (display), posix */
  readonly root: string;
  /** every repo-relative path the registry will scan (all detected files) */
  readonly knownFiles: ReadonlySet<string>;
  /** resolve a relative import specifier from `fromRel` to a known code file, or null */
  resolveLocalImport(fromRel: string, specifier: string): string | null;
  /** match a bare specifier to a workspace package name discovered so far, or null */
  matchWorkspacePackage(specifier: string): string | null;
}

/**
 * Read-only context handed to a plugin's finalize(), after every file is scanned.
 * Cross-file edges (docs->code, package membership) are resolved here against the
 * complete node set.
 */
export interface FinalizeContext {
  readonly root: string;
  /** all nodes accumulated from every plugin's scan phase */
  readonly allNodes: readonly AtharNode[];
  /** all edges accumulated from every plugin's scan phase */
  readonly allEdges: readonly AtharEdge[];
  /** this plugin's OWN scan contributions (to read back its `data` payloads) */
  readonly own: readonly ScanContribution[];
}
