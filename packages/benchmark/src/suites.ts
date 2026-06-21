/**
 * Load benchmark suites. Task definitions + gold sets live (tracked) under
 * `benchmarks/`; project SOURCE is never copied into this repo — only its path is
 * referenced. A `--project` with no matching suite gets a generic retrieval task
 * (precision/recall report n/a without a curated gold set — honestly).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { norm } from "./normalize";
import type { ProjectDef, ProjectsFile, TaskDef } from "./types";

function normalizeTask(t: TaskDef): TaskDef {
  return { ...t, gold: (t.gold ?? []).map(norm) };
}

/**
 * Refuse to run a suite whose gold is still draft. `kawn benchmark init`
 * scaffolds external suites with machine-suggested gold marked
 * `goldApproved: false`; scoring against unreviewed gold would manufacture a
 * misleading precision/recall. The block is per-task and names exactly what to
 * review, so a human edits the prompt + gold and flips the flag before any run.
 */
export function assertGoldApproved(projects: ProjectDef[]): void {
  const draft: string[] = [];
  for (const p of projects) {
    for (const t of p.tasks) {
      if (t.goldApproved === false) draft.push(`${p.id}/${t.id}`);
    }
  }
  if (draft.length > 0) {
    throw new Error(
      `this suite has ${draft.length} task(s) with draft (unapproved) gold: ${draft.join(", ")}. ` +
        `Review each task's prompt and gold set, then set "goldApproved": true. ` +
        `Draft gold is never scored — that would fabricate precision/recall.`,
    );
  }
}

/** Resolve a project path: absolute as-is, else relative to `repoRoot` (the cwd). */
export function resolveProjectPath(p: string, repoRoot: string): string {
  return path.isAbsolute(p) ? p : path.resolve(repoRoot, p);
}

/** One project/task whose gold set names files that do not exist on disk. */
export interface MissingGoldEntry {
  project: string;
  task: string;
  missing: string[];
}

/**
 * Validate that every gold path actually resolves to a real file under its
 * project root — using the RAW, case-preserving gold strings, never the
 * lowercased {@link norm} form (an `existsSync` on a lowercased path fails on a
 * case-sensitive filesystem). Returns the offenders; empty gold sets (ad-hoc
 * projects) are skipped. Gold entries are file paths, so file existence is the
 * complete check.
 */
export function findMissingGold(
  projects: Array<{ id?: string; path: string; tasks?: Array<{ id: string; gold?: string[] }> }>,
  repoRoot: string,
): MissingGoldEntry[] {
  const out: MissingGoldEntry[] = [];
  for (const p of projects) {
    // A project missing its path isn't this check's concern — let the caller's
    // own validation raise the canonical `missing "path"` error.
    if (!p.path || typeof p.path !== "string") continue;
    const base = resolveProjectPath(p.path, repoRoot);
    for (const t of p.tasks ?? []) {
      const missing = (t.gold ?? []).filter((g) => {
        const rel = String(g ?? "").trim();
        return rel.length > 0 && !fs.existsSync(path.join(base, rel));
      });
      if (missing.length > 0) {
        out.push({ project: p.id ?? path.basename(base), task: t.id, missing });
      }
    }
  }
  return out;
}

/**
 * Refuse to run a suite whose gold names files that no longer exist (e.g. a file
 * was renamed or deleted but the gold wasn't updated — the `scancode.ts` class of
 * bug). Scoring against nonexistent gold fabricates precision/recall, so the block
 * is hard and names exactly which entries to fix.
 */
export function assertGoldExists(
  projects: Array<{ id?: string; path: string; tasks?: Array<{ id: string; gold?: string[] }> }>,
  repoRoot: string,
): void {
  const missing = findMissingGold(projects, repoRoot);
  if (missing.length > 0) {
    const lines = missing.map((m) => `  ${m.project}/${m.task}: ${m.missing.join(", ")}`);
    throw new Error(
      `this suite has gold path(s) that do not exist on disk:\n${lines.join("\n")}\n` +
        `Update the gold to the current file paths, or remove the stale entries. ` +
        `Scoring against nonexistent gold would fabricate precision/recall.`,
    );
  }
}

/** Parse a `--projects-file` suite. Paths are resolved; gold sets normalized. */
export function loadProjectsFile(file: string, repoRoot: string): ProjectDef[] {
  const raw = fs.readFileSync(file, "utf8");
  let parsed: ProjectsFile;
  try {
    parsed = JSON.parse(raw) as ProjectsFile;
  } catch (err) {
    throw new Error(`projects file is not valid JSON: ${file} (${(err as Error).message})`);
  }
  if (!parsed || !Array.isArray(parsed.projects)) {
    throw new Error(`invalid projects file: ${file} (expected { "projects": [ ... ] })`);
  }
  // Validate gold existence against the RAW (case-preserving) paths before
  // normalization lowercases them — an existsSync on a lowercased path would
  // false-negative on a case-sensitive filesystem.
  assertGoldExists(parsed.projects, repoRoot);
  const projects = parsed.projects.map((p, i) => {
    if (!p.path) throw new Error(`project #${i} in ${file} is missing "path"`);
    return {
      id: p.id ?? path.basename(resolveProjectPath(p.path, repoRoot)) ?? `project-${i}`,
      path: resolveProjectPath(p.path, repoRoot),
      model: p.model,
      tasks: (p.tasks ?? []).map(normalizeTask),
    };
  });
  assertGoldApproved(projects);
  return projects;
}

/** Find a suite entry whose resolved path matches a target path (case-insensitive). */
export function findProjectByPath(projects: ProjectDef[], targetPath: string): ProjectDef | undefined {
  const want = path.resolve(targetPath).replace(/[\\/]+$/, "").toLowerCase();
  return projects.find((p) => path.resolve(p.path).replace(/[\\/]+$/, "").toLowerCase() === want);
}

/** A generic, gold-free retrieval task for an ad-hoc project path. */
export function genericProject(projectPath: string): ProjectDef {
  const abs = path.resolve(projectPath);
  return {
    id: path.basename(abs) || "project",
    path: abs,
    tasks: [
      {
        id: "explore",
        prompt:
          "Identify the files, flows, and risks involved in the most important user-facing flow in " +
          "this project. List the exact file paths I should read or change, in order, and call out any " +
          "risks. Do not edit anything.",
        gold: [],
        mode: "retrieval",
      },
    ],
  };
}
