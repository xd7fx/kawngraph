/**
 * Cross-file resolution the Python scanner needs. The registry knows the full
 * set of scanned files; it provides this hook so the per-file scanner stays pure
 * and never touches the filesystem. Resolution is *honest*: it only links to a
 * module file that actually exists in the scanned set.
 */
export interface PyScanContext {
  /**
   * Resolve a Python import to a repo-relative file path, or null if it cannot be
   * resolved to a scanned file (external dependency / stdlib / missing).
   *
   * @param dots  number of leading dots (0 = absolute, 1 = current package, 2 = parent, …)
   * @param parts dotted module segments after the dots, e.g. `["models"]` for `.models`
   */
  resolveModule(dots: number, parts: string[]): string | null;
}
