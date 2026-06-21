import * as fs from "node:fs/promises";
import * as path from "node:path";
import { posixBasename } from "@kawngraph/shared";

export interface IgnoreRules {
  /** directory names skipped anywhere in the tree */
  dirs: Set<string>;
  /** path/glob patterns (relative to root) */
  patterns: string[];
}

// SQL is intentionally NOT ignored. Public asset folders are skipped by default.
const DEFAULT_DIRS = [
  "node_modules",
  ".git",
  ".kawn",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".turbo",
  ".cache",
  ".vercel",
  "vendor",
];

export async function loadIgnoreRules(absRoot: string, extra: string[] = []): Promise<IgnoreRules> {
  const dirs = new Set<string>(DEFAULT_DIRS);
  const patterns: string[] = [];

  for (const item of extra) addRule(item, dirs, patterns);

  try {
    const raw = await fs.readFile(path.join(absRoot, ".kawnignore"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      addRule(trimmed, dirs, patterns);
    }
  } catch {
    // no .kawnignore present — defaults only
  }

  return { dirs, patterns };
}

function addRule(rule: string, dirs: Set<string>, patterns: string[]): void {
  const clean = rule.replace(/\/+$/, "").replace(/^\.\//, "");
  if (!clean) return;
  // a bare name (no slash, no glob, no dot) is treated as a directory name
  if (!clean.includes("/") && !clean.includes("*") && !clean.includes(".")) {
    dirs.add(clean);
  } else {
    patterns.push(clean);
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isIgnoredPath(relPath: string, rules: IgnoreRules): boolean {
  for (const p of rules.patterns) {
    if (p.endsWith("/*")) {
      const dir = p.slice(0, -2);
      if (relPath === dir || relPath.startsWith(dir + "/")) return true;
    } else if (p.includes("*")) {
      const re = new RegExp("^" + p.split("*").map(escapeRe).join("[^/]*") + "$");
      if (re.test(relPath) || re.test(posixBasename(relPath))) return true;
    } else if (relPath === p || relPath.startsWith(p + "/")) {
      return true;
    }
  }
  return false;
}
