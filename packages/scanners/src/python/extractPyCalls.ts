import type { SyntaxNode, Tree } from "@lezer/common";
import { AtharEdge, Confidence, fileId, functionId, classId, edgeId } from "@athar/shared";
import { LineMap, defName, isTopLevelDef, text, firstLine } from "./pyutils";
import type { PySymbolInfo } from "./extractPySymbols";
import type { PyImportedName } from "./extractPyImports";

/**
 * Extract `calls` edges from call expressions with a simple-name callee. Each
 * call is attributed to its enclosing top-level function/class (or the file at
 * module scope), and the callee is resolved to a same-file top-level symbol or a
 * named import. Attribute (`obj.method()`) calls are skipped to avoid false
 * edges — exactly the heuristic the TS scanner uses.
 */
export function extractPyCalls(
  tree: Tree,
  relPath: string,
  content: string,
  lines: LineMap,
  local: Map<string, PySymbolInfo>,
  imported: Map<string, PyImportedName>,
): { edges: AtharEdge[] } {
  const edges: AtharEdge[] = [];
  const seen = new Set<string>();
  const file = fileId(relPath);

  tree.iterate({
    enter: (ref) => {
      if (ref.name !== "CallExpression") return;
      const node = ref.node;
      const callee = node.firstChild;
      if (!callee || callee.name !== "VariableName") return; // skip member/attribute calls
      const name = text(callee, content);

      let calleeId: string | null = null;
      let confidence: Confidence = "extracted";
      const localSym = local.get(name);
      const imp = imported.get(name);
      if (localSym) {
        calleeId = localSym.id;
        confidence = "extracted";
      } else if (imp) {
        calleeId = functionId(imp.file, imp.exportName);
        confidence = "linked";
      }
      if (!calleeId) return;

      const caller = enclosingScopeId(node, relPath, content);
      if (calleeId === caller) return;
      const id = edgeId("calls", caller, calleeId);
      if (seen.has(id)) return;
      seen.add(id);
      edges.push({
        id,
        from: caller,
        to: calleeId,
        type: "calls",
        confidence,
        evidence: { sourcePath: relPath, lineStart: lines.lineAt(node.from), snippet: firstLine(text(node, content)) },
      });
    },
  });

  return { edges };
}

/** Node id of the top-level function/class enclosing `node`, or the file itself. */
function enclosingScopeId(node: SyntaxNode, relPath: string, content: string): string {
  let scope: SyntaxNode | null = null;
  for (let p = node.parent; p; p = p.parent) {
    if ((p.name === "FunctionDefinition" || p.name === "ClassDefinition") && isTopLevelDef(p)) {
      scope = p;
      break;
    }
  }
  if (!scope) return fileId(relPath);
  const name = defName(scope, content);
  if (!name) return fileId(relPath);
  return scope.name === "ClassDefinition" ? classId(relPath, name) : functionId(relPath, name);
}
