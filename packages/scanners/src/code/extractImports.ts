import * as ts from "typescript";
import { KawnEdge, fileId, packageId, edgeId } from "@kawngraph/shared";
import { lineOf, snippetOf } from "./tsutils";
import { CodeScanContext } from "./context";

export interface ImportedName {
  /** target file relPath the name is imported from */
  file: string;
  /** the exported name in the target file (handles `import { a as b }`) */
  exportName: string;
}

export interface ImportsResult {
  edges: KawnEdge[];
  /** local name -> where it came from, used to resolve cross-file calls */
  importedNames: Map<string, ImportedName>;
  externalImports: string[];
}

function collectNamedImports(clause?: ts.ImportClause): { local: string; exported: string }[] {
  const out: { local: string; exported: string }[] = [];
  const nb = clause?.namedBindings;
  if (nb && ts.isNamedImports(nb)) {
    for (const el of nb.elements) {
      out.push({ local: el.name.text, exported: (el.propertyName ?? el.name).text });
    }
  }
  return out;
}

export function extractImports(sf: ts.SourceFile, relPath: string, ctx: CodeScanContext): ImportsResult {
  const edges: KawnEdge[] = [];
  const importedNames = new Map<string, ImportedName>();
  const externalImports: string[] = [];
  const file = fileId(relPath);

  const handle = (
    specifier: string,
    named: { local: string; exported: string }[],
    line: number,
    snippet: string,
  ): void => {
    const targetRel = ctx.resolveImport(specifier);
    if (targetRel) {
      const to = fileId(targetRel);
      edges.push({
        id: edgeId("imports", file, to),
        from: file,
        to,
        type: "imports",
        confidence: "linked",
        evidence: { sourcePath: relPath, lineStart: line, snippet },
      });
      for (const n of named) importedNames.set(n.local, { file: targetRel, exportName: n.exported });
      return;
    }
    const pkg = ctx.matchWorkspacePackage(specifier);
    if (pkg) {
      const to = packageId(pkg);
      edges.push({
        id: edgeId("imports", file, to),
        from: file,
        to,
        type: "imports",
        confidence: "linked",
        evidence: { sourcePath: relPath, lineStart: line, snippet },
      });
      return;
    }
    externalImports.push(specifier);
  };

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      handle(stmt.moduleSpecifier.text, collectNamedImports(stmt.importClause), lineOf(sf, stmt), snippetOf(sf, stmt));
    } else if (
      ts.isExportDeclaration(stmt) &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      // re-export: `export { a } from "./x"` implies a dependency on ./x
      handle(stmt.moduleSpecifier.text, [], lineOf(sf, stmt), snippetOf(sf, stmt));
    }
  }

  return { edges, importedNames, externalImports };
}
