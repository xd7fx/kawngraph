import * as fs from "node:fs/promises";
import * as path from "node:path";
import { KawnGraph, Logger, createLogger, relPosix, toPosix } from "@kawngraph/shared";
import { builtinScannerPlugins } from "@kawngraph/scanners";
import { ScannerRegistry, makeScanFile, type FileInput } from "@kawngraph/scanner-sdk";
import { buildGraph } from "../graph/graphBuilder";
import { classifyFile } from "./classifyFile";
import { loadIgnoreRules, isIgnoredPath, IgnoreRules } from "./loadIgnoreRules";

export interface ScanRepoOptions {
  /** path to scan, as provided by the user */
  root: string;
  /** extra ignore patterns */
  ignore?: string[];
  logger?: Logger;
}

/**
 * Walk a repository and build the KawnGraph graph.
 *
 * Scanning is delegated to the {@link ScannerRegistry}: the built-in scanners
 * (TS/JS, SQL, Markdown, package.json) are registered as versioned plugins and
 * orchestrated deterministically (detect -> scan -> finalize). The core remains
 * responsible only for walking the tree, reading files once, and assembling the
 * final graph. {@link classifyFile} decides *readability* (skip binaries and
 * ambient `.d.ts`); each plugin's own `detect()` decides ownership.
 */
export async function scanRepo(opts: ScanRepoOptions): Promise<KawnGraph> {
  const log = opts.logger ?? createLogger("info");
  const absRoot = path.resolve(opts.root);
  const displayRoot = toPosix(opts.root) || ".";

  const ignore = await loadIgnoreRules(absRoot, opts.ignore ?? []);
  const files: string[] = [];
  await walk(absRoot, absRoot, ignore, files);

  const inputs: FileInput[] = [];
  let codeN = 0;
  let sqlN = 0;
  let docN = 0;
  let pkgN = 0;
  for (const rel of files) {
    const kind = classifyFile(rel);
    if (kind === "ignore") continue;
    if (kind === "code") codeN++;
    else if (kind === "sql") sqlN++;
    else if (kind === "docs") docN++;
    else if (kind === "packageJson") pkgN++;
    const content = await readSafe(path.join(absRoot, rel), log);
    if (content === null) continue;
    inputs.push({ file: makeScanFile(rel, content), content });
  }
  log.info(
    `scanning ${displayRoot}: ${codeN} code, ${sqlN} sql, ${docN} docs, ${pkgN} package.json`,
  );

  const registry = new ScannerRegistry();
  for (const plugin of builtinScannerPlugins()) registry.register(plugin);
  const scan = await registry.scan(inputs, { root: displayRoot });

  for (const d of scan.diagnostics) {
    if (d.level === "error" || d.level === "warn") {
      log.warn(`scanner${d.sourcePath ? ` (${d.sourcePath})` : ""}: ${d.message}`);
    }
  }

  const graph = buildGraph([{ nodes: scan.nodes, edges: scan.edges }], { root: displayRoot });
  log.success(`built graph: ${graph.stats.nodes} nodes, ${graph.stats.edges} edges`);
  return graph;
}

async function walk(absDir: string, absRoot: string, ignore: IgnoreRules, out: string[]): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    const rel = relPosix(absRoot, abs);
    if (entry.isDirectory()) {
      if (ignore.dirs.has(entry.name)) continue;
      if (isIgnoredPath(rel, ignore)) continue;
      await walk(abs, absRoot, ignore, out);
    } else if (entry.isFile()) {
      if (isIgnoredPath(rel, ignore)) continue;
      out.push(rel);
    }
  }
}

async function readSafe(abs: string, log: Logger): Promise<string | null> {
  try {
    return await fs.readFile(abs, "utf8");
  } catch (err) {
    log.warn(`could not read ${abs}: ${(err as Error).message}`);
    return null;
  }
}
