/**
 * Cross-file resolution hooks the code scanner needs. The core walker provides
 * these once it knows the full file set and the workspace package names, so the
 * per-file scanner stays pure and testable.
 */
export interface CodeScanContext {
  /** Resolve an import specifier (relative to the importing file) to a repo file relPath, or null. */
  resolveImport(specifier: string): string | null;
  /** Return the workspace package name a bare specifier belongs to, or null. */
  matchWorkspacePackage(specifier: string): string | null;
}
