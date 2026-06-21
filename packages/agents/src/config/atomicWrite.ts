import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomBytes } from "node:crypto";

/** Ensure the parent directory of `absPath` exists. */
export async function ensureParentDir(absPath: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
}

/**
 * Write `contents` to `absPath` atomically: write a sibling temp file, fsync it,
 * then rename it over the target. Rename is atomic on a single volume on both
 * POSIX and Windows (Node maps it to MoveFileEx with REPLACE_EXISTING), so a
 * reader never observes a half-written config — we either keep the old file or
 * have the complete new one.
 */
export async function atomicWriteFile(absPath: string, contents: string): Promise<void> {
  await ensureParentDir(absPath);
  const dir = path.dirname(absPath);
  const tmp = path.join(dir, `.${path.basename(absPath)}.kawn-${randomBytes(6).toString("hex")}.tmp`);
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(tmp, "w");
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(tmp, absPath);
  } catch (err) {
    if (handle) await handle.close().catch(() => undefined);
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}

/** Directory where KawnGraph keeps timestamped backups of files it edits. */
export function backupsDir(root: string): string {
  return path.join(root, ".kawn", "backups");
}

/**
 * Copy `absPath` into `.kawn/backups/` before we modify it, so every change is
 * reversible. Returns the backup's absolute path, or null when the source file
 * does not exist (nothing to back up).
 */
export async function backupFile(absPath: string, root: string): Promise<string | null> {
  let data: Buffer;
  try {
    data = await fs.readFile(absPath);
  } catch {
    return null;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rel = (path.relative(root, absPath) || path.basename(absPath)).replace(/[\\/]/g, "__");
  const dir = backupsDir(root);
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, `${stamp}__${rel}`);
  await fs.writeFile(dest, data);
  return dest;
}

/** Remove a file if it exists; resolves quietly when it does not. */
export async function removeFileIfExists(absPath: string): Promise<boolean> {
  try {
    await fs.rm(absPath, { force: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove the immediate parent directory of `absPath` when it is now empty —
 * e.g. drop a self-created `.codex/` or `.cursor/` after deleting the only file
 * KawnGraph put there, so disconnect is a clean round-trip. Uses `rmdir`, which
 * fails on a non-empty directory, so any unrelated user files keep the dir
 * alive. Never removes the project root. Returns true only if it removed a dir.
 */
export async function removeEmptyParentDir(absPath: string, root: string): Promise<boolean> {
  const dir = path.dirname(absPath);
  if (path.resolve(dir) === path.resolve(root)) return false;
  try {
    await fs.rmdir(dir);
    return true;
  } catch {
    return false;
  }
}
