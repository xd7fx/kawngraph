import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  AtharGraph,
  AtharEdge,
  ScanResult,
  Logger,
  createLogger,
  relPosix,
  toPosix,
  posixDirname,
  posixJoin,
  packageId,
  edgeId,
} from "@athar/shared";
import { scanCode, scanSql, scanPackageJson, scanDocs, linkDocsToCode, DocScan, CodeScanContext } from "@athar/scanners";
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

interface PackageInfo {
  id: string;
  name: string;
  dir: string;
  deps: string[];
}

const CODE_EXTS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const INDEX_FILES = ["index.ts", "index.tsx", "index.js", "index.jsx"];

/** Walk a repository and build the Athar graph. */
export async function scanRepo(opts: ScanRepoOptions): Promise<AtharGraph> {
  const log = opts.logger ?? createLogger("info");
  const absRoot = path.resolve(opts.root);
  const displayRoot = toPosix(opts.root) || ".";

  const ignore = await loadIgnoreRules(absRoot, opts.ignore ?? []);
  const files: string[] = [];
  await walk(absRoot, absRoot, ignore, files);

  const codeFiles: string[] = [];
  const sqlFiles: string[] = [];
  const docFiles: string[] = [];
  const pkgFiles: string[] = [];
  for (const rel of files) {
    const kind = classifyFile(rel);
    if (kind === "code") codeFiles.push(rel);
    else if (kind === "sql") sqlFiles.push(rel);
    else if (kind === "docs") docFiles.push(rel);
    else if (kind === "packageJson") pkgFiles.push(rel);
  }
  log.info(
    `scanning ${displayRoot}: ${codeFiles.length} code, ${sqlFiles.length} sql, ${docFiles.length} docs, ${pkgFiles.length} package.json`,
  );

  const results: ScanResult[] = [];

  // 1) packages first — their names are needed to resolve bare imports
  const packages: PackageInfo[] = [];
  for (const rel of pkgFiles) {
    const content = await readSafe(path.join(absRoot, rel), log);
    if (content === null) continue;
    const res = scanPackageJson(rel, content);
    results.push(res);
    for (const node of res.nodes) {
      const meta = node.metadata ?? {};
      packages.push({
        id: node.id,
        name: node.label,
        dir: typeof meta["dir"] === "string" ? (meta["dir"] as string) : ".",
        deps: Array.isArray(meta["dependencies"]) ? (meta["dependencies"] as string[]) : [],
      });
    }
  }
  const workspaceNames = new Set(packages.map((p) => p.name));
  const fileSet = new Set(codeFiles);

  const makeCtx = (fromRel: string): CodeScanContext => ({
    resolveImport: (specifier) => resolveImport(fromRel, specifier, fileSet),
    matchWorkspacePackage: (specifier) => matchWorkspacePackage(specifier, workspaceNames),
  });

  // 2) code
  for (const rel of codeFiles) {
    const content = await readSafe(path.join(absRoot, rel), log);
    if (content === null) continue;
    try {
      results.push(scanCode(rel, content, makeCtx(rel)));
    } catch (err) {
      log.warn(`failed to scan ${rel}: ${(err as Error).message}`);
    }
  }

  // 3) sql
  for (const rel of sqlFiles) {
    const content = await readSafe(path.join(absRoot, rel), log);
    if (content === null) continue;
    try {
      results.push(scanSql(rel, content));
    } catch (err) {
      log.warn(`failed to scan ${rel}: ${(err as Error).message}`);
    }
  }

  // 4) docs — structural nodes now; code links are a post-pass once all nodes exist
  const docScans: DocScan[] = [];
  for (const rel of docFiles) {
    const content = await readSafe(path.join(absRoot, rel), log);
    if (content === null) continue;
    try {
      const { result, doc } = scanDocs(rel, content);
      results.push(result);
      docScans.push(doc);
    } catch (err) {
      log.warn(`failed to scan ${rel}: ${(err as Error).message}`);
    }
  }

  // 5) cross-cutting edges (belongs_to, depends_on)
  results.push(derivePackageEdges(results, packages, workspaceNames));

  // 6) docs -> code links (no LLM), resolved against the full node set
  if (docScans.length > 0) {
    const allNodes = results.flatMap((r) => r.nodes);
    results.push(linkDocsToCode(docScans, allNodes));
  }

  const graph = buildGraph(results, { root: displayRoot });
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

function resolveImport(fromRel: string, specifier: string, fileSet: Set<string>): string | null {
  if (!specifier.startsWith(".")) return null;
  const target = posixJoin(posixDirname(fromRel), specifier);
  for (const ext of CODE_EXTS) {
    if (fileSet.has(target + ext)) return target + ext;
  }
  for (const idx of INDEX_FILES) {
    const cand = posixJoin(target, idx);
    if (fileSet.has(cand)) return cand;
  }
  return null;
}

function matchWorkspacePackage(specifier: string, names: Set<string>): string | null {
  for (const name of names) {
    if (specifier === name || specifier.startsWith(name + "/")) return name;
  }
  return null;
}

function derivePackageEdges(results: ScanResult[], packages: PackageInfo[], workspaceNames: Set<string>): ScanResult {
  const edges: AtharEdge[] = [];
  const byDirDesc = [...packages].sort((a, b) => b.dir.length - a.dir.length);

  const nearest = (rel: string): PackageInfo | null => {
    for (const p of byDirDesc) {
      const matches = p.dir === "." ? true : rel === p.dir || rel.startsWith(p.dir + "/");
      if (matches) return p;
    }
    return null;
  };

  for (const result of results) {
    for (const node of result.nodes) {
      if (node.type !== "file" && node.type !== "migration") continue;
      const pkg = nearest(node.sourcePath);
      if (!pkg) continue;
      edges.push({
        id: edgeId("belongs_to", node.id, pkg.id),
        from: node.id,
        to: pkg.id,
        type: "belongs_to",
        confidence: "linked",
        evidence: { sourcePath: node.sourcePath },
      });
    }
  }

  for (const pkg of packages) {
    for (const dep of pkg.deps) {
      if (!workspaceNames.has(dep)) continue;
      const to = packageId(dep);
      edges.push({
        id: edgeId("depends_on", pkg.id, to),
        from: pkg.id,
        to,
        type: "depends_on",
        confidence: "extracted",
        evidence: { sourcePath: pkg.dir === "." ? "package.json" : `${pkg.dir}/package.json` },
      });
    }
  }

  return { nodes: [], edges };
}
