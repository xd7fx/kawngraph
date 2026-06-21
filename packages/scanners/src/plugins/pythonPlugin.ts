/**
 * Built-in Python plugin. Wraps {@link scanPython}, which parses with the mature
 * `@lezer/python` grammar (a real structural parser, never regex). It resolves
 * Python imports against the registry's known file set via {@link resolvePyModule}
 * — relative imports from the importing package, absolute imports from the repo
 * root — and only links to modules that actually exist (no invented edges).
 *
 * `.pyi` stub files are intentionally NOT claimed (they are ambient type stubs,
 * not source — the Python analogue of `.d.ts`).
 */
import { defineScannerPlugin, type ScannerPlugin } from "@kawngraph/scanner-sdk";
import { scanPython } from "../python/scanPython";
import { resolvePyModule } from "../python/resolveModule";
import type { PyScanContext } from "../python/context";

const PY_RE = /\.py$/i;

export function pythonPlugin(): ScannerPlugin {
  return defineScannerPlugin({
    id: "builtin:python",
    version: "1.0.0",
    apiVersion: "1",
    displayName: "Python",
    languages: ["python"],
    extensions: [".py"],
    capabilities: {
      nodeTypes: ["file", "function", "class", "route"],
      edgeTypes: ["defines", "imports", "references", "calls"],
      emitsEvidence: true,
    },
    order: 1,
    detect: (f) => PY_RE.test(f.relPath),
    scan: (f, content, ctx) => {
      const pyCtx: PyScanContext = {
        resolveModule: (dots, parts) => resolvePyModule(f.relPath, dots, parts, ctx.knownFiles),
      };
      const r = scanPython(f.relPath, content, pyCtx);
      return { nodes: r.nodes, edges: r.edges };
    },
  });
}
