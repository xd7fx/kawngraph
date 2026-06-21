import type { SyntaxNode } from "@lezer/common";
import { KawnNode, KawnEdge, Layer, NodeType, fileId, functionId, classId, edgeId } from "@kawngraph/shared";
import { LineMap, defName, definitionOf, hasChild, decoratorNames, classMethods } from "./pyutils";

export interface PySymbolInfo {
  id: string;
  kind: "function" | "class";
}

export interface PySymbolsResult {
  nodes: KawnNode[];
  edges: KawnEdge[];
  /** top-level symbol name -> info, used to resolve same-file calls */
  local: Map<string, PySymbolInfo>;
}

/**
 * Extract module-level `def`/`async def` functions and `class` definitions (each
 * with a `defines` edge from the file). Decorated definitions are unwrapped so a
 * `@app.get(...)`-decorated handler still becomes a function node, and the
 * decorator names are kept on the node as `metadata.decorators`. A class also
 * carries its direct methods as evidence-rich `metadata.methods` (name + line +
 * async + decorators) — methods and nested functions are intentionally NOT
 * emitted as separate nodes, mirroring the TS scanner's top-level-only model.
 *
 * When `isTest` is set (the file matched a test convention) every top-level
 * symbol is emitted as a `test`-type node in the `test` layer so the Context Pack
 * buckets it under tests and `--mode tests` can scope to it. Node ids keep their
 * `function:`/`class:` prefix so call-attribution and cross-file resolution are
 * unaffected; the structural kind is preserved in `metadata.kind`.
 */
export function extractPySymbols(
  root: SyntaxNode,
  relPath: string,
  content: string,
  lines: LineMap,
  isTest = false,
): PySymbolsResult {
  const nodes: KawnNode[] = [];
  const edges: KawnEdge[] = [];
  const local = new Map<string, PySymbolInfo>();
  const file = fileId(relPath);

  const define = (id: string, kind: "function" | "class", name: string, stmt: SyntaxNode, def: SyntaxNode): void => {
    if (local.has(name)) return; // first definition wins (matches the TS scanner)
    local.set(name, { id, kind });
    const lineStart = lines.lineAt(def.from);

    const metadata: Record<string, unknown> = { exported: !name.startsWith("_") };
    if (kind === "function") metadata["async"] = hasChild(def, "async");
    const decorators = decoratorNames(stmt, content);
    if (decorators.length > 0) metadata["decorators"] = decorators;
    if (kind === "class") {
      const methods = classMethods(def, content, lines);
      if (methods.length > 0) metadata["methods"] = methods;
    }

    let type: NodeType = kind;
    let layer: Layer = "code";
    if (isTest) {
      type = "test";
      layer = "test";
      metadata["isTest"] = true;
      metadata["kind"] = kind;
    }

    nodes.push({
      id,
      type,
      layer,
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
    if (def.name === "FunctionDefinition") define(functionId(relPath, name), "function", name, stmt, def);
    else if (def.name === "ClassDefinition") define(classId(relPath, name), "class", name, stmt, def);
  }

  return { nodes, edges, local };
}
