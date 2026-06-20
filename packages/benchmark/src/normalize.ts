/**
 * Cross-agent normalization helpers. Both the Claude and Codex adapters reduce
 * their native tool events to {@link ToolCall}s using these functions, so metrics
 * never need to know which agent produced a session.
 */
import type { ToolCall, ToolKind } from "./types";

/** Normalize any path-ish string to repo-relative, posix, lowercase for comparison. */
export function norm(p: string): string {
  return String(p ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^[a-z]:\//i, "") // strip a Windows drive root if an absolute path leaked in
    .toLowerCase()
    .replace(/^\/+/, "");
}

/**
 * Make an absolute (or messy) path relative to a project root, then normalize.
 * Used so a Read("C:\\tmp\\proj\\src\\x.ts") inside a staged copy at C:\\tmp\\proj
 * compares equal to a gold entry of "src/x.ts".
 */
export function relToRoot(filePath: string, rootDir: string): string {
  const f = String(filePath ?? "").replace(/\\/g, "/");
  const r = String(rootDir ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
  if (r && f.toLowerCase().startsWith(r.toLowerCase() + "/")) {
    return norm(f.slice(r.length + 1));
  }
  return norm(f);
}

/** The leaf tool name, stripping any MCP `server__tool` prefix. */
export function toolBaseName(name: string): string {
  return name.includes("__") ? name.split("__").pop()! : name;
}

/** Is this an Athar MCP tool call? */
export function isAtharTool(name: string): boolean {
  return name.startsWith("mcp__athar__") || /(^|__)athar_(context|query|affected)$/.test(name);
}

/** Classify a raw tool name into a normalized family. */
export function classifyTool(name: string): ToolKind {
  if (isAtharTool(name)) return "athar";
  const base = toolBaseName(name).toLowerCase();
  if (base === "read") return "read";
  if (base === "grep" || base === "search" || base.includes("grep")) return "grep";
  if (base === "glob" || base === "find" || base.includes("glob")) return "glob";
  if (base === "edit" || base === "multiedit" || base === "apply_patch" || base === "applypatch") return "edit";
  if (base === "write" || base === "create_file" || base === "createfile") return "write";
  if (base === "bash" || base === "shell" || base === "exec" || base.includes("command")) return "bash";
  return "other";
}

/**
 * Extract the repo-relative file a tool call touched, when one is determinable.
 * `rootDir` is the session's working directory so absolute paths can be relativized.
 */
export function extractFile(name: string, input: unknown, rootDir: string): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const i = input as Record<string, unknown>;
  const kind = classifyTool(name);

  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = i[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return undefined;
  };

  let raw: string | undefined;
  if (kind === "read" || kind === "edit" || kind === "write") {
    raw = pick("file_path", "path", "filePath", "file", "target_file");
  } else if (kind === "grep") {
    // grep only "opens" a file when scoped to a concrete file path (has an extension)
    const p = pick("path", "file", "file_path");
    if (p && /\.[a-z0-9]+$/i.test(p)) raw = p;
  }
  // glob, bash, athar, other: no single file opened
  return raw ? relToRoot(raw, rootDir) : undefined;
}

/** Build a normalized ToolCall from a raw name + input + observed timestamp. */
export function toToolCall(name: string, input: unknown, rootDir: string, atMs?: number): ToolCall {
  return {
    name,
    kind: classifyTool(name),
    athar: isAtharTool(name),
    file: extractFile(name, input, rootDir),
    atMs,
  };
}
