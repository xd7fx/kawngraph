/**
 * A/B isolation. For every project we stage two clean, commit-pinned copies in the
 * OS temp dir (NEVER inside this repo, NEVER mutating the source):
 *
 *   - `base`     — the control copy, with NO .athar graph.
 *   - `withBase` — the treatment copy, scanned once so .athar/graph.json exists.
 *
 * The one-time graph scan is timed and returned as a {@link ScanCost}, kept out of
 * every session timing. Retrieval sessions (read-only) reuse these copies; e2e
 * sessions get a throwaway fresh copy so edits never bleed across runs.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import {
  scanRepo,
  generateReport,
  writeGraph,
  writeReport,
  writeManifestForGraph,
  currentGitHead,
} from "@athar/core";
import { resolveMcpLaunch } from "@athar/agents";
import { createLogger, type Logger } from "@athar/shared";
import type { Condition, BenchmarkMode, ScanCost } from "./types";

/** Directories/files never copied into a staged session (noise or contamination). */
const EXCLUDE_NAMES = new Set([
  ".athar",
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
  /** control copy (no .athar) */
  base: string;
  /** treatment copy (scanned; has .athar) */
  withBase: string;
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
  const rootDir = fs.mkdtempSync(path.join(tmpdir(), "athar-bench-"));
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

  if (!fs.existsSync(path.join(withBase, ".athar", "graph.json"))) {
    throw new Error("scan did not produce .athar/graph.json");
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

  return { projectId: opts.projectId, rootDir, base, withBase, commit, scanCost, withoutCfg, e2eCounter: 0 };
}

/**
 * Resolve how the Athar MCP server is launched on THIS machine and write a Claude
 * `--mcp-config` file rooted at `root`. We force an absolute node binary so the
 * server spawns reliably regardless of PATH.
 */
export function writeWithConfig(parentDir: string, root: string, label: string): string {
  const spec = resolveMcpLaunch(root);
  const command = spec.command === "node" ? process.execPath : spec.command;
  const config = { mcpServers: { athar: { type: "stdio", command, args: spec.args } } };
  const file = path.join(parentDir, `mcp-athar-${label}.json`);
  fs.writeFileSync(file, JSON.stringify(config, null, 2), "utf8");
  return file;
}

export interface SessionWorkspace {
  /** working directory the agent runs in */
  cwd: string;
  /** the MCP config to pass (athar server for WITH, empty for WITHOUT) */
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

/** Remove a staged project's temp tree. Best effort. */
export function cleanup(staged: StagedProject): void {
  try {
    fs.rmSync(staged.rootDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}
