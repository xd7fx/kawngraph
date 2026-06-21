import * as ts from "typescript";
import {
  KawnNode,
  KawnEdge,
  fileId,
  functionId,
  classId,
  edgeId,
} from "@kawngraph/shared";
import { lineOf, endLineOf, isExported } from "./tsutils";

export interface SymbolInfo {
  id: string;
  kind: "function" | "class";
}

export interface SymbolsResult {
  nodes: KawnNode[];
  edges: KawnEdge[];
  /** local symbol name -> info, used to resolve same-file calls */
  local: Map<string, SymbolInfo>;
}

/**
 * Extract top-level functions and classes (including `const x = () => {}` style
 * functions) and a `defines` edge from the file to each.
 */
export function extractSymbols(sf: ts.SourceFile, relPath: string): SymbolsResult {
  const nodes: KawnNode[] = [];
  const edges: KawnEdge[] = [];
  const local = new Map<string, SymbolInfo>();
  const file = fileId(relPath);

  const define = (id: string, kind: "function" | "class", name: string, node: ts.Node, exported: boolean): void => {
    if (local.has(name)) return;
    local.set(name, { id, kind });
    nodes.push({
      id,
      type: kind,
      layer: "code",
      label: name,
      sourcePath: relPath,
      lineStart: lineOf(sf, node),
      lineEnd: endLineOf(sf, node),
      metadata: { exported },
    });
    edges.push({
      id: edgeId("defines", file, id),
      from: file,
      to: id,
      type: "defines",
      confidence: "extracted",
      evidence: { sourcePath: relPath, lineStart: lineOf(sf, node) },
    });
  };

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      define(functionId(relPath, stmt.name.text), "function", stmt.name.text, stmt, isExported(stmt));
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      define(classId(relPath, stmt.name.text), "class", stmt.name.text, stmt, isExported(stmt));
    } else if (ts.isVariableStatement(stmt)) {
      const exported = isExported(stmt);
      for (const decl of stmt.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          define(functionId(relPath, decl.name.text), "function", decl.name.text, decl, exported);
        }
      }
    }
  }

  return { nodes, edges, local };
}
