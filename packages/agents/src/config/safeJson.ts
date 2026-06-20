import * as fs from "node:fs/promises";

export interface JsonRead<T> {
  /** the file exists on disk */
  exists: boolean;
  /** parsed value, or null when absent or not valid JSON */
  data: T | null;
  /** raw bytes as read, when the file exists (preserved for backups/diffs) */
  raw: string | null;
  /** file exists but could not be parsed as JSON */
  malformed: boolean;
}

/**
 * Tolerant JSON read. Never throws: a missing file and a malformed file are
 * distinct, reported states so callers can refuse to clobber a file they could
 * not understand (we never overwrite unrelated/garbled config blindly).
 */
export async function readJsonFile<T = unknown>(absPath: string): Promise<JsonRead<T>> {
  let raw: string;
  try {
    raw = await fs.readFile(absPath, "utf8");
  } catch {
    return { exists: false, data: null, raw: null, malformed: false };
  }
  try {
    const data = JSON.parse(raw) as T;
    return { exists: true, data, raw, malformed: false };
  } catch {
    return { exists: true, data: null, raw, malformed: true };
  }
}

/** Stable pretty JSON with a trailing newline, matching the repo's other writers. */
export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
