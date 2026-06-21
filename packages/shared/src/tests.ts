import { toPosix } from "./paths";

/**
 * Deterministic, path-only test detection shared by every scanner so a test file
 * is classified the SAME way regardless of language. Tests live in their own
 * graph layer (`test`) and node type (`test`) so the Context Pack can bucket them
 * separately and `--mode tests` can scope to them — purely structural, no content
 * parsing, no I/O.
 *
 * Conventions recognized (case-insensitive, POSIX-normalized):
 *  - any path segment that is exactly `__tests__`, `tests`, or `test`
 *  - Python:    `test_*.py`, `*_test.py`, or `conftest.py`
 *  - TS / JS:   `*.test.*` / `*.spec.*` (ts, tsx, js, jsx, mjs, cjs)
 *
 * A whole test *directory* makes every file under it a test file (fixtures and
 * helpers included), matching how developers actually organize test code.
 */
export function isTestPath(relPath: string): boolean {
  const posix = toPosix(relPath).toLowerCase();
  const segments = posix.split("/");
  const base = segments[segments.length - 1] ?? "";

  // Directory conventions apply to any language.
  if (segments.some((s) => s === "__tests__" || s === "tests" || s === "test")) return true;

  // Python file conventions (pytest + unittest discovery).
  if (base.endsWith(".py")) {
    return base === "conftest.py" || /^test_.+\.py$/.test(base) || /_test\.py$/.test(base);
  }

  // TypeScript / JavaScript file conventions.
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(base);
}
