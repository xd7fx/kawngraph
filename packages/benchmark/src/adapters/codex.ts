/**
 * Codex CLI adapter — drives `codex exec --json` and parses its JSON/JSONL event
 * stream. Subscription-only: it authenticates via "Sign in with ChatGPT" (no
 * OPENAI_API_KEY, which is stripped from the child env).
 *
 * BEST-EFFORT, BY DECLARATION. The Codex event schema is not pinned to a version
 * and was not validated against a live CLI in this build. The parser is tolerant
 * (multiple key names, never throws) and every Codex session is flagged with a
 * `note`. The fixture tests verify the parser LOGIC; users should still sanity-
 * check the raw transcript against their installed Codex version.
 *
 * Credentials: to isolate the A/B config without touching your real ~/.codex, we
 * run each session in a throwaway CODEX_HOME and LINK (never copy/read) your
 * existing auth file into it. If linking is impossible we REFUSE rather than
 * duplicate your token on disk.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { resolveMcpLaunch } from "@athar/agents";
import { runStreaming, which, type TimedLine } from "../proc";
import { toToolCall, relToRoot } from "../normalize";
import { redact } from "../redact";
import { codexAuthPath } from "../preflight";
import type { NormalizedSession, ToolCall, TokenUsage } from "../types";
import type { AdapterResult, AgentAdapter, RunInput } from "./types";

const BEST_EFFORT_NOTE =
  "Codex adapter is best-effort: its --json event schema was not verified against a live CLI. " +
  "Sanity-check the raw transcript against your Codex version.";

function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function tomlString(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

/** Generate the ephemeral config.toml for one arm. WITH registers the Athar MCP server. */
function codexConfigToml(withAthar: boolean, cwd: string): string {
  if (!withAthar) return "# Athar benchmark — control arm (no MCP servers).\n";
  const spec = resolveMcpLaunch(cwd);
  const command = spec.command === "node" ? process.execPath : spec.command;
  const args = spec.args.map(tomlString).join(", ");
  return `# Athar benchmark — treatment arm.\n[mcp_servers.athar]\ncommand = ${tomlString(command)}\nargs = [${args}]\n`;
}

/** Subscription-only child env, pointed at an isolated CODEX_HOME. */
function childEnv(home: string): NodeJS.ProcessEnv {
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

function buildArgs(input: RunInput): string[] {
  const args = ["exec", "--json", "--skip-git-repo-check"];
  if (input.allowEdits) args.push("--full-auto");
  if (input.model) args.push("-m", input.model);
  args.push(input.prompt);
  return args;
}

/** Best-effort extraction of a file path read by a shell command (cat/sed/head/rg…). */
function fileFromShellCommand(cmd: string, cwd: string): string | undefined {
  const m = cmd.match(/\b(?:cat|less|bat|head|tail|sed|rg|grep|nl)\b[^\n|]*?\s(["']?)([^\s"']+\.[A-Za-z0-9]+)\1(?:\s|$)/);
  return m ? relToRoot(m[2], cwd) : undefined;
}

export interface ParsedCodex {
  tools: ToolCall[];
  answer: string;
  tokens: TokenUsage;
  sawAny: boolean;
  errorText: string | null;
}

/** Tolerant parser for Codex's event stream. Never throws; degrades gracefully. */
export function parseCodexLines(lines: TimedLine[], cwd: string): ParsedCodex {
  const tools: ToolCall[] = [];
  let answer = "";
  let tokens: TokenUsage = { input: null, output: null, cacheRead: null, cacheCreate: null };
  let sawAny = false;
  let errorText: string | null = null;

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
    const item = (ev.item ?? ev.msg ?? ev) as Record<string, unknown>;
    const itype = String(ev.type ?? item.type ?? "");

    // ---- tool / command / file-change / mcp events --------------------------
    if (/command|shell|exec/.test(itype) && itype !== "exec_approval_request") {
      const cmd = item.command ?? item.cmd ?? item.aggregated_command;
      const cmdStr = Array.isArray(cmd) ? (cmd as unknown[]).join(" ") : String(cmd ?? "");
      const file = cmdStr ? fileFromShellCommand(cmdStr, cwd) : undefined;
      tools.push({ name: "shell", kind: "bash", athar: false, file, atMs });
    } else if (/file_change|patch|apply/.test(itype)) {
      const changes = (item.changes ?? item.files ?? [item]) as unknown[];
      for (const c of Array.isArray(changes) ? changes : [changes]) {
        const co = (c ?? {}) as Record<string, unknown>;
        const p = co.path ?? co.file ?? co.file_path ?? item.path;
        if (typeof p === "string") {
          tools.push({ name: "apply_patch", kind: "edit", athar: false, file: relToRoot(p, cwd), atMs });
        }
      }
    } else if (/mcp_tool_call|tool_call|function_call|tool_use/.test(itype)) {
      const server = item.server ?? item.server_name;
      const tool = item.tool ?? item.name ?? item.tool_name;
      const full = server ? `mcp__${String(server)}__${String(tool)}` : String(tool ?? "");
      tools.push(toToolCall(full, item.arguments ?? item.input ?? item.params, cwd, atMs));
    } else if (/file_read|read_file|^read$/.test(itype)) {
      const p = item.path ?? item.file ?? item.file_path;
      if (typeof p === "string") {
        tools.push({ name: "read", kind: "read", athar: false, file: relToRoot(p, cwd), atMs });
      }
    }

    // ---- final answer -------------------------------------------------------
    if (/agent_message|assistant|message|final/.test(itype)) {
      const t = item.text ?? item.message ?? ev.text ?? ev.message;
      if (typeof t === "string" && t.trim()) answer = t;
    }

    // ---- usage --------------------------------------------------------------
    const u = (ev.usage ?? item.usage) as Record<string, unknown> | undefined;
    if (u) {
      tokens = {
        input: num(u.input_tokens ?? u.input ?? u.prompt_tokens),
        output: num(u.output_tokens ?? u.output ?? u.completion_tokens),
        cacheRead: num(u.cache_read_input_tokens ?? u.cached_input_tokens),
        cacheCreate: num(u.cache_creation_input_tokens),
      };
    }

    // ---- errors -------------------------------------------------------------
    if (/error/.test(itype) || ev.error) {
      const e = ev.error ?? item.error ?? item.message ?? ev.message;
      errorText = redact(typeof e === "string" ? e : JSON.stringify(e ?? "codex error"));
    }
  }

  return { tools, answer, tokens, sawAny, errorText };
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
    const home = fs.mkdtempSync(path.join(tmpdir(), "athar-codex-home-"));
    const baseFail = (failure: string, transcript = "", wallMs = 0): AdapterResult => ({
      session: {
        agent: "codex",
        condition: input.condition,
        ok: false,
        failure,
        wallMs,
        durationMs: null,
        tools: [],
        tokens: { input: null, output: null, cacheRead: null, cacheCreate: null },
        numTurns: null,
        answer: "",
        cost: null,
        note: BEST_EFFORT_NOTE,
      },
      transcript,
    });

    try {
      const link = linkAuth(home);
      if (!link.ok) return baseFail(link.note ?? "Codex credential unavailable.");

      fs.writeFileSync(path.join(home, "config.toml"), codexConfigToml(input.withAthar, input.cwd), "utf8");

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
        numTurns: null,
        answer: parsed.answer.replace(/\s+/g, " ").slice(0, 600),
        cost: null,
        note: BEST_EFFORT_NOTE,
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
