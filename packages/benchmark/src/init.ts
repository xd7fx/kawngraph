/**
 * Scaffold a LOCAL-ONLY benchmark suite for an external project (e.g. a private
 * product repo). The external project's SOURCE is never copied and its PATH is
 * never committed: the generated suite lands under a gitignored directory and is
 * marked draft. KawnGraph may *suggest* a gold set by scanning the project in memory
 * (read-only — nothing is written into the external tree), but every task starts
 * `goldApproved: false`, so the runner refuses to score it until a human reviews
 * the prompt + gold and approves it. This is the only honest way to benchmark a
 * repo we have no curated ground truth for.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { scanRepo, buildContextPack } from "@kawngraph/core";
import type { Logger } from "@kawngraph/shared";
import type { BenchmarkMode, TaskDef } from "./types";

export interface InitOptions {
  /** path to the external project root (absolute, or relative to repoRoot) */
  projectPath: string;
  /** the KawnGraph repo root (cwd) — controls where the draft suite is written */
  repoRoot: string;
  /** explicit output file; defaults to a gitignored `benchmarks/local/<id>.bench.json` */
  outFile?: string;
  /** a concrete task prompt; when given, KawnGraph suggests a draft gold set for it */
  task?: string;
  /** mode for the `--task` task (default retrieval) */
  mode?: BenchmarkMode;
  /** overwrite an existing draft instead of refusing */
  force?: boolean;
  logger: Logger;
}

export interface InitResult {
  /** absolute path to the written draft suite */
  outFile: string;
  projectId: string;
  taskCount: number;
  /** how many draft gold files KawnGraph suggested (0 unless --task was given) */
  suggestedGold: number;
}

/** How many top-ranked files to seed as draft gold for a `--task` suggestion. */
const SUGGEST_LIMIT = 8;

function projectIdFor(absPath: string): string {
  return path.basename(absPath).replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase() || "project";
}

/** A reviewer-facing template task (empty prompt/gold, awaiting human curation). */
function templateTask(id: string, mode: BenchmarkMode): TaskDef {
  return {
    id,
    mode,
    goldApproved: false,
    prompt: "",
    gold: [],
    ...(mode === "retrieval"
      ? { expectMentions: [] }
      : { testCommand: "" }),
  };
}

/**
 * Scan the external project in memory and return the Context Pack's top files as
 * a *draft* gold suggestion for `prompt`. Read-only: nothing is written into the
 * external tree. Returns repo-relative posix paths (already what the pack emits).
 */
async function suggestGold(projectAbs: string, prompt: string, logger: Logger): Promise<string[]> {
  const graph = await scanRepo({ root: projectAbs, logger });
  const pack = buildContextPack(graph, prompt);
  const seen = new Set<string>();
  for (const item of pack.mustRead) {
    if (item.sourcePath && !seen.has(item.sourcePath)) seen.add(item.sourcePath);
    if (seen.size >= SUGGEST_LIMIT) break;
  }
  return [...seen];
}

export async function initExternalProject(opts: InitOptions): Promise<InitResult> {
  const { logger } = opts;
  const projectAbs = path.resolve(opts.repoRoot, opts.projectPath);
  if (!fs.existsSync(projectAbs)) {
    throw new Error(`project not found: ${projectAbs}`);
  }
  if (!fs.statSync(projectAbs).isDirectory()) {
    throw new Error(`project path is not a directory: ${projectAbs}`);
  }

  const id = projectIdFor(projectAbs);
  const outFile = opts.outFile
    ? path.resolve(opts.repoRoot, opts.outFile)
    : path.join(opts.repoRoot, "benchmarks", "local", `${id}.bench.json`);

  if (fs.existsSync(outFile) && !opts.force) {
    throw new Error(`draft already exists: ${outFile} (use --force to overwrite)`);
  }

  const mode: BenchmarkMode = opts.mode ?? "retrieval";
  let tasks: TaskDef[];
  let suggestedGold = 0;

  if (opts.task && opts.task.trim()) {
    const gold = await suggestGold(projectAbs, opts.task.trim(), logger);
    suggestedGold = gold.length;
    tasks = [
      {
        id: "task-1",
        mode,
        goldApproved: false,
        prompt: opts.task.trim(),
        gold,
        ...(mode === "retrieval" ? { expectMentions: [] } : { testCommand: "" }),
      },
    ];
    logger.info(
      suggestedGold > 0
        ? `suggested ${suggestedGold} draft gold file(s) from KawnGraph's Context Pack — review before approving.`
        : `KawnGraph found no confident files for that prompt; fill the gold set in by hand.`,
    );
  } else {
    // No prompt → scaffold one retrieval + one e2e template for the human to fill.
    tasks = [templateTask("retrieval-1", "retrieval"), templateTask("e2e-1", "e2e")];
  }

  const draft = {
    _draft: true,
    _note:
      "LOCAL-ONLY draft suite. Do NOT commit this file: it references an external " +
      "project path, and its source/transcripts/results must stay out of git. " +
      "Review every prompt and gold set, then set \"goldApproved\": true per task. " +
      "Until then the runner refuses to score these tasks.",
    projects: [
      {
        id,
        path: projectAbs,
        tasks,
      },
    ],
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(draft, null, 2) + "\n", "utf8");

  return { outFile, projectId: id, taskCount: tasks.length, suggestedGold };
}
