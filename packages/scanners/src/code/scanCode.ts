import { AtharNode, ScanResult, fileId, posixBasename } from "@athar/shared";
import { createSource } from "./tsutils";
import { extractSymbols } from "./extractSymbols";
import { extractImports } from "./extractImports";
import { extractCalls } from "./extractCalls";
import { extractRoutes } from "./extractRoutes";
import { CodeScanContext } from "./context";

/**
 * Scan a single TypeScript/JavaScript file into nodes + evidence-backed edges:
 * the file node, its functions/classes (`defines`), imports (`imports`),
 * Next.js routes (`defines`/`references`), and calls (`calls`).
 */
export function scanCode(relPath: string, content: string, ctx: CodeScanContext): ScanResult {
  const sf = createSource(relPath, content);

  const file: AtharNode = {
    id: fileId(relPath),
    type: "file",
    layer: "code",
    label: posixBasename(relPath),
    sourcePath: relPath,
  };

  const symbols = extractSymbols(sf, relPath);
  const imports = extractImports(sf, relPath, ctx);
  const routes = extractRoutes(sf, relPath);
  const calls = extractCalls(sf, relPath, symbols.local, imports.importedNames);

  if (imports.externalImports.length > 0) {
    file.metadata = { externalImports: imports.externalImports };
  }

  return {
    nodes: [file, ...symbols.nodes, ...routes.nodes],
    edges: [...symbols.edges, ...imports.edges, ...routes.edges, ...calls.edges],
  };
}

export { CodeScanContext } from "./context";
export { routeUrlFor } from "./extractRoutes";
