/**
 * Block-aware TOML editing for Codex's `config.toml`.
 *
 * KawnGraph never parses arbitrary TOML and re-serializes it — that would silently
 * drop comments, reorder tables, and rewrite values the user owns. Instead we:
 *   1. render ONLY the tightly-controlled shapes KawnGraph itself produces
 *      (basic strings, string arrays, a flat string env table), and
 *   2. edit a single named table (`[mcp_servers.kawn]`) as a contiguous text
 *      block, leaving every other line — comments and unrelated tables — byte
 *      for byte intact.
 *
 * This is structured at the table-block level, not fragile character
 * replacement: we locate the real header line and the block's real end (the
 * next table header or EOF), and swap exactly that span.
 */

function escapeBasicString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

export function tomlString(s: string): string {
  return `"${escapeBasicString(s)}"`;
}

export function tomlStringArray(items: string[]): string {
  return `[${items.map(tomlString).join(", ")}]`;
}

const BARE_KEY = /^[A-Za-z0-9_-]+$/;
function bareOrQuoted(key: string): string {
  return BARE_KEY.test(key) ? key : tomlString(key);
}

export interface TomlMcpServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/** Render a `[mcp_servers.<name>]` table block (no trailing blank line). */
export function renderMcpServerBlock(name: string, server: TomlMcpServer): string {
  const lines: string[] = [];
  lines.push(`[mcp_servers.${bareOrQuoted(name)}]`);
  lines.push(`command = ${tomlString(server.command)}`);
  lines.push(`args = ${tomlStringArray(server.args)}`);
  if (server.env && Object.keys(server.env).length > 0) {
    const entries = Object.entries(server.env)
      .map(([k, v]) => `${bareOrQuoted(k)} = ${tomlString(v)}`)
      .join(", ");
    lines.push(`env = { ${entries} }`);
  }
  return lines.join("\n");
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match a dotted table header like `mcp_servers.kawn`, allowing spaces and quoted segments. */
function tableHeaderRegex(dotted: string): RegExp {
  const segs = dotted.split(".").map((s) => `(?:${escapeReg(s)}|"${escapeReg(s)}")`);
  return new RegExp(`^\\s*\\[\\s*${segs.join("\\s*\\.\\s*")}\\s*\\]\\s*$`);
}

/** Any standard table `[x]` or array-of-tables `[[x]]` header. */
const ANY_HEADER = /^\s*\[\[?/;

export interface BlockEdit {
  source: string;
  changed: boolean;
  action: "inserted" | "replaced" | "unchanged" | "removed";
}

export function hasTomlTable(source: string, dotted: string): boolean {
  const header = tableHeaderRegex(dotted);
  return source.split("\n").some((l) => header.test(l));
}

/**
 * Detect an INLINE definition of `<parent>.<name>` written as a dotted-key inline
 * table (e.g. `mcp_servers.kawn = { command = ... }`) or a key under an open
 * `[mcp_servers]` table. We refuse to auto-edit those forms to avoid producing a
 * duplicate, conflicting definition; the adapter surfaces this as a note.
 */
export function hasInlineMcpServer(source: string, name: string): boolean {
  const dotted = new RegExp(`^\\s*mcp_servers\\s*\\.\\s*(?:${escapeReg(name)}|"${escapeReg(name)}")\\s*=`);
  const lines = source.split("\n");
  let inMcpServersTable = false;
  const keyUnderTable = new RegExp(`^\\s*(?:${escapeReg(name)}|"${escapeReg(name)}")\\s*=`);
  for (const line of lines) {
    if (dotted.test(line)) return true;
    if (/^\s*\[\s*mcp_servers\s*\]\s*$/.test(line)) {
      inMcpServersTable = true;
      continue;
    }
    if (ANY_HEADER.test(line)) {
      inMcpServersTable = false;
      continue;
    }
    if (inMcpServersTable && keyUnderTable.test(line)) return true;
  }
  return false;
}

/** Insert or replace the `[<dotted>]` table block with `blockText`. */
export function upsertTomlTable(source: string, dotted: string, blockText: string): BlockEdit {
  const lines = source.split("\n");
  const header = tableHeaderRegex(dotted);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (header.test(lines[i])) {
      start = i;
      break;
    }
  }

  if (start === -1) {
    const trimmed = source.replace(/\n+$/, "");
    const next = trimmed.length === 0 ? blockText + "\n" : `${trimmed}\n\n${blockText}\n`;
    return { source: next, changed: next !== source, action: "inserted" };
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (ANY_HEADER.test(lines[i])) {
      end = i;
      break;
    }
  }
  // Keep any trailing blank/separator lines (including the file's final newline)
  // with the following content, not inside our block — so re-runs are exact no-ops.
  let contentEnd = end;
  while (contentEnd > start + 1 && lines[contentEnd - 1].trim() === "") contentEnd--;

  const before = lines.slice(0, start);
  const after = lines.slice(contentEnd);
  const blockLines = blockText.split("\n");
  const rebuilt = [...before, ...blockLines, ...after].join("\n");
  if (rebuilt === source) return { source, changed: false, action: "unchanged" };
  return { source: rebuilt, changed: true, action: "replaced" };
}

/** Remove the `[<dotted>]` table block (and its trailing separator blank line). */
export function removeTomlTable(source: string, dotted: string): BlockEdit {
  const lines = source.split("\n");
  const header = tableHeaderRegex(dotted);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (header.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return { source, changed: false, action: "unchanged" };

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (ANY_HEADER.test(lines[i])) {
      end = i;
      break;
    }
  }
  // Absorb a single blank separator line that followed our block.
  if (end < lines.length && lines[end] !== undefined && lines[end].trim() === "") {
    end += 1;
  }

  const before = lines.slice(0, start);
  const after = lines.slice(end);
  let rebuilt = [...before, ...after].join("\n");
  rebuilt = rebuilt.replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n");
  return { source: rebuilt, changed: rebuilt !== source, action: "removed" };
}
