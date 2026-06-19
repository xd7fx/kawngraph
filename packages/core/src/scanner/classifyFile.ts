import { posixBasename } from "@athar/shared";

export type FileKind = "code" | "sql" | "docs" | "packageJson" | "ignore";

/** Map a file path to the scanner that should handle it. */
export function classifyFile(relPath: string): FileKind {
  if (posixBasename(relPath) === "package.json") return "packageJson";
  if (/\.sql$/i.test(relPath)) return "sql";
  if (/\.mdx?$/i.test(relPath)) return "docs";
  if (/\.d\.ts$/i.test(relPath)) return "ignore"; // ambient declarations, not source
  if (/\.(tsx?|jsx?|mjs|cjs)$/i.test(relPath)) return "code";
  return "ignore";
}
