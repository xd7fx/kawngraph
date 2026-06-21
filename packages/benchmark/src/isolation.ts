/**
 * A/B isolation. For every project we stage two clean, commit-pinned copies in the
 * OS temp dir (NEVER inside this repo, NEVER mutating the source):
 *
 *   - `base`     — the control copy, with NO .kawn graph.
 *   - `withBase` — the treatment copy, scanned once so .kawn/graph.json exists.
 *
 * The one-time graph scan is timed and returned as a {@link ScanCost}, kept out of
 * every session timing. Retrieval sessions (read-only) reuse these copies; e2e
 * sessions get a throwaway fresh copy so edits never bleed across runs.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { tmpdir } from "node:os";
import {
  scanRepo,
  generateReport,
  writeGraph,
  writeReport,
  writeManifestForGraph,
  currentGitHead,
} from "@kawngraph/core";
import { resolveMcpLaunch } from "@kawngraph/agents";
import { createLogger, type KawnGraph, type Logger } from "@kawngraph/shared";
import { norm } from "./normalize";
import type { Condition, BenchmarkMode, ChangeSet, ScanCost } from "./types";

/** Directories/files never copied into a staged session (noise or contamination). */
const EXCLUDE_NAMES = new Set([
  ".kawn",
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "benchmark-results",
  ".mcp.json",
  ".cursor",
  ".codex",
  ".DS_Store",
  "Thumbs.db",
]);

function copyFilter(src: string): boolean {
  const base = path.basename(src);
  if (EXCLUDE_NAMES.has(base)) return false;
  if (base.endsWith(".tsbuildinfo")) return false;
  return true;
}

function copyTree(from: string, to: string): void {
  fs.cpSync(from, to, { recursive: true, filter: copyFilter });
}

export interface StagedProject {
  projectId: string;
  /** temp parent that holds base/withBase/configs/e2e copies; removed by cleanup() */
  rootDir: string;
  /** control copy (no .kawn) */
  base: string;
  /** treatment copy (scanned; has .kawn) */
  withBase: string;
  /**
   * The scanned graph (same one written to withBase/.kawn). Kept in memory so
   * the runner can compute KawnGraph Context Pack metrics (family A) deterministically
   * — what KawnGraph would return for a task — without re-reading from disk.
   */
  graph: KawnGraph;
  /** commit the copies are pinned to, when the source is a git repo */
  commit: string | null;
  scanCost: ScanCost;
  /** path to an empty MCP config (the WITHOUT arm) */
  withoutCfg: string;
  /** counter for unique e2e session dir names */
  e2eCounter: number;
}

export interface PrepareOptions {
  projectId: string;
  srcPath: string;
  logger?: Logger;
}

/** Stage + scan a project. Throws clearly if the source path does not exist. */
export async function prepareProject(opts: PrepareOptions): Promise<StagedProject> {
  const log = opts.logger ?? createLogger("info");
  const src = path.resolve(opts.srcPath);
  if (!fs.existsSync(src)) {
    throw new Error(`project not found: ${src}`);
  }

  const commit = currentGitHead(src);
  const rootDir = fs.mkdtempSync(path.join(tmpdir(), "kawn-bench-"));
  const base = path.join(rootDir, "base");
  const withBase = path.join(rootDir, "with");

  log.info(`staging ${opts.projectId} → ${rootDir}${commit ? ` (commit ${commit.slice(0, 8)})` : ""}`);
  copyTree(src, base);
  copyTree(base, withBase);

  // One-time graph scan — timed and reported separately from session metrics.
  const t0 = Date.now();
  const graph = await scanRepo({ root: withBase, logger: log });
  await writeGraph(withBase, graph);
  await writeReport(withBase, generateReport(graph));
  const manifest = await writeManifestForGraph(withBase, graph);
  const scanMs = Date.now() - t0;

  if (!fs.existsSync(path.join(withBase, ".kawn", "graph.json"))) {
    throw new Error("scan did not produce .kawn/graph.json");
  }

  const withoutCfg = path.join(rootDir, "mcp-none.json");
  fs.writeFileSync(withoutCfg, JSON.stringify({ mcpServers: {} }, null, 2), "utf8");

  const scanCost: ScanCost = {
    projectId: opts.projectId,
    scanMs,
    nodes: graph.stats.nodes,
    edges: graph.stats.edges,
    trackedFileCount: manifest.trackedFileCount,
  };
  log.info(`scanned ${opts.projectId}: ${scanCost.nodes} nodes, ${scanCost.edges} edges in ${scanMs} ms`);

  return { projectId: opts.projectId, rootDir, base, withBase, graph, commit, scanCost, withoutCfg, e2eCounter: 0 };
}

/**
 * Resolve how the KawnGraph MCP server is launched on THIS machine and write a Claude
 * `--mcp-config` file rooted at `root`. We force an absolute node binary so the
 * server spawns reliably regardless of PATH.
 */
export function writeWithConfig(parentDir: string, root: string, label: string): string {
  const spec = resolveMcpLaunch(root);
  const command = spec.command === "node" ? process.execPath : spec.command;
  const config = { mcpServers: { kawn: { type: "stdio", command, args: spec.args } } };
  const file = path.join(parentDir, `mcp-kawn-${label}.json`);
  fs.writeFileSync(file, JSON.stringify(config, null, 2), "utf8");
  return file;
}

export interface SessionWorkspace {
  /** working directory the agent runs in */
  cwd: string;
  /** the MCP config to pass (kawn server for WITH, empty for WITHOUT) */
  mcpConfigPath: string;
  /** true when this is a throwaway copy that cleanup of rootDir will remove */
  ephemeral: boolean;
}

/**
 * Produce the workspace for one session.
 *   - retrieval (read-only): reuse the shared base/withBase copies — identical,
 *     clean, zero-cost, and guaranteed not to drift between repeats.
 *   - e2e (edits): hand out a fresh copy so each session starts from the pinned
 *     commit with a clean worktree.
 */
export function sessionWorkspace(
  staged: StagedProject,
  condition: Condition,
  mode: BenchmarkMode,
): SessionWorkspace {
  const sourceDir = condition === "with" ? staged.withBase : staged.base;

  if (mode === "retrieval") {
    const mcpConfigPath =
      condition === "with"
        ? writeWithConfig(staged.rootDir, staged.withBase, "retrieval")
        : staged.withoutCfg;
    return { cwd: sourceDir, mcpConfigPath, ephemeral: false };
  }

  // e2e: fresh, isolated copy
  const label = `${condition}-${staged.e2eCounter++}`;
  const cwd = path.join(staged.rootDir, `e2e-${label}`);
  copyTree(sourceDir, cwd);
  const mcpConfigPath = condition === "with" ? writeWithConfig(staged.rootDir, cwd, label) : staged.withoutCfg;
  return { cwd, mcpConfigPath, ephemeral: true };
}

/**
 * A content snapshot of a workspace: normalized repo-relative path → sha1 of bytes.
 * Used to detect exactly what an e2e session changed, so edits can be graded
 * against the task's change boundary. The same EXCLUDE_NAMES that govern staging
 * are skipped here, so test/build artifacts (node_modules, .next, dist, …) never
 * masquerade as agent edits.
 */
export type DirSnapshot = Map<string, string>;

function walkSnapshot(root: string, dir: string, out: DirSnapshot): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable dir — nothing to snapshot
  }
  for (const entry of entries) {
    if (EXCLUDE_NAMES.has(entry.name) || entry.name.endsWith(".tsbuildinfo")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSnapshot(root, abs, out);
    } else if (entry.isFile()) {
      try {
        const buf = fs.readFileSync(abs);
        out.set(norm(path.relative(root, abs)), crypto.createHash("sha1").update(buf).digest("hex"));
      } catch {
        /* skip files we cannot read */
      }
    }
  }
}

/** Snapshot a workspace's file contents for later change detection. */
export function snapshotDir(root: string): DirSnapshot {
  const out: DirSnapshot = new Map();
  walkSnapshot(root, root, out);
  return out;
}

/** Diff the current workspace against a pre-run snapshot into added/modified/removed. */
export function diffSnapshot(root: string, pre: DirSnapshot): ChangeSet {
  const post = snapshotDir(root);
  const modified: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  for (const [f, h] of post) {
    const old = pre.get(f);
    if (old === undefined) added.push(f);
    else if (old !== h) modified.push(f);
  }
  for (const f of pre.keys()) if (!post.has(f)) removed.push(f);
  return { modified, added, removed };
}

/** Remove a staged project's temp tree. Best effort. */
export function cleanup(staged: StagedProject): void {
  try {
    fs.rmSync(staged.rootDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}
