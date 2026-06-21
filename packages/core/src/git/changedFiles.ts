import { execFileSync } from "node:child_process";

/**
 * Local-git change detection for KawnGraph's PR/diff impact features.
 *
 * Read-only and offline by contract: this module only ever *reads* the local
 * git object database (`git diff`, `git ls-files`, `git rev-parse`). It never
 * fetches, never talks to a remote, never writes anything — and it never calls
 * the GitHub (or any) API. The "PR" in `kawn pr-impact` is purely local: a
 * branch compared to its merge-base with a base ref you already have.
 */

/** Normalized git change status for a single path. */
export type ChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "typechange"
  | "other";

export interface ChangedFile {
  /** root-relative POSIX path (the NEW path for renames/copies). */
  path: string;
  status: ChangeStatus;
  /** previous path, only for renames/copies. */
  oldPath?: string;
}

export interface ChangeSetOptions {
  /**
   * Base ref to compare against (PR mode). When set, the comparison is
   * `<base>...<head>` — git's three-dot form, i.e. what `head` adds since it
   * diverged from `base` (the merge-base). This mirrors how a PR diff is shown.
   */
  base?: string;
  /** Head ref for PR mode (default `HEAD`). Ignored when `base` is unset. */
  head?: string;
  /** Include untracked files (working-tree mode only; default true). */
  includeUntracked?: boolean;
}

export interface ChangeSet {
  /** Human-readable description of what was compared. */
  label: string;
  /** The diff range used in PR mode, or null in working-tree mode. */
  range: string | null;
  files: ChangedFile[];
}

export type GitErrorCode = "git-missing" | "not-a-repo" | "bad-ref" | "no-head" | "git-failed";

/** A typed, user-actionable failure from the git layer (never a raw stack). */
export class GitError extends Error {
  readonly code: GitErrorCode;
  constructor(code: GitErrorCode, message: string) {
    super(message);
    this.name = "GitError";
    this.code = code;
  }
}

const GIT_TIMEOUT_MS = 8000;

interface GitRun {
  ok: boolean;
  stdout: string;
  /** present only when the process ran but exited non-zero */
  status: number | null;
  /** set when git itself could not be spawned (not installed) */
  missing: boolean;
}

/** Run a read-only git command under `root`, capturing stdout. Never throws. */
function git(root: string, args: string[]): GitRun {
  try {
    const stdout = execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
    });
    return { ok: true, stdout, status: 0, missing: false };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { status?: number; stdout?: Buffer | string };
    if (e.code === "ENOENT") return { ok: false, stdout: "", status: null, missing: true };
    const stdout = typeof e.stdout === "string" ? e.stdout : e.stdout?.toString("utf8") ?? "";
    return { ok: false, stdout, status: typeof e.status === "number" ? e.status : null, missing: false };
  }
}

/** True when `root` is inside a git work tree. */
export function isGitRepo(root: string): boolean {
  const r = git(root, ["rev-parse", "--is-inside-work-tree"]);
  return r.ok && r.stdout.trim() === "true";
}

/** Verify a ref resolves to a commit; returns the resolved sha or null. */
function resolveCommit(root: string, ref: string): string | null {
  const r = git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  const sha = r.stdout.trim();
  return r.ok && sha.length > 0 ? sha : null;
}

function mapStatusLetter(letter: string): ChangeStatus {
  switch (letter) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "T":
      return "typechange";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    default:
      return "other";
  }
}

/**
 * Parse `git diff --name-status -z` output. The `-z` stream is NUL-separated:
 * a status token followed by one path (or, for renames/copies, an old and a new
 * path). NUL framing means paths with spaces/unicode/quotes are handled exactly,
 * with no shell-quoting ambiguity.
 */
export function parseNameStatusZ(out: string): ChangedFile[] {
  const parts = out.split("\0");
  const files: ChangedFile[] = [];
  let i = 0;
  while (i < parts.length) {
    const code = parts[i++];
    if (code === undefined || code === "") break; // trailing separator / end
    const letter = code[0];
    if (letter === "R" || letter === "C") {
      const oldPath = parts[i++];
      const newPath = parts[i++];
      if (newPath === undefined) break;
      files.push({ path: newPath, status: mapStatusLetter(letter), oldPath });
    } else {
      const p = parts[i++];
      if (p === undefined) break;
      files.push({ path: p, status: mapStatusLetter(letter) });
    }
  }
  return files;
}

/** Parse NUL-separated `git ls-files -z` output into plain paths. */
function parseZList(out: string): string[] {
  return out.split("\0").filter((s) => s.length > 0);
}

function dedupeSorted(files: ChangedFile[]): ChangedFile[] {
  const byPath = new Map<string, ChangedFile>();
  for (const f of files) {
    // A path may appear from both the tracked diff and (defensively) elsewhere;
    // keep the first, which is the diff's authoritative status.
    if (!byPath.has(f.path)) byPath.set(f.path, f);
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Compute the set of changed files for `root`, either against a base ref (PR
 * mode) or in the working tree (uncommitted edits). Throws {@link GitError}
 * with an actionable code when git is missing, `root` is not a repo, a ref is
 * unknown, or HEAD is unborn. Read-only and offline.
 */
export function gitChangedFiles(root: string, opts: ChangeSetOptions = {}): ChangeSet {
  // Probe with a cheap command first to tell "git missing" from "not a repo".
  const probe = git(root, ["rev-parse", "--is-inside-work-tree"]);
  if (probe.missing) throw new GitError("git-missing", "git is not installed or not on PATH.");
  if (!probe.ok || probe.stdout.trim() !== "true") {
    throw new GitError("not-a-repo", `"${root}" is not inside a git repository.`);
  }

  // `--relative` scopes the diff to `root` and makes every path root-relative,
  // matching the graph's sourcePath even when `root` is a subdirectory.
  // `--find-renames` forces rename detection on regardless of the user's
  // `diff.renames` config, so a rename is reported as `renamed` (with its old
  // path) deterministically — never silently as a delete + add.
  const DIFF_FLAGS = ["diff", "--name-status", "--find-renames", "-z", "--relative"];
  if (opts.base !== undefined) {
    const head = opts.head ?? "HEAD";
    if (!resolveCommit(root, opts.base)) throw new GitError("bad-ref", `unknown base ref: "${opts.base}".`);
    if (!resolveCommit(root, head)) throw new GitError("bad-ref", `unknown head ref: "${head}".`);
    const range = `${opts.base}...${head}`;
    const r = git(root, [...DIFF_FLAGS, range]);
    if (!r.ok) throw new GitError("git-failed", `git diff ${range} failed.`);
    return { label: range, range, files: dedupeSorted(parseNameStatusZ(r.stdout)) };
  }

  // Working-tree mode: everything that differs from HEAD (staged + unstaged),
  // plus untracked files surfaced as additions.
  if (!resolveCommit(root, "HEAD")) {
    throw new GitError("no-head", "this repository has no commits yet (HEAD is unborn).");
  }
  const diff = git(root, [...DIFF_FLAGS, "HEAD"]);
  if (!diff.ok) throw new GitError("git-failed", "git diff HEAD failed.");
  const files = parseNameStatusZ(diff.stdout);

  if (opts.includeUntracked !== false) {
    const others = git(root, ["ls-files", "--others", "--exclude-standard", "-z"]);
    if (others.ok) {
      for (const p of parseZList(others.stdout)) files.push({ path: p, status: "added" });
    }
  }

  return { label: "working tree vs HEAD", range: null, files: dedupeSorted(files) };
}
