import * as fs from "node:fs";
import * as path from "node:path";
import { Logger } from "@athar/shared";
import {
  runBenchmark,
  loadProjectsFile,
  findProjectByPath,
  genericProject,
  type AgentKind,
  type BenchmarkMode,
  type ProjectDef,
} from "@athar/benchmark";

export interface BenchmarkArgs {
  /** a single project path (positional or --project) */
  project?: string;
  /** a suite file (--projects-file) */
  projectsFile?: string;
  /** claude | codex | both */
  agent: string;
  repeat: number;
  seed: number;
  /** session timeout in seconds */
  timeoutSec: number;
  mode: BenchmarkMode;
  /** output dir (default: <cwd>/benchmark-results) */
  outDir?: string;
  logger: Logger;
}

function parseAgents(sel: string): AgentKind[] {
  const s = (sel || "claude").toLowerCase();
  if (s === "both") return ["claude", "codex"];
  if (s === "claude" || s === "codex") return [s];
  throw new Error(`--agent must be claude|codex|both (got "${sel}")`);
}

function defaultSuitePath(repoRoot: string): string {
  return path.join(repoRoot, "benchmarks", "projects.json");
}

function resolveProjects(args: BenchmarkArgs, repoRoot: string, logger: Logger): ProjectDef[] {
  // 1) explicit suite file
  if (args.projectsFile) {
    const file = path.resolve(repoRoot, args.projectsFile);
    if (!fs.existsSync(file)) throw new Error(`projects file not found: ${file}`);
    logger.info(`loading suite: ${file}`);
    return loadProjectsFile(file, repoRoot);
  }

  // 2) a single project path — use a bundled suite entry if one matches, else generic
  if (args.project) {
    const abs = path.resolve(repoRoot, args.project);
    if (!fs.existsSync(abs)) throw new Error(`project not found: ${abs}`);
    const suite = defaultSuitePath(repoRoot);
    if (fs.existsSync(suite)) {
      const match = findProjectByPath(loadProjectsFile(suite, repoRoot), abs);
      if (match) {
        logger.info(`using suite definition for ${match.id} (${match.tasks.length} task(s))`);
        return [match];
      }
    }
    logger.warn(`no curated suite for ${abs}; using a generic retrieval task (precision/recall report n/a without a gold set).`);
    return [genericProject(abs)];
  }

  // 3) nothing specified — run the bundled default suite if present
  const suite = defaultSuitePath(repoRoot);
  if (fs.existsSync(suite)) {
    logger.info(`no --project/--projects-file given; running default suite: ${suite}`);
    return loadProjectsFile(suite, repoRoot);
  }
  throw new Error("nothing to benchmark: pass --project <path> or --projects-file <file>.");
}

export async function runBenchmarkCommand(args: BenchmarkArgs): Promise<void> {
  const { logger } = args;
  const repoRoot = process.cwd();
  const outDir = args.outDir ? path.resolve(repoRoot, args.outDir) : path.join(repoRoot, "benchmark-results");

  let agents: AgentKind[];
  let projects: ProjectDef[];
  try {
    agents = parseAgents(args.agent);
    projects = resolveProjects(args, repoRoot, logger);
  } catch (err) {
    logger.error((err as Error).message);
    process.exitCode = 2;
    return;
  }

  const taskCount = projects.reduce((n, p) => n + p.tasks.length, 0);
  if (taskCount === 0) {
    logger.error("the selected suite has no tasks.");
    process.exitCode = 2;
    return;
  }
  logger.info(
    `benchmarking ${projects.length} project(s), ${taskCount} task(s), agents [${agents.join(", ")}], ` +
      `repeat ${args.repeat}, seed ${args.seed}, mode ${args.mode}, timeout ${args.timeoutSec}s`,
  );

  let outcome;
  try {
    outcome = await runBenchmark({
      repoRoot,
      projects,
      agents,
      repeat: args.repeat,
      seed: args.seed,
      mode: args.mode,
      timeoutMs: args.timeoutSec * 1000,
      outDir,
      logger,
    });
  } catch (err) {
    // preflight gate or a setup error — clean message, no stack
    logger.error((err as Error).message);
    process.exitCode = 2;
    return;
  }

  const { report, written } = outcome;
  const total = report.runs.length;
  const ok = report.runs.filter((r) => r.ok).length;
  const failed = total - ok;

  logger.success(`wrote ${written.json}`);
  logger.success(`wrote ${written.csv}`);
  logger.success(`wrote ${written.md}`);
  logger.info(`sessions: ${ok}/${total} ok${failed ? `, ${failed} failed` : ""}`);

  if (ok === 0) {
    logger.error(
      "no session completed — every run failed (commonly a subscription auth wall). " +
        "See the report's failure section. No metrics are fabricated.",
    );
    process.exitCode = 2;
  }
}
