import * as ts from "typescript";
import { KawnNode, KawnEdge, fileId, functionId, routeId, edgeId } from "@kawngraph/shared";
import { lineOf, isExported } from "./tsutils";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

/**
 * Map a Next.js App Router file path to its URL path, or null if it is not a
 * route handler. Route groups `(group)` are stripped; `[param]` -> `:param`;
 * `[...slug]` -> `:slug*`.
 */
export function routeUrlFor(relPath: string): string | null {
  const parts = relPath.split("/");
  const fname = parts[parts.length - 1] ?? "";
  if (!/^route\.(t|j)sx?$/.test(fname)) return null;

  let appIdx = -1;
  for (let i = parts.length - 2; i >= 0; i--) {
    if (parts[i] === "app") {
      appIdx = i;
      break;
    }
  }
  if (appIdx === -1) return null;

  const segs = parts.slice(appIdx + 1, parts.length - 1);
  const urlSegs: string[] = [];
  for (const s of segs) {
    if (/^\(.*\)$/.test(s)) continue; // route group, not part of the URL
    if (/^\[\.\.\..+\]$/.test(s)) urlSegs.push(":" + s.slice(4, -1) + "*");
    else if (/^\[.+\]$/.test(s)) urlSegs.push(":" + s.slice(1, -1));
    else urlSegs.push(s);
  }
  return "/" + urlSegs.join("/");
}

export function extractRoutes(sf: ts.SourceFile, relPath: string): { nodes: KawnNode[]; edges: KawnEdge[] } {
  const url = routeUrlFor(relPath);
  if (url === null) return { nodes: [], edges: [] };

  const nodes: KawnNode[] = [];
  const edges: KawnEdge[] = [];
  const file = fileId(relPath);

  const addHandler = (method: string, line: number): void => {
    const rid = routeId(url, method);
    nodes.push({
      id: rid,
      type: "route",
      layer: "code",
      label: `${method} ${url}`,
      sourcePath: relPath,
      lineStart: line,
      metadata: { method, url },
    });
    edges.push({
      id: edgeId("defines", file, rid),
      from: file,
      to: rid,
      type: "defines",
      confidence: "extracted",
      evidence: { sourcePath: relPath, lineStart: line },
    });
    const handler = functionId(relPath, method);
    edges.push({
      id: edgeId("references", rid, handler),
      from: rid,
      to: handler,
      type: "references",
      confidence: "extracted",
      evidence: { sourcePath: relPath, lineStart: line },
    });
  };

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && HTTP_METHODS.has(stmt.name.text) && isExported(stmt)) {
      addHandler(stmt.name.text, lineOf(sf, stmt));
    } else if (ts.isVariableStatement(stmt) && isExported(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && HTTP_METHODS.has(decl.name.text)) {
          addHandler(decl.name.text, lineOf(sf, decl));
        }
      }
    }
  }

  return { nodes, edges };
}
