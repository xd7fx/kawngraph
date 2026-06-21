/**
 * Claude Code adapter — drives `claude -p --output-format stream-json` and parses
 * the emitted event stream. Subscription-only: any API key is stripped from the
 * child environment so the session can ONLY authorize via the Max subscription
 * OAuth token. Auth failures are detected and reported honestly — never scored.
 */
import type { TimedLine } from "../proc";
import { runStreaming } from "../proc";
import { toToolCall } from "../normalize";
import { redact } from "../redact";
import type { NormalizedSession, ToolCall, TokenUsage } from "../types";
import { which } from "../proc";
import type { AdapterResult, AgentAdapter, RunInput } from "./types";

const KAWN_TOOLS = ["mcp__kawn__kawn_context", "mcp__kawn__kawn_query", "mcp__kawn__kawn_affected"];

function buildArgs(input: RunInput): string[] {
  const allowed = ["Read", "Grep", "Glob"];
  if (input.allowEdits) allowed.push("Edit", "Write");
  if (input.withKawnGraph) allowed.push(...KAWN_TOOLS);

  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--mcp-config",
    input.mcpConfigPath,
    "--strict-mcp-config",
    "--permission-mode",
    "bypassPermissions",
    "--add-dir",
    input.cwd,
    "--allowedTools",
    ...allowed,
  ];
  if (input.model) args.push("--model", input.model);
  return args;
}

/** Subscription-only child env: drop API keys, keep the OAuth token if present. */
function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.OPENAI_API_KEY;
  return env;
}

interface ClaudeResult {
  is_error?: boolean;
  api_error_status?: number | string;
  result?: string;
  duration_ms?: number;
  num_turns?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export interface ParsedClaude {
  tools: ToolCall[];
  final: ClaudeResult | null;
}

/** Parse the stream-json line events into ordered, timestamped tool calls + result. */
export function parseClaudeLines(lines: TimedLine[], cwd: string): ParsedClaude {
  const tools: ToolCall[] = [];
  let final: ClaudeResult | null = null;

  for (const { text, atMs } of lines) {
    const s = text.trim();
    if (!s || s[0] !== "{") continue;
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(s) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (ev.type === "assistant" && ev.message && typeof ev.message === "object") {
      const content = (ev.message as { content?: unknown }).content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block && typeof block === "object" && (block as { type?: string }).type === "tool_use") {
            const b = block as { name?: string; input?: unknown };
            tools.push(toToolCall(String(b.name ?? ""), b.input, cwd, atMs));
          }
        }
      }
    }
    if (ev.type === "result") final = ev as ClaudeResult;
  }
  return { tools, final };
}

function tokensFrom(final: ClaudeResult | null): TokenUsage {
  const u = final?.usage ?? {};
  return {
    input: u.input_tokens ?? null,
    output: u.output_tokens ?? null,
    cacheRead: u.cache_read_input_tokens ?? null,
    cacheCreate: u.cache_creation_input_tokens ?? null,
  };
}

function isAuthFailure(final: ClaudeResult): boolean {
  if (!final.is_error) return false;
  if (final.api_error_status) return true;
  return /authenticate|401|403|invalid api key|credit|quota|balance|oauth/i.test(String(final.result ?? ""));
}

export const claudeAdapter: AgentAdapter = {
  kind: "claude",
  available(): boolean {
    return which("claude") != null;
  },
  async run(input: RunInput): Promise<AdapterResult> {
    const args = buildArgs(input);
    const res = await runStreaming("claude", args, {
      cwd: input.cwd,
      input: input.prompt,
      timeoutMs: input.timeoutMs,
      env: childEnv(),
    });
    const { tools, final } = parseClaudeLines(res.lines, input.cwd);
    const transcript = redact(res.stdout);

    const base = {
      agent: "claude" as const,
      condition: input.condition,
      wallMs: res.wallMs,
      tools,
      tokens: tokensFrom(final),
      numTurns: final?.num_turns ?? null,
      cost: final?.total_cost_usd ?? null,
    };

    // Honest failure paths — no metrics are trusted for these.
    if (res.timedOut) {
      const session: NormalizedSession = {
        ...base,
        ok: false,
        failure: `timed out after ${input.timeoutMs} ms`,
        durationMs: final?.duration_ms ?? null,
        answer: "",
      };
      return { session, transcript };
    }
    if (final && isAuthFailure(final)) {
      const reason = `${final.api_error_status ? `HTTP ${final.api_error_status} — ` : ""}${redact(String(final.result ?? "agent returned an error"))}`;
      const session: NormalizedSession = {
        ...base,
        ok: false,
        failure: reason,
        durationMs: final.duration_ms ?? null,
        answer: "",
      };
      return { session, transcript };
    }
    if (!final) {
      const tail = redact((res.stderr || res.stdout || "").trim().split(/\r?\n/).slice(-4).join(" | "));
      const session: NormalizedSession = {
        ...base,
        ok: false,
        failure: `no result event from claude (exit ${res.status}). ${tail}`,
        durationMs: null,
        answer: "",
      };
      return { session, transcript };
    }

    const session: NormalizedSession = {
      ...base,
      ok: !final.is_error,
      failure: final.is_error ? redact(String(final.result ?? "agent reported an error")) : undefined,
      durationMs: final.duration_ms ?? null,
      answer: redact(String(final.result ?? "")).replace(/\s+/g, " ").slice(0, 600),
    };
    return { session, transcript };
  },
};
