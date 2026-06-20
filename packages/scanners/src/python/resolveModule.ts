import { posixDirname } from "@athar/shared";

/**
 * Resolve a Python import to a repo-relative file, honestly.
 *
 * Relative imports (one or more leading dots) resolve from the importing file's
 * package: one dot = the current package (the file's directory), each extra dot
 * climbs one level. Absolute imports (no dots) resolve from the repo root, which
 * is the common layout for `src`-less and repo-root-on-`PYTHONPATH` projects.
 *
 * A module `a/b/c` maps to either `a/b/c.py` or the package `a/b/c/__init__.py`.
 * We only return a path that is actually present in `knownFiles` — never an
 * invented edge to a file that does not exist (stdlib/third-party imports return
 * null and are recorded as external by the caller).
 */
export function resolvePyModule(
  fromRel: string,
  dots: number,
  parts: string[],
  knownFiles: ReadonlySet<string>,
): string | null {
  let baseDir: string;
  if (dots === 0) {
    baseDir = ""; // repo root
  } else {
    let dir = posixDirname(fromRel);
    if (dir === ".") dir = "";
    // one dot stays in the current package; each extra dot climbs a level
    for (let i = 1; i < dots; i++) {
      dir = dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "";
    }
    baseDir = dir;
  }

  const segs = [baseDir, ...parts].filter((s) => s.length > 0);
  const modPath = segs.join("/");

  if (parts.length > 0) {
    if (modPath && knownFiles.has(`${modPath}.py`)) return `${modPath}.py`;
    const initPath = `${modPath ? `${modPath}/` : ""}__init__.py`;
    if (knownFiles.has(initPath)) return initPath;
  } else {
    // `from . import x` with no module parts: the current package's __init__.py
    const initPath = `${baseDir ? `${baseDir}/` : ""}__init__.py`;
    if (knownFiles.has(initPath)) return initPath;
  }
  return null;
}
