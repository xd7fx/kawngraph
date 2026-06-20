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

/** Resolve a project path: absolute as-is, else relative to `repoRoot` (the cwd). */
export function resolveProjectPath(p: string, repoRoot: string): string {
  return path.isAbsolute(p) ? p : path.resolve(repoRoot, p);
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
  return parsed.projects.map((p, i) => {
    if (!p.path) throw new Error(`project #${i} in ${file} is missing "path"`);
    return {
      id: p.id ?? path.basename(resolveProjectPath(p.path, repoRoot)) ?? `project-${i}`,
      path: resolveProjectPath(p.path, repoRoot),
      model: p.model,
      tasks: (p.tasks ?? []).map(normalizeTask),
    };
  });
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
