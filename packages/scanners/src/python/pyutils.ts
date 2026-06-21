/**
 * Small, pure helpers over a `@lezer/python` syntax tree. Lezer hands back a
 * concrete syntax tree of `SyntaxNode`s with character offsets; these helpers
 * turn that into the names, line numbers, and text slices the Python scanner
 * needs without re-walking the source repeatedly.
 */
import type { SyntaxNode } from "@lezer/common";

/**
 * Maps character offsets to 1-based line numbers. The newline index is built
 * once per file so each lookup is an O(log n) binary search rather than an
 * O(n) rescan — important for large generated Python files.
 */
export class LineMap {
  private readonly starts: number[];

  constructor(content: string) {
    const starts = [0];
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10 /* \n */) starts.push(i + 1);
    }
    this.starts = starts;
  }

  /** 1-based line number containing character offset `pos`. */
  lineAt(pos: number): number {
    const starts = this.starts;
    let lo = 0;
    let hi = starts.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid]! <= pos) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans + 1;
  }
}

/** Source text covered by a node. */
export function text(node: SyntaxNode, content: string): string {
  return content.slice(node.from, node.to);
}

/** First line of a (possibly multi-line) string, used for compact edge snippets. */
export function firstLine(s: string): string {
  const nl = s.indexOf("\n");
  return (nl === -1 ? s : s.slice(0, nl)).trim();
}

/** All direct children of a node, in source order. */
export function childrenOf(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let c = node.firstChild; c; c = c.nextSibling) out.push(c);
  return out;
}

/** True if a node has a direct child of the given type. */
export function hasChild(node: SyntaxNode, type: string): boolean {
  return node.getChild(type) != null;
}

/** The defined name of a Function/ClassDefinition (its first VariableName child), or null. */
export function defName(def: SyntaxNode, content: string): string | null {
  const n = def.getChild("VariableName");
  return n ? text(n, content) : null;
}

/**
 * The FunctionDefinition / ClassDefinition a top-level statement defines. A bare
 * definition is itself; a `DecoratedStatement` (one or more `@decorator`s) wraps
 * the definition, so we unwrap it.
 */
export function definitionOf(stmt: SyntaxNode): SyntaxNode | null {
  if (stmt.name === "FunctionDefinition" || stmt.name === "ClassDefinition") return stmt;
  if (stmt.name === "DecoratedStatement") {
    return stmt.getChild("FunctionDefinition") ?? stmt.getChild("ClassDefinition");
  }
  return null;
}

/**
 * True if a definition is module-level: a direct child of the script, or wrapped
 * in a top-level `DecoratedStatement`. Nested functions and class methods are not
 * top-level (mirrors the TS scanner, which emits only top-level symbols).
 */
export function isTopLevelDef(def: SyntaxNode): boolean {
  const p = def.parent;
  if (!p) return false;
  if (p.name === "Script") return true;
  return p.name === "DecoratedStatement" && p.parent?.name === "Script";
}

/** Strip an optional string prefix (f/r/b/u…) and surrounding quotes from a Python string literal. */
export function unquoteString(raw: string): string {
  const s = raw.replace(/^[A-Za-z]+/, "");
  for (const q of ['"""', "'''", '"', "'"]) {
    if (s.length >= q.length * 2 && s.startsWith(q) && s.endsWith(q)) {
      return s.slice(q.length, s.length - q.length);
    }
  }
  return s;
}

/**
 * The dotted name of a single `@decorator`, built from its `VariableName`
 * segments — `@app.get(...)` -> "app.get", `@staticmethod` -> "staticmethod",
 * `@pkg.mod.deco` -> "pkg.mod.deco". The call arguments (an `ArgList`) are
 * ignored; only the callee path is the name.
 */
export function decoratorNameOf(dec: SyntaxNode, content: string): string {
  return childrenOf(dec)
    .filter((k) => k.name === "VariableName")
    .map((k) => text(k, content))
    .join(".");
}

/** Names of every decorator on a `DecoratedStatement`, in source order (empty for a bare def). */
export function decoratorNames(stmt: SyntaxNode, content: string): string[] {
  if (stmt.name !== "DecoratedStatement") return [];
  return stmt
    .getChildren("Decorator")
    .map((d) => decoratorNameOf(d, content))
    .filter((n) => n.length > 0);
}

/** A method captured as structured metadata on its class node (never a separate graph node). */
export interface PyMethodInfo {
  name: string;
  line: number;
  async: boolean;
  decorators?: string[];
  /** true for a unittest-style `test_*` method (helps light up the test layer for class-based suites) */
  isTest?: boolean;
}

/**
 * Direct methods of a `ClassDefinition` — the `def`/`async def` statements in its
 * `Body`, each with a 1-based line and its decorators. Nested functions and inner
 * classes are intentionally excluded (only the class's own methods). Mirrors the
 * top-level rule that methods are not separate nodes; here they are evidence-rich
 * metadata on the owning class.
 */
export function classMethods(classDef: SyntaxNode, content: string, lines: LineMap): PyMethodInfo[] {
  const body = classDef.getChild("Body");
  if (!body) return [];
  const out: PyMethodInfo[] = [];
  for (let c = body.firstChild; c; c = c.nextSibling) {
    const def = definitionOf(c);
    if (!def || def.name !== "FunctionDefinition") continue;
    const name = defName(def, content);
    if (!name) continue;
    const decorators = decoratorNames(c, content);
    const info: PyMethodInfo = { name, line: lines.lineAt(def.from), async: hasChild(def, "async") };
    if (decorators.length > 0) info.decorators = decorators;
    if (/^test/.test(name)) info.isTest = true;
    out.push(info);
  }
  return out;
}

/** First line of a module-level docstring (the leading bare string statement), or undefined. */
export function moduleDocstring(root: SyntaxNode, content: string): string | undefined {
  const first = root.firstChild;
  if (!first || first.name !== "ExpressionStatement") return undefined;
  const str = first.getChild("String");
  if (!str) return undefined;
  const doc = firstLine(unquoteString(text(str, content)));
  return doc.length > 0 ? doc : undefined;
}
