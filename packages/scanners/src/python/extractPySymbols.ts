import type { SyntaxNode } from "@lezer/common";
import { AtharNode, AtharEdge, fileId, functionId, classId, edgeId } from "@athar/shared";
import { LineMap, defName, definitionOf, hasChild } from "./pyutils";

export interface PySymbolInfo {
  id: string;
  kind: "function" | "class";
}

export interface PySymbolsResult {
  nodes: AtharNode[];
  edges: AtharEdge[];
  /** top-level symbol name -> info, used to resolve same-file calls */
  local: Map<string, PySymbolInfo>;
}

/**
 * Extract module-level `def`/`async def` functions and `class` definitions (each
 * with a `defines` edge from the file). Decorated definitions are unwrapped so a
 * `@app.get(...)`-decorated handler still becomes a function node. Methods and
 * nested functions are intentionally not emitted as separate nodes — mirroring
 * the TS scanner, which captures only top-level symbols.
 */
export function extractPySymbols(
  root: SyntaxNode,
  relPath: string,
  content: string,
  lines: LineMap,
): PySymbolsResult {
  const nodes: AtharNode[] = [];
  const edges: AtharEdge[] = [];
  const local = new Map<string, PySymbolInfo>();
  const file = fileId(relPath);

  const define = (id: string, kind: "function" | "class", name: string, def: SyntaxNode): void => {
    if (local.has(name)) return; // first definition wins (matches the TS scanner)
    local.set(name, { id, kind });
    const lineStart = lines.lineAt(def.from);
    const metadata: Record<string, unknown> = { exported: !name.startsWith("_") };
    if (kind === "function") metadata["async"] = hasChild(def, "async");
    nodes.push({
      id,
      type: kind,
      layer: "code",
      label: name,
      sourcePath: relPath,
      lineStart,
      lineEnd: lines.lineAt(Math.max(def.from, def.to - 1)),
      metadata,
    });
    edges.push({
      id: edgeId("defines", file, id),
      from: file,
      to: id,
      type: "defines",
      confidence: "extracted",
      evidence: { sourcePath: relPath, lineStart },
    });
  };

  for (let stmt = root.firstChild; stmt; stmt = stmt.nextSibling) {
    const def = definitionOf(stmt);
    if (!def) continue;
    const name = defName(def, content);
    if (!name) continue;
    if (def.name === "FunctionDefinition") define(functionId(relPath, name), "function", name, def);
    else if (def.name === "ClassDefinition") define(classId(relPath, name), "class", name, def);
  }

  return { nodes, edges, local };
}
