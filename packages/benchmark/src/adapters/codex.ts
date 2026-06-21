/**
 * Codex CLI adapter — drives `codex exec --json` and parses its JSONL event
 * stream. Subscription-only: it authenticates via "Sign in with ChatGPT" (no
 * OPENAI_API_KEY, which is stripped from the child env).
 *
 * VALIDATED AGAINST CODEX CLI 0.141.0. The parser understands the real
 * thread/turn/item envelope schema captured from live runs:
 *
 *   {"type":"thread.started","thread_id":"..."}
 *   {"type":"turn.started"}
 *   {"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"..."}}
 *   {"type":"item.started",  "item":{"id":"item_1","type":"command_execution","command":"...","status":"in_progress"}}
 *   {"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"...","exit_code":0,"status":"completed"}}
 *   {"type":"turn.completed","usage":{"input_tokens":...,"cached_input_tokens":...,"output_tokens":...,"reasoning_output_tokens":...}}
 *
 * Dispatch keys off `ev.item.type` (NOT the envelope `ev.type`), because the
 * envelope type is always present and would otherwise mask the item kind.
 *
 * Forward/backward tolerance: any unrecognized envelope or item kind is recorded
 * as a diagnostic (never silently dropped) and surfaced in the session note so the
 * affected metrics can be read as "schema drift" rather than a misleading zero.
 *
 * Credentials: to isolate the A/B config without touching your real ~/.codex, we
 * run each session in a throwaway CODEX_HOME and LINK (never copy/read) your
 * existing auth file into it. If linking is impossible we REFUSE rather than
 * duplicate your token on disk.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { resolveMcpLaunch } from "@kawngraph/agents";
import { runStreaming, which, type TimedLine } from "../proc";
import { toToolCall, relToRoot } from "../normalize";
import { redact } from "../redact";
import { codexAuthPath } from "../preflight";
import type { NormalizedSession, ToolCall, ToolKind, TokenUsage } from "../types";
import type { AdapterResult, AgentAdapter, RunInput } from "./types";

const VERIFIED_NOTE =
  "Codex adapter validated against Codex CLI 0.141.0 (`exec --json`: thread/turn/item events). " +
  "Any unrecognized event is recorded as a diagnostic and its metrics reported as N/A — " +
  "sanity-check the raw transcript if your Codex version differs.";

function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function tomlString(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

/** Generate the ephemeral config.toml for one arm. WITH registers the KawnGraph MCP server. */
function codexConfigToml(withKawnGraph: boolean, cwd: string): string {
  if (!withKawnGraph) return "# KawnGraph benchmark — control arm (no MCP servers).\n";
  const spec = resolveMcpLaunch(cwd);
  const command = spec.command === "node" ? process.execPath : spec.command;
  const args = spec.args.map(tomlString).join(", ");
  return `# KawnGraph benchmark — treatment arm.\n[mcp_servers.kawn]\ncommand = ${tomlString(command)}\nargs = [${args}]\n`;
}

/**
 * Subscription-only child env, pointed at an isolated CODEX_HOME. Drops every API
 * key so Codex can ONLY authorize via "Sign in with ChatGPT". Exported so a test
 * can pin that a key in the parent environment never leaks into the session.
 */
export function childEnv(home: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.ANTHROPIC_API_KEY;
  env.CODEX_HOME = home;
  return env;
}

/** Link (don't copy) the real credential into the isolated home. Refuse if impossible. */
function linkAuth(home: string): { ok: boolean; note?: string } {
  const real = codexAuthPath();
  if (!fs.existsSync(real)) {
    return { ok: false, note: "no Codex credential found under CODEX_HOME; run `codex login` first." };
  }
  const dest = path.join(home, "auth.json");
  try {
    fs.linkSync(real, dest);
    return { ok: true };
  } catch {
    /* try symlink next */
  }
  try {
    fs.symlinkSync(real, dest);
    return { ok: true };
  } catch {
    return {
      ok: false,
      note: "could not link your Codex credential into an isolated home without copying it; skipping Codex to avoid duplicating your OAuth token on disk.",
    };
  }
}

/**
 * Build the `codex exec` argv. The sandbox flag is the real mechanism that grants
 * (or denies) write access — `workspace-write` for e2e edits, `read-only` for
 * retrieval. `-C` pins Codex's workspace root to the isolated staged copy so the
 * agent can never reach outside it.
 *
 * NOTE: `--full-auto` (used by an earlier draft) is NOT a valid 0.141.0 flag and
 * silently left the workspace read-only — which is why e2e edits never landed.
 */
function buildArgs(input: RunInput): string[] {
  const args = ["exec", "--json", "--skip-git-repo-check", "-C", input.cwd];
  args.push("-s", input.allowEdits ? "workspace-write" : "read-only");
  if (input.model) args.push("-m", input.model);
  args.push(input.prompt);
  return args;
}

// Shell-command classification. A command that invokes a search tool is a search
// (and ALSO opens a file when it targets a concrete path — Codex reads files in a
// read-only sandbox via `rg -n "^" <file>`). A pure reader just opens a file.
const SEARCH_RE = /\b(?:rg|grep|egrep|fgrep|findstr|ag|ack|select-string|sls)\b/i;
const READER_RE = /\b(?:cat|bat|head|tail|sed|nl|less|more|type|gc|get-content)\b/i;

/** A code/doc/config extension we recognize as a "file the agent opened". */
const FILE_EXT =
  "tsx?|jsx?|mjs|cjs|json|md|mdx|sql|ya?ml|toml|py|go|rs|java|rb|php|cc?|hh?|cpp|hpp|cs|css|scss|less|html?|sh|ps1|xml|ini|cfg|conf|vue|svelte|kt|swift|scala";

/**
 * Best-effort extraction of the concrete file a shell command touched. Handles
 * bare paths (`cat a/b.ts`, `rg -n "^" a/b.ts`) and nested PowerShell wrappers
 * (`-Command "Get-Content -LiteralPath 'a/b.ts'"`) by scanning for the LAST
 * path-like token with a known extension at a token boundary. Globs and `.exe`
 * are ignored. Returns the repo-relative posix path.
 */
export function fileFromShellCommand(cmd: string, cwd: string): string | undefined {
  const re = new RegExp(
    "['\"`]?([A-Za-z0-9_./\\\\@-]+\\.(?:" + FILE_EXT + "))['\"`]?(?=$|[\\s'\"`)])",
    "gi",
  );
  let m: RegExpExecArray | null;
  let best: string | undefined;
  while ((m = re.exec(cmd))) {
    const cand = m[1];
    if (/[*?]/.test(cand)) continue; // a glob, not a concrete file
    best = cand; // keep the last match (commands put the target last)
  }
  return best ? relToRoot(best, cwd) : undefined;
}

function commandString(cmd: unknown): string {
  if (Array.isArray(cmd)) return (cmd as unknown[]).map((x) => String(x)).join(" ");
  return cmd == null ? "" : String(cmd);
}

/** Emit a ToolCall for one shell command, classifying search vs read vs other. */
function emitShellCommand(
  tools: ToolCall[],
  cmd: string,
  cwd: string,
  atMs: number | undefined,
  declined: boolean,
): void {
  let kind: ToolKind = "bash";
  let file: string | undefined;
  // A declined command never actually touched a file or ran a search.
  if (!declined && cmd) {
    const isSearch = SEARCH_RE.test(cmd);
    const isReader = !isSearch && READER_RE.test(cmd);
    if (isSearch || isReader) {
      file = fileFromShellCommand(cmd, cwd);
      if (isSearch) kind = "grep";
      else if (file) kind = "read";
    }
  }
  tools.push({ name: "shell", kind, kawn: false, file, atMs });
}

/** Pull every changed file path out of an apply-patch / file-change item. */
function filesFromChange(item: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (p: unknown): void => {
    if (typeof p === "string" && p.trim()) out.push(p);
  };
  push(item.path);
  push(item.file);
  push(item.file_path);
  const changes = item.changes ?? item.files;
  if (Array.isArray(changes)) {
    for (const c of changes) {
      if (typeof c === "string") push(c);
      else if (c && typeof c === "object") {
        const co = c as Record<string, unknown>;
        push(co.path);
        push(co.file);
        push(co.file_path);
      }
    }
  } else if (changes && typeof changes === "object") {
    for (const k of Object.keys(changes)) push(k); // map of path -> change
  }
  return out;
}

/** Item `type` values we understand — also used to route a flat/legacy schema. */
const ITEM_KINDS = new Set<string>([
  "agent_message", "assistant_message", "message",
  "reasoning", "agent_reasoning",
  "command_execution", "local_shell_call", "shell_command",
  "file_change", "patch_apply", "apply_patch", "file_edit",
  "mcp_tool_call", "tool_call", "function_call",
  "file_read", "read_file", "read",
]);

/** Diagnostics gathered while parsing — drives honest N/A reporting + the note. */
export interface CodexDiagnostics {
  threadId: string | null;
  /** unrecognized envelope `type` values (e.g. a future "turn.aborted") */
  unknownEventTypes: string[];
  /** unrecognized `item.type` values (e.g. a future tool kind) */
  unknownItemTypes: string[];
  /** commands the sandbox declined (blocked by policy) — counted, not credited */
  declinedCommands: number;
  /** number of `turn.completed` events seen */
  turnsCompleted: number;
}

export interface ParsedCodex {
  tools: ToolCall[];
  answer: string;
  tokens: TokenUsage;
  numTurns: number | null;
  sawAny: boolean;
  errorText: string | null;
  diag: CodexDiagnostics;
}

/** Tolerant, schema-aware parser for Codex's JSONL event stream. Never throws. */
export function parseCodexLines(lines: TimedLine[], cwd: string): ParsedCodex {
  const tools: ToolCall[] = [];
  let answer = "";
  let sawAny = false;
  let errorText: string | null = null;

  // Usage is summed across turn.completed events (one exec = one turn in practice,
  // so this equals the single reported total; multi-turn execs add per-turn usage).
  let inTok: number | null = null;
  let outTok: number | null = null;
  let cacheTok: number | null = null;
  let reasonTok: number | null = null;
  let turnUsageSeen = false;
  // Fallback usage for a flat/legacy schema that emits a standalone usage event
  // (e.g. `token_count`) instead of riding it on `turn.completed`. Only used when
  // NO turn carried usage, so the authoritative turn totals are never double-counted.
  let fbIn: number | null = null;
  let fbOut: number | null = null;
  let fbCache: number | null = null;
  let fbReason: number | null = null;

  const diag: CodexDiagnostics = {
    threadId: null,
    unknownEventTypes: [],
    unknownItemTypes: [],
    declinedCommands: 0,
    turnsCompleted: 0,
  };
  const unknownEnv = new Set<string>();
  const unknownItem = new Set<string>();

  // command_execution items arrive twice (started + completed). Track the start
  // time by id so the emitted ToolCall is timestamped when the command BEGAN, and
  // emit exactly once — on the completed event, which carries the final status.
  const startedAt = new Map<string, number>();
  const emitted = new Set<string>();

  const readUsage = (
    u: Record<string, unknown>,
  ): { i: number | null; o: number | null; c: number | null; r: number | null } => ({
    i: num(u.input_tokens ?? u.input ?? u.prompt_tokens),
    o: num(u.output_tokens ?? u.output ?? u.completion_tokens),
    c: num(u.cached_input_tokens ?? u.cache_read_input_tokens),
    r: num(u.reasoning_output_tokens ?? u.reasoning_tokens),
  });
  /** Authoritative: sum per-turn usage from `turn.completed`. */
  const addTurnUsage = (u: Record<string, unknown>): void => {
    const { i, o, c, r } = readUsage(u);
    if (i != null) inTok = (inTok ?? 0) + i;
    if (o != null) outTok = (outTok ?? 0) + o;
    if (c != null) cacheTok = (cacheTok ?? 0) + c;
    if (r != null) reasonTok = (reasonTok ?? 0) + r;
    turnUsageSeen = true;
  };
  /** Fallback: a standalone usage event (last one wins) for non-turn schemas. */
  const setFallbackUsage = (u: Record<string, unknown>): void => {
    const { i, o, c, r } = readUsage(u);
    if (i != null) fbIn = i;
    if (o != null) fbOut = o;
    if (c != null) fbCache = c;
    if (r != null) fbReason = r;
  };

  const setError = (e: unknown): void => {
    errorText = redact(typeof e === "string" ? e : JSON.stringify(e ?? "codex error"));
  };

  const handleItem = (item: Record<string, unknown>, atMs: number | undefined, completed: boolean): void => {
    const id = typeof item.id === "string" ? item.id : "";
    const kind = String(item.type ?? "");
    switch (kind) {
      case "agent_message":
      case "assistant_message":
      case "message": {
        const t = item.text ?? item.message;
        if (typeof t === "string" && t.trim()) answer = t; // last non-empty wins
        return;
      }
      case "reasoning":
      case "agent_reasoning":
        return; // reasoning summaries are not tools and not the final answer
      case "command_execution":
      case "local_shell_call":
      case "shell_command": {
        if (id) startedAt.set(id, startedAt.get(id) ?? atMs ?? 0);
        if (!completed) return; // wait for the completed event (final status)
        if (id && emitted.has(id)) return;
        if (id) emitted.add(id);
        const status = String(item.status ?? "").toLowerCase();
        const declined = status === "declined" || status === "rejected" || status === "failed";
        if (status === "declined" || status === "rejected") diag.declinedCommands++;
        const cmdStr = commandString(item.command ?? item.cmd ?? item.aggregated_command);
        const startMs = id && startedAt.has(id) ? startedAt.get(id) : atMs;
        emitShellCommand(tools, cmdStr, cwd, startMs, declined);
        return;
      }
      case "file_change":
      case "patch_apply":
      case "apply_patch":
      case "file_edit": {
        for (const f of filesFromChange(item)) {
          tools.push({ name: "apply_patch", kind: "edit", kawn: false, file: relToRoot(f, cwd), atMs });
        }
        return;
      }
      case "mcp_tool_call":
      case "tool_call":
      case "function_call": {
        const server = item.server ?? item.server_name;
        const tool = item.tool ?? item.name ?? item.tool_name;
        const full = server ? `mcp__${String(server)}__${String(tool)}` : String(tool ?? "");
        tools.push(toToolCall(full, item.arguments ?? item.input ?? item.params, cwd, atMs));
        return;
      }
      case "file_read":
      case "read_file":
      case "read": {
        const p = item.path ?? item.file ?? item.file_path;
        if (typeof p === "string") tools.push({ name: "read", kind: "read", kawn: false, file: relToRoot(p, cwd), atMs });
        return;
      }
      case "error":
        setError(item.message ?? item.error);
        return;
      default:
        if (kind) unknownItem.add(kind);
    }
  };

  for (const { text, atMs } of lines) {
    const s = text.trim();
    if (!s || s[0] !== "{") continue;
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(s) as Record<string, unknown>;
    } catch {
      continue;
    }
    sawAny = true;
    const etype = String(ev.type ?? "");

    switch (etype) {
      case "thread.started":
        if (typeof ev.thread_id === "string") diag.threadId = ev.thread_id;
        break;
      case "turn.started":
        break;
      case "turn.completed": {
        diag.turnsCompleted++;
        if (ev.usage && typeof ev.usage === "object") addTurnUsage(ev.usage as Record<string, unknown>);
        break;
      }
      case "turn.failed":
        setError(ev.error ?? (ev as Record<string, unknown>).failure ?? "codex turn failed");
        break;
      case "item.started":
      case "item.updated":
        handleItem((ev.item ?? {}) as Record<string, unknown>, atMs, false);
        break;
      case "item.completed":
        handleItem((ev.item ?? {}) as Record<string, unknown>, atMs, true);
        break;
      case "error":
        setError(ev.error ?? ev.message);
        break;
      default:
        // Tolerance for a flat/legacy schema: an event carrying a nested item, or
        // a bare item whose envelope type IS an item kind (no item.* wrapper).
        if (ev.item || ev.msg) {
          handleItem((ev.item ?? ev.msg) as Record<string, unknown>, atMs, etype.includes("completed"));
        } else if (ITEM_KINDS.has(etype)) {
          handleItem(ev, atMs, true);
        } else if (etype) {
          unknownEnv.add(etype);
        }
    }

    // Standalone usage event (e.g. legacy `token_count`) — only a fallback; the
    // turn totals win if any `turn.completed` carried usage (set at the end).
    if (etype !== "turn.completed" && ev.usage && typeof ev.usage === "object") {
      setFallbackUsage(ev.usage as Record<string, unknown>);
    }

    // A top-level error field on any other event still counts as a failure signal.
    if (ev.error && etype !== "error" && etype !== "turn.failed") setError(ev.error);
  }

  diag.unknownEventTypes = [...unknownEnv];
  diag.unknownItemTypes = [...unknownItem];

  // Authoritative turn totals win; the standalone-usage fallback applies only when
  // no turn.completed ever carried usage (so we never double-count).
  const tokens: TokenUsage = {
    input: turnUsageSeen ? inTok : fbIn,
    output: turnUsageSeen ? outTok : fbOut,
    cacheRead: turnUsageSeen ? cacheTok : fbCache,
    cacheCreate: null, // Codex does not report cache-creation separately
    reasoning: turnUsageSeen ? reasonTok : fbReason,
  };

  return {
    tools,
    answer,
    tokens,
    numTurns: diag.turnsCompleted > 0 ? diag.turnsCompleted : null,
    sawAny,
    errorText,
    diag,
  };
}

/** Compose the per-session honesty note from the base note + run diagnostics. */
export function sessionNote(diag: CodexDiagnostics): string {
  let note = VERIFIED_NOTE;
  const unknown = [...diag.unknownEventTypes, ...diag.unknownItemTypes];
  if (unknown.length) note += ` Unrecognized event kinds this run (metrics N/A for these): ${unknown.join(", ")}.`;
  if (diag.declinedCommands) note += ` Sandbox declined ${diag.declinedCommands} command(s).`;
  return note;
}

function isAuthFailure(text: string | null): boolean {
  return !!text && /authenticate|401|403|unauthorized|login|sign in|credit|quota|balance/i.test(text);
}

export const codexAdapter: AgentAdapter = {
  kind: "codex",
  available(): boolean {
    return which("codex") != null;
  },
  async run(input: RunInput): Promise<AdapterResult> {
    const home = fs.mkdtempSync(path.join(tmpdir(), "kawn-codex-home-"));
    const baseFail = (failure: string, transcript = "", wallMs = 0): AdapterResult => ({
      session: {
        agent: "codex",
        condition: input.condition,
        ok: false,
        failure,
        wallMs,
        durationMs: null,
        tools: [],
        tokens: { input: null, output: null, cacheRead: null, cacheCreate: null, reasoning: null },
        numTurns: null,
        answer: "",
        cost: null,
        note: VERIFIED_NOTE,
      },
      transcript,
    });

    try {
      const link = linkAuth(home);
      if (!link.ok) return baseFail(link.note ?? "Codex credential unavailable.");

      fs.writeFileSync(path.join(home, "config.toml"), codexConfigToml(input.withKawnGraph, input.cwd), "utf8");

      const res = await runStreaming("codex", buildArgs(input), {
        cwd: input.cwd,
        timeoutMs: input.timeoutMs,
        env: childEnv(home),
      });
      const transcript = redact(res.stdout);
      const parsed = parseCodexLines(res.lines, input.cwd);

      if (res.timedOut) return baseFail(`timed out after ${input.timeoutMs} ms`, transcript, res.wallMs);
      if (!parsed.sawAny) {
        const tail = redact((res.stderr || res.stdout || "").trim().split(/\r?\n/).slice(-4).join(" | "));
        return baseFail(`no JSON events from codex (exit ${res.status}). ${tail}`, transcript, res.wallMs);
      }
      if (isAuthFailure(parsed.errorText)) return baseFail(parsed.errorText!, transcript, res.wallMs);
      if (res.status !== 0 && !parsed.answer) {
        return baseFail(parsed.errorText ?? `codex exited ${res.status}`, transcript, res.wallMs);
      }

      const session: NormalizedSession = {
        agent: "codex",
        condition: input.condition,
        ok: true,
        wallMs: res.wallMs,
        durationMs: null,
        tools: parsed.tools,
        tokens: parsed.tokens,
        numTurns: parsed.numTurns,
        answer: parsed.answer.replace(/\s+/g, " ").slice(0, 600),
        cost: null,
        note: sessionNote(parsed.diag),
      };
      return { session, transcript };
    } finally {
      try {
        fs.rmSync(home, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  },
};
