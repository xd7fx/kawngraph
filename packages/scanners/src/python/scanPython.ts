import { parser } from "@lezer/python";
import { KawnNode, ScanResult, fileId, posixBasename, isTestPath } from "@kawngraph/shared";
import type { PyScanContext } from "./context";
import { LineMap, moduleDocstring } from "./pyutils";
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
  const isTest = isTestPath(relPath);

  const file: KawnNode = {
    id: fileId(relPath),
    type: "file",
    layer: isTest ? "test" : "code",
    label: posixBasename(relPath),
    sourcePath: relPath,
  };

  const symbols = extractPySymbols(root, relPath, content, lines, isTest);
  const imports = extractPyImports(root, relPath, content, lines, ctx);
  const routes = extractPyRoutes(root, relPath, content, lines);
  const calls = extractPyCalls(tree, relPath, content, lines, symbols.local, imports.importedNames);

  const metadata: Record<string, unknown> = {};
  const docstring = moduleDocstring(root, content);
  if (docstring) metadata["docstring"] = docstring;
  if (imports.externalImports.length > 0) metadata["externalImports"] = imports.externalImports;
  if (Object.keys(metadata).length > 0) file.metadata = metadata;

  return {
    nodes: [file, ...symbols.nodes, ...routes.nodes],
    edges: [...symbols.edges, ...imports.edges, ...routes.edges, ...calls.edges],
  };
}

export type { PyScanContext } from "./context";
