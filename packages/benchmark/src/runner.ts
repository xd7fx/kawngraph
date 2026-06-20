/**
 * Orchestration. For each project × task × agent, run the A/B test:
 *   - A = `without` Athar (control), B = `with` Athar (treatment),
 *   - identical commit / prompt / model / permissions / timeout / clean worktree,
 *   - A/B order randomized per repeat, each condition repeated `repeat` times,
 *   - `retrieval` sessions are read-only; `e2e` sessions edit a fresh copy and the
 *     harness (not the agent) runs the task's test command to grade the change.
 *
 * The graph scan is a one-time per-project setup cost, recorded separately.
 */
import { ATHAR_VERSION, createLogger, type Logger } from "@athar/shared";
import { runShell } from "./proc";
import { preflight, formatReadiness } from "./preflight";
import { prepareProject, sessionWorkspace, cleanup } from "./isolation";
import { getAdapter } from "./adapters";
import { computeMetrics } from "./metrics";
import { writeReports, writeTranscript, type WrittenReports } from "./reports";
import { Rng, conditionOrder } from "./random";
import type {
  AgentKind,
  BenchmarkMode,
  BenchmarkReport,
  BenchmarkRun,
  Condition,
  ProjectDef,
  ScanCost,
} from "./types";

export interface BenchmarkOptions {
  /** the cwd the command was invoked from (used only for display) */
  repoRoot: string;
  projects: ProjectDef[];
  agents: AgentKind[];
  repeat: number;
  seed: number;
  /** default mode; a task may override via TaskDef.mode */
  mode: BenchmarkMode;
  timeoutMs: number;
  /** where reports + transcripts are written (gitignored) */
  outDir: string;
  logger?: Logger;
  /** bypass the hard preflight gate (diagnostics only) */
  skipPreflight?: boolean;
}

export interface BenchmarkOutcome {
  report: BenchmarkReport;
  written: WrittenReports;
}

function gradeTests(cwd: string, testCommand: string, timeoutMs: number, log: Logger): boolean {
  log.info(`  grading e2e: ${testCommand}`);
  const r = runShell(testCommand, { cwd, timeoutMs });
  return r.status === 0;
}

/** Run the full benchmark and write reports. Throws clearly if preflight fails. */
export async function runBenchmark(opts: BenchmarkOptions): Promise<BenchmarkOutcome> {
  const log = opts.logger ?? createLogger("info");

  // ---- preflight (no credentials are read or printed) ----------------------
  const pf = preflight(opts.agents);
  log.info("authentication readiness:\n" + formatReadiness(pf.readiness));
  if (!pf.ready && !opts.skipPreflight) {
    const lines = pf.blocking.map((b) => `  - ${b.agent}: ${b.detail}${b.remediation ? ` → ${b.remediation}` : ""}`);
    throw new Error(`requested agent(s) not available:\n${lines.join("\n")}`);
  }

  if (opts.repeat < 3) {
    log.warn(`repeat=${opts.repeat} is below the recommended minimum of 3; results will be noisier.`);
  }

  const rng = new Rng(opts.seed);
  const runs: BenchmarkRun[] = [];
  const scanCosts: ScanCost[] = [];
  const createdAt = new Date().toISOString();

  for (const project of opts.projects) {
    const staged = await prepareProject({ projectId: project.id, srcPath: project.path, logger: log });
    scanCosts.push(staged.scanCost);
    try {
      for (const task of project.tasks) {
        const mode = task.mode ?? opts.mode;
        const allowEdits = mode === "e2e";
        const model = project.model ?? null;

        for (const agent of opts.agents) {
          const adapter = getAdapter(agent);
          if (!adapter.available()) {
            log.warn(`skipping ${agent} for ${project.id}/${task.id}: CLI not available`);
            continue;
          }

          for (let repeat = 1; repeat <= opts.repeat; repeat++) {
            const order: Condition[] = conditionOrder(rng);
            for (const condition of order) {
              const ws = sessionWorkspace(staged, condition, mode);
              const startedAt = new Date().toISOString();
              log.info(`run: ${agent} ${condition.padEnd(7)} ${project.id}/${task.id} repeat ${repeat}/${opts.repeat} (${mode})`);

              const { session, transcript } = await adapter.run({
                condition,
                withAthar: condition === "with",
                cwd: ws.cwd,
                mcpConfigPath: ws.mcpConfigPath,
                prompt: task.prompt,
                model,
                timeoutMs: opts.timeoutMs,
                allowEdits,
                logger: log,
              });

              const metrics = session.ok ? computeMetrics(session, task) : null;
              if (metrics && mode === "e2e" && task.testCommand && session.ok) {
                metrics.testsPassed = gradeTests(ws.cwd, task.testCommand, opts.timeoutMs, log);
              }

              const run: BenchmarkRun = {
                projectId: project.id,
                taskId: task.id,
                agent,
                condition,
                repeat,
                mode,
                commit: staged.commit,
                model,
                ok: session.ok,
                failure: session.failure,
                metrics,
                session,
                startedAt,
              };
              runs.push(run);
              writeTranscript(opts.outDir, run, transcript);

              if (!session.ok) log.warn(`  failed: ${session.failure ?? "unknown"}`);
              else log.success(`  ok in ${session.wallMs} ms · tools ${session.tools.length} · athar ${metrics?.atharCalled ? (metrics.atharFirst ? "first" : "yes") : "no"}`);
            }
          }
        }
      }
    } finally {
      cleanup(staged);
    }
  }

  const modes = new Set(runs.map((r) => r.mode));
  const report: BenchmarkReport = {
    atharVersion: ATHAR_VERSION,
    createdAt,
    seed: opts.seed,
    mode: modes.size === 1 ? [...modes][0] : "mixed",
    repeat: opts.repeat,
    agents: opts.agents,
    readiness: pf.readiness,
    scanCosts,
    runs,
    env: { platform: `${process.platform}/${process.arch}`, node: process.version },
  };

  const written = writeReports(report, opts.outDir);
  return { report, written };
}
