import * as fs from "node:fs";
import * as path from "node:path";
import { Logger } from "@athar/shared";
import {
  runBenchmark,
  loadProjectsFile,
  findProjectByPath,
  genericProject,
  initExternalProject,
  mergeReports,
  readReportFile,
  writeReports,
  type AgentKind,
  type BenchmarkMode,
  type BenchmarkReport,
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

export interface BenchmarkInitArgs {
  /** external project path (positional after `init`, or --project) */
  project?: string;
  /** explicit output file (else a gitignored benchmarks/local/<id>.bench.json) */
  outFile?: string;
  /** a concrete prompt → Athar suggests a draft gold set for it */
  task?: string;
  mode: BenchmarkMode;
  force: boolean;
  logger: Logger;
}

/** `athar benchmark init` — scaffold a LOCAL-ONLY draft suite for an external repo. */
export async function runBenchmarkInitCommand(args: BenchmarkInitArgs): Promise<void> {
  const { logger } = args;
  const repoRoot = process.cwd();
  if (!args.project) {
    logger.error("usage: athar benchmark init --project <path> [--task \"<prompt>\"] [--mode e2e] [--out <file>]");
    process.exitCode = 2;
    return;
  }
  try {
    const res = await initExternalProject({
      projectPath: args.project,
      repoRoot,
      outFile: args.outFile,
      task: args.task,
      mode: args.mode,
      force: args.force,
      logger,
    });
    logger.success(`wrote draft suite: ${res.outFile}`);
    logger.info(
      `project "${res.projectId}", ${res.taskCount} task(s)` +
        (res.suggestedGold > 0 ? `, ${res.suggestedGold} draft gold file(s) suggested` : ""),
    );
    logger.info(
      "next: edit the prompts + gold, set \"goldApproved\": true per task, then run " +
        `\`athar benchmark --projects-file <that file>\`. The file is gitignored — keep it local.`,
    );
  } catch (err) {
    logger.error((err as Error).message);
    process.exitCode = 2;
  }
}

export interface BenchmarkMergeArgs {
  /** report JSONs (and/or directories of them) to combine — positionals after `merge` */
  inputs: string[];
  /** output dir (default: <cwd>/benchmark-results) */
  outDir?: string;
  logger: Logger;
}

/** Expand a merge input: a file is taken as-is; a directory yields its benchmark-*.json
 *  (never the merged-*.json outputs, so re-running merge can't fold a prior merge in). */
function expandMergeInputs(inputs: string[], repoRoot: string): string[] {
  const files: string[] = [];
  for (const raw of inputs) {
    const p = path.resolve(repoRoot, raw);
    if (!fs.existsSync(p)) throw new Error(`merge input not found: ${p}`);
    if (fs.statSync(p).isDirectory()) {
      const here = fs
        .readdirSync(p)
        .filter((f) => /^benchmark-.*\.json$/.test(f))
        .sort()
        .map((f) => path.join(p, f));
      if (here.length === 0) throw new Error(`no benchmark-*.json reports in directory: ${p}`);
      files.push(...here);
    } else {
      files.push(p);
    }
  }
  // de-dup while preserving order
  return [...new Set(files)];
}

/** `athar benchmark merge <report.json|dir> …` — stitch chunked runs into one report. */
export async function runBenchmarkMergeCommand(args: BenchmarkMergeArgs): Promise<void> {
  const { logger } = args;
  const repoRoot = process.cwd();
  const outDir = args.outDir ? path.resolve(repoRoot, args.outDir) : path.join(repoRoot, "benchmark-results");

  if (!args.inputs || args.inputs.length === 0) {
    logger.error('usage: athar benchmark merge <report.json|dir> [<report.json> …] [--out-dir <dir>]');
    process.exitCode = 2;
    return;
  }

  try {
    const files = expandMergeInputs(args.inputs, repoRoot);
    logger.info(`merging ${files.length} report(s):`);
    for (const f of files) logger.info(`  - ${f}`);
    const reports: BenchmarkReport[] = files.map(readReportFile);
    const merged = mergeReports(reports);
    const base = `merged-${merged.createdAt.replace(/[:.]/g, "-")}`;
    const written = writeReports(merged, outDir, base);
    const ok = merged.runs.filter((r) => r.ok).length;
    logger.success(`wrote ${written.json}`);
    logger.success(`wrote ${written.csv}`);
    logger.success(`wrote ${written.md}`);
    logger.info(
      `merged ${merged.runs.length} run(s) from ${files.length} report(s): ${ok} ok, ` +
        `${merged.runs.length - ok} failed · agents [${merged.agents.join(", ")}] · mode ${merged.mode} · deepest arm n=${merged.repeat}`,
    );
  } catch (err) {
    logger.error((err as Error).message);
    process.exitCode = 2;
  }
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
