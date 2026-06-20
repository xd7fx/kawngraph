import type { SyntaxNode } from "@lezer/common";
import { AtharNode, AtharEdge, fileId, functionId, routeId, edgeId } from "@athar/shared";
import { LineMap, childrenOf, defName, text, unquoteString } from "./pyutils";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);

interface DecoratorRoute {
  url: string;
  methods: string[];
}

/**
 * Extract HTTP routes declared with decorators on top-level handlers:
 *   - FastAPI / APIRouter:  `@app.get("/items")`, `@router.post("/x")`
 *   - Flask:                `@app.route("/x", methods=["GET", "POST"])`
 *
 * Each route becomes a `route` node, a `defines` edge (file -> route), and a
 * `references` edge (route -> handler function) — mirroring the Next.js route
 * model so the graph treats routes uniformly across stacks.
 */
export function extractPyRoutes(
  root: SyntaxNode,
  relPath: string,
  content: string,
  lines: LineMap,
): { nodes: AtharNode[]; edges: AtharEdge[] } {
  const nodes: AtharNode[] = [];
  const edges: AtharEdge[] = [];
  const file = fileId(relPath);
  const seenNode = new Set<string>();
  const seenEdge = new Set<string>();

  const addRoute = (method: string, url: string, handler: string, line: number): void => {
    const rid = routeId(url, method);
    if (!seenNode.has(rid)) {
      seenNode.add(rid);
      nodes.push({
        id: rid,
        type: "route",
        layer: "code",
        label: `${method} ${url}`,
        sourcePath: relPath,
        lineStart: line,
        metadata: { method, url },
      });
    }
    const def = edgeId("defines", file, rid);
    if (!seenEdge.has(def)) {
      seenEdge.add(def);
      edges.push({
        id: def,
        from: file,
        to: rid,
        type: "defines",
        confidence: "extracted",
        evidence: { sourcePath: relPath, lineStart: line },
      });
    }
    const handlerId = functionId(relPath, handler);
    const ref = edgeId("references", rid, handlerId);
    if (!seenEdge.has(ref)) {
      seenEdge.add(ref);
      edges.push({
        id: ref,
        from: rid,
        to: handlerId,
        type: "references",
        confidence: "extracted",
        evidence: { sourcePath: relPath, lineStart: line },
      });
    }
  };

  for (let stmt = root.firstChild; stmt; stmt = stmt.nextSibling) {
    if (stmt.name !== "DecoratedStatement") continue;
    const def = stmt.getChild("FunctionDefinition");
    if (!def) continue;
    const handler = defName(def, content);
    if (!handler) continue;
    const line = lines.lineAt(def.from);
    for (const dec of stmt.getChildren("Decorator")) {
      const route = parseRouteDecorator(dec, content);
      if (!route) continue;
      for (const method of route.methods) addRoute(method, route.url, handler, line);
    }
  }

  return { nodes, edges };
}

/** Parse one decorator into a route, or null if it is not an HTTP route decorator. */
function parseRouteDecorator(dec: SyntaxNode, content: string): DecoratorRoute | null {
  const kids = childrenOf(dec);
  const argList = kids.find((k) => k.name === "ArgList");
  if (!argList) return null; // a plain `@decorator` with no call is never a route

  const segments = kids.filter((k) => k.name === "VariableName").map((k) => text(k, content));
  const method = segments[segments.length - 1]?.toLowerCase();
  if (!method) return null;

  const url = firstStringArg(argList, content);
  if (url === null) return null;

  if (HTTP_METHODS.has(method)) return { url, methods: [method.toUpperCase()] };
  if (method === "route") return { url, methods: flaskMethods(argList, content) };
  return null;
}

/** First positional string literal in an arg list, unquoted, or null. */
function firstStringArg(argList: SyntaxNode, content: string): string | null {
  const s = childrenOf(argList).find((k) => k.name === "String");
  return s ? unquoteString(text(s, content)) : null;
}

/** Flask `methods=[...]` → uppercased verbs; defaults to GET when absent. */
function flaskMethods(argList: SyntaxNode, content: string): string[] {
  const kids = childrenOf(argList);
  const idx = kids.findIndex((k) => k.name === "VariableName" && text(k, content) === "methods");
  if (idx === -1) return ["GET"];
  for (let j = idx + 1; j < kids.length; j++) {
    if (kids[j]!.name === "ArrayExpression") {
      const verbs = childrenOf(kids[j]!)
        .filter((x) => x.name === "String")
        .map((x) => unquoteString(text(x, content)).toUpperCase())
        .filter((v) => v.length > 0);
      return verbs.length > 0 ? verbs : ["GET"];
    }
  }
  return ["GET"];
}
