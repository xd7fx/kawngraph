/**
 * Orchestration. For each project × task × agent, run the A/B test:
 *   - A = `without` KawnGraph (control), B = `with` KawnGraph (treatment),
 *   - identical commit / prompt / model / permissions / timeout / clean worktree,
 *   - A/B order randomized per repeat, each condition repeated `repeat` times,
 *   - `retrieval` sessions are read-only; `e2e` sessions edit a fresh copy and the
 *     harness (not the agent) runs the task's test command to grade the change.
 *
 * The graph scan is a one-time per-project setup cost, recorded separately.
 */
import { KAWN_VERSION, createLogger, type Logger } from "@kawngraph/shared";
import { runShell } from "./proc";
import { preflight, formatReadiness } from "./preflight";
import { prepareProject, sessionWorkspace, snapshotDir, diffSnapshot, cleanup } from "./isolation";
import { getAdapter } from "./adapters";
import { computeMetrics, computeKawnPack, gradeChangeBoundary } from "./metrics";
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
        // Family A — KawnGraph Context Pack quality. Deterministic and agent-independent,
        // so compute it ONCE per task here and attach to the WITH runs only (it is
        // identical across agents and repeats). This is what KawnGraph returns, not what
        // any agent chose to open.
        const kawnPack = computeKawnPack(staged.graph, task);

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
              // Snapshot the workspace BEFORE the agent runs (e2e only): lets us
              // attribute exactly which files it changed, and is taken before tests
              // so test/build output never masquerades as an agent edit.
              const preSnapshot = mode === "e2e" ? snapshotDir(ws.cwd) : null;
              const startedAt = new Date().toISOString();
              log.info(`run: ${agent} ${condition.padEnd(7)} ${project.id}/${task.id} repeat ${repeat}/${opts.repeat} (${mode})`);

              const { session, transcript } = await adapter.run({
                condition,
                withKawnGraph: condition === "with",
                cwd: ws.cwd,
                mcpConfigPath: ws.mcpConfigPath,
                prompt: task.prompt,
                model,
                timeoutMs: opts.timeoutMs,
                allowEdits,
                logger: log,
              });

              const metrics = session.ok ? computeMetrics(session, task) : null;
              if (metrics && mode === "e2e" && session.ok) {
                // Grade the change boundary first, from the pre-run snapshot, so the
                // diff reflects only the agent's edits — not anything the tests create.
                if (preSnapshot) {
                  const changed = diffSnapshot(ws.cwd, preSnapshot);
                  const boundary = gradeChangeBoundary(changed, task);
                  metrics.filesChanged = boundary.filesChanged;
                  metrics.filesChangedOutsideGold = boundary.filesChangedOutsideGold;
                }
                if (task.testCommand) {
                  metrics.testsPassed = gradeTests(ws.cwd, task.testCommand, opts.timeoutMs, log);
                }
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
                kawnPack: condition === "with" ? kawnPack : null,
                session,
                startedAt,
              };
              runs.push(run);
              writeTranscript(opts.outDir, run, transcript);

              if (!session.ok) log.warn(`  failed: ${session.failure ?? "unknown"}`);
              else log.success(`  ok in ${session.wallMs} ms · tools ${session.tools.length} · kawn ${metrics?.kawnCalled ? (metrics.kawnFirst ? "first" : "yes") : "no"}`);
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
    kawnVersion: KAWN_VERSION,
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
