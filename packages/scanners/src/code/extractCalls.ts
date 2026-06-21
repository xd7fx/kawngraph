import * as ts from "typescript";
import { KawnEdge, fileId, functionId, classId, edgeId } from "@kawngraph/shared";
import { lineOf, snippetOf } from "./tsutils";
import { SymbolInfo } from "./extractSymbols";
import { ImportedName } from "./extractImports";

/**
 * Extract `calls` edges from call expressions with a simple identifier callee.
 * Callers are attributed to the enclosing function/class (or the file at module
 * scope). Callees are resolved to same-file symbols or named imports. Property
 * calls (`obj.method()`) are skipped in v0.1 to avoid false edges.
 */
export function extractCalls(
  sf: ts.SourceFile,
  relPath: string,
  local: Map<string, SymbolInfo>,
  imported: Map<string, ImportedName>,
): { edges: KawnEdge[] } {
  const edges: KawnEdge[] = [];
  const seen = new Set<string>();
  const file = fileId(relPath);
  const stack: string[] = [];

  const currentCaller = (): string => (stack.length > 0 ? stack[stack.length - 1]! : file);

  const visit = (node: ts.Node): void => {
    let pushed = false;
    if (ts.isFunctionDeclaration(node) && node.name) {
      stack.push(functionId(relPath, node.name.text));
      pushed = true;
    } else if (ts.isClassDeclaration(node) && node.name) {
      stack.push(classId(relPath, node.name.text));
      pushed = true;
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      stack.push(functionId(relPath, node.name.text));
      pushed = true;
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      const caller = currentCaller();
      let calleeId: string | null = null;
      let confidence: "extracted" | "linked" = "extracted";

      const localSym = local.get(name);
      const imp = imported.get(name);
      if (localSym) {
        calleeId = localSym.id;
        confidence = "extracted";
      } else if (imp) {
        calleeId = functionId(imp.file, imp.exportName);
        confidence = "linked";
      }

      if (calleeId && calleeId !== caller) {
        const id = edgeId("calls", caller, calleeId);
        if (!seen.has(id)) {
          seen.add(id);
          edges.push({
            id,
            from: caller,
            to: calleeId,
            type: "calls",
            confidence,
            evidence: { sourcePath: relPath, lineStart: lineOf(sf, node), snippet: snippetOf(sf, node) },
          });
        }
      }
    }

    ts.forEachChild(node, visit);
    if (pushed) stack.pop();
  };

  ts.forEachChild(sf, visit);
  return { edges };
}
