/**
 * Built-in TypeScript/JavaScript plugin. Wraps {@link scanCode}, mapping the SDK's
 * read-only {@link ScanContext} onto the code scanner's {@link CodeScanContext}
 * (relative-import resolution + workspace-package matching). It declares
 * `resolvesImports`, which makes its files the import-target set the registry uses
 * to resolve relative specifiers — mirroring legacy `scanRepo`, where only code
 * files were resolution targets.
 *
 * `.d.ts` ambient declarations are intentionally NOT claimed (they are not source).
 */
import { defineScannerPlugin, type ScannerPlugin } from "@athar/scanner-sdk";
import { scanCode } from "../code/scanCode";
import type { CodeScanContext } from "../code/context";

const CODE_RE = /\.(tsx?|jsx?|mjs|cjs)$/i;
const DTS_RE = /\.d\.ts$/i;

export function codePlugin(): ScannerPlugin {
  return defineScannerPlugin({
    id: "builtin:code",
    version: "1.0.0",
    apiVersion: "1",
    displayName: "TypeScript / JavaScript",
    languages: ["typescript", "javascript"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    capabilities: {
      nodeTypes: ["file", "function", "class", "route"],
      edgeTypes: ["defines", "imports", "references", "calls"],
      emitsEvidence: true,
      resolvesImports: true,
    },
    order: 1,
    detect: (f) => CODE_RE.test(f.relPath) && !DTS_RE.test(f.relPath),
    scan: (f, content, ctx) => {
      const codeCtx: CodeScanContext = {
        resolveImport: (specifier) => ctx.resolveLocalImport(f.relPath, specifier),
        matchWorkspacePackage: (specifier) => ctx.matchWorkspacePackage(specifier),
      };
      const r = scanCode(f.relPath, content, codeCtx);
      return { nodes: r.nodes, edges: r.edges };
    },
  });
}
