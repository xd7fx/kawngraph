import type { SyntaxNode } from "@lezer/common";
import { AtharEdge, fileId, edgeId } from "@athar/shared";
import type { PyScanContext } from "./context";
import { LineMap, childrenOf, text, firstLine } from "./pyutils";

export interface PyImportedName {
  /** repo-relative file the name is imported from */
  file: string;
  /** the symbol name in the target module (handles `import x as y`) */
  exportName: string;
}

export interface PyImportsResult {
  edges: AtharEdge[];
  /** local name -> origin, used to resolve cross-file calls */
  importedNames: Map<string, PyImportedName>;
  /** module specifiers that did not resolve to a scanned file (stdlib/third-party) */
  externalImports: string[];
}

interface NamePart {
  local: string;
  exported: string;
}

/**
 * Extract module-level imports into `imports` edges (file -> resolved module
 * file) plus the local-name map used to resolve cross-file calls. Only top-level
 * statements are scanned, matching the TS scanner. Imports that cannot be
 * resolved to a scanned file are recorded as external rather than invented.
 */
export function extractPyImports(
  root: SyntaxNode,
  relPath: string,
  content: string,
  lines: LineMap,
  ctx: PyScanContext,
): PyImportsResult {
  const edges: AtharEdge[] = [];
  const importedNames = new Map<string, PyImportedName>();
  const externalImports: string[] = [];
  const file = fileId(relPath);
  const seenEdge = new Set<string>();

  const link = (targetRel: string, line: number, snippet: string): void => {
    const to = fileId(targetRel);
    const id = edgeId("imports", file, to);
    if (seenEdge.has(id)) return;
    seenEdge.add(id);
    edges.push({
      id,
      from: file,
      to,
      type: "imports",
      confidence: "linked",
      evidence: { sourcePath: relPath, lineStart: line, snippet },
    });
  };

  for (let stmt = root.firstChild; stmt; stmt = stmt.nextSibling) {
    if (stmt.name !== "ImportStatement") continue;
    const kids = childrenOf(stmt);
    const line = lines.lineAt(stmt.from);
    const snippet = firstLine(text(stmt, content));

    if (kids[0]?.name === "from") {
      handleFromImport(kids, content, ctx, link, importedNames, externalImports, line, snippet);
    } else if (kids[0]?.name === "import") {
      handlePlainImport(kids, content, ctx, link, externalImports, line, snippet);
    }
  }

  return { edges, importedNames, externalImports };
}

/** `from <dots><a.b> import x, y as z, *` */
function handleFromImport(
  kids: SyntaxNode[],
  content: string,
  ctx: PyScanContext,
  link: (targetRel: string, line: number, snippet: string) => void,
  importedNames: Map<string, PyImportedName>,
  externalImports: string[],
  line: number,
  snippet: string,
): void {
  let i = 1;
  let dots = 0;
  while (i < kids.length && kids[i]!.name === ".") {
    dots++;
    i++;
  }
  // dotted module path before the `import` keyword
  const parts: string[] = [];
  while (i < kids.length && kids[i]!.name === "VariableName") {
    parts.push(text(kids[i]!, content));
    i++;
    if (i < kids.length && kids[i]!.name === ".") i++; // skip the separating dot
    else break;
  }
  while (i < kids.length && kids[i]!.name !== "import") i++;
  i++; // skip `import`

  const names = parseImportedNames(kids, i, content);

  if (parts.length > 0) {
    const target = ctx.resolveModule(dots, parts);
    if (target) {
      link(target, line, snippet);
      for (const n of names) {
        if (n.local !== "*") importedNames.set(n.local, { file: target, exportName: n.exported });
      }
    } else {
      externalImports.push(moduleLabel(dots, parts));
    }
  } else {
    // `from . import a, b` — each imported name is a sibling submodule
    let anyResolved = false;
    for (const n of names) {
      if (n.local === "*") continue;
      const target = ctx.resolveModule(dots, [n.exported]);
      if (target) {
        link(target, line, snippet);
        anyResolved = true;
      }
    }
    if (!anyResolved) externalImports.push(moduleLabel(dots, []));
  }
}

/** `import a.b.c as x, d.e` */
function handlePlainImport(
  kids: SyntaxNode[],
  content: string,
  ctx: PyScanContext,
  link: (targetRel: string, line: number, snippet: string) => void,
  externalImports: string[],
  line: number,
  snippet: string,
): void {
  let parts: string[] = [];
  let expectAlias = false;
  const flush = (): void => {
    if (parts.length === 0) return;
    const target = ctx.resolveModule(0, parts);
    if (target) link(target, line, snippet);
    else externalImports.push(parts.join("."));
    parts = [];
  };

  for (let i = 1; i < kids.length; i++) {
    const nm = kids[i]!.name;
    if (nm === ",") {
      flush();
      expectAlias = false;
    } else if (nm === ".") {
      continue;
    } else if (nm === "as") {
      expectAlias = true;
    } else if (nm === "VariableName") {
      if (expectAlias) expectAlias = false; // alias binds the module locally; not a call target
      else parts.push(text(kids[i]!, content));
    }
  }
  flush();
}

/** Parse the comma-separated import list after `import`, honoring `as` aliases and `*`. */
function parseImportedNames(kids: SyntaxNode[], start: number, content: string): NamePart[] {
  const names: NamePart[] = [];
  let cur: NamePart | null = null;
  const flush = (): void => {
    if (cur) {
      names.push(cur);
      cur = null;
    }
  };
  for (let i = start; i < kids.length; i++) {
    const nm = kids[i]!.name;
    if (nm === "(" || nm === ")") continue;
    if (nm === ",") {
      flush();
    } else if (nm === "*") {
      names.push({ local: "*", exported: "*" });
    } else if (nm === "as") {
      // the next VariableName is the local alias for the current clause
    } else if (nm === "VariableName") {
      const t = text(kids[i]!, content);
      if (!cur) cur = { local: t, exported: t };
      else cur.local = t; // alias after `as`
    }
  }
  flush();
  return names;
}

function moduleLabel(dots: number, parts: string[]): string {
  return ".".repeat(dots) + parts.join(".");
}
