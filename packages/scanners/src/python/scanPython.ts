import { parser } from "@lezer/python";
import { AtharNode, ScanResult, fileId, posixBasename } from "@athar/shared";
import type { PyScanContext } from "./context";
import { LineMap } from "./pyutils";
import { extractPySymbols } from "./extractPySymbols";
import { extractPyImports } from "./extractPyImports";
import { extractPyRoutes } from "./extractPyRoutes";
import { extractPyCalls } from "./extractPyCalls";

/**
 * Scan a single Python file into nodes + evidence-backed edges using the mature
 * `@lezer/python` grammar (a real structural parser, not regex). Emits the file
 * node, top-level functions/classes (`defines`), resolved imports (`imports`),
 * FastAPI/Flask routes (`defines`/`references`), and intra/inter-file calls
 * (`calls`).
 *
 * Lezer is error-tolerant: malformed input yields a partial tree with error
 * markers rather than throwing, so a broken file degrades to whatever could be
 * parsed instead of failing the scan.
 */
export function scanPython(relPath: string, content: string, ctx: PyScanContext): ScanResult {
  const tree = parser.parse(content);
  const root = tree.topNode;
  const lines = new LineMap(content);

  const file: AtharNode = {
    id: fileId(relPath),
    type: "file",
    layer: "code",
    label: posixBasename(relPath),
    sourcePath: relPath,
  };

  const symbols = extractPySymbols(root, relPath, content, lines);
  const imports = extractPyImports(root, relPath, content, lines, ctx);
  const routes = extractPyRoutes(root, relPath, content, lines);
  const calls = extractPyCalls(tree, relPath, content, lines, symbols.local, imports.importedNames);

  if (imports.externalImports.length > 0) {
    file.metadata = { externalImports: imports.externalImports };
  }

  return {
    nodes: [file, ...symbols.nodes, ...routes.nodes],
    edges: [...symbols.edges, ...imports.edges, ...routes.edges, ...calls.edges],
  };
}

export type { PyScanContext } from "./context";
