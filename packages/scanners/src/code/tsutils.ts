import * as ts from "typescript";

export function scriptKindFor(relPath: string): ts.ScriptKind {
  if (relPath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (relPath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (relPath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

export function createSource(relPath: string, content: string): ts.SourceFile {
  return ts.createSourceFile(
    relPath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKindFor(relPath),
  );
}

export function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

export function endLineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
}

export function snippetOf(sf: ts.SourceFile, node: ts.Node, max = 120): string {
  const text = node.getText(sf).replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function isExported(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const mods = ts.getModifiers(node);
  return !!mods && mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}
