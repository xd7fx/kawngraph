import { toPosix } from "./paths";

/**
 * Stable, content-addressable node IDs of the form `"<type>:<identifier>"`.
 * IDs never depend on line numbers, so the graph diffs cleanly across scans.
 */

export function fileId(relPath: string): string {
  return `file:${toPosix(relPath)}`;
}

export function functionId(relPath: string, name: string): string {
  return `function:${toPosix(relPath)}#${name}`;
}

export function classId(relPath: string, name: string): string {
  return `class:${toPosix(relPath)}#${name}`;
}

export function routeId(urlPath: string, method: string): string {
  return `route:${urlPath}#${method.toUpperCase()}`;
}

/** Table names are folded to lower case (unquoted SQL identifiers are case-insensitive). */
export function tableId(name: string): string {
  return `table:${name.toLowerCase()}`;
}

export function migrationId(relPath: string): string {
  return `migration:${toPosix(relPath)}`;
}

/** A documentation file (markdown/mdx). */
export function docId(relPath: string): string {
  return `doc:${toPosix(relPath)}`;
}

/** A heading-delimited section within a doc; `slug` is a stable, deduped heading slug. */
export function sectionId(relPath: string, slug: string): string {
  return `section:${toPosix(relPath)}#${slug}`;
}

export function packageId(name: string): string {
  return `package:${name}`;
}

/** Deterministic edge ID so re-scans dedupe rather than duplicate. */
export function edgeId(type: string, from: string, to: string): string {
  return `${type}|${from}|${to}`;
}
