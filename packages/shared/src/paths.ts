import * as path from "node:path";

/** Normalize any path to posix (forward-slash) form for stable, cross-platform IDs. */
export function toPosix(p: string): string {
  return p.split(path.sep).join("/").replace(/\\/g, "/");
}

/** Path of `absPath` relative to `root`, normalized to posix form. */
export function relPosix(root: string, absPath: string): string {
  return toPosix(path.relative(root, absPath));
}

/** Strip a known set of code extensions from a path (used for import resolution). */
export function stripExt(p: string): string {
  return p.replace(/\.(tsx?|jsx?|mjs|cjs)$/i, "");
}

/** posix-style basename, e.g. "a/b/c.ts" -> "c.ts". */
export function posixBasename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

/** posix-style dirname, e.g. "a/b/c.ts" -> "a/b"; "c.ts" -> ".". */
export function posixDirname(p: string): string {
  const i = p.lastIndexOf("/");
  if (i === -1) return ".";
  return p.slice(0, i) || "/";
}

/** Join posix path segments, collapsing "." and ".." where possible. */
export function posixJoin(...segments: string[]): string {
  const parts: string[] = [];
  for (const seg of segments.join("/").split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}
