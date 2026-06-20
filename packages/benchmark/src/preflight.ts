/**
 * Authentication preflight — reports whether each requested agent can run on its
 * SUBSCRIPTION, without ever requiring (or touching) an API key, and without
 * reading, printing, or persisting any credential.
 *
 *   - Claude: headless `claude -p` authorizes via a subscription OAuth token
 *     (`claude setup-token` / `CLAUDE_CODE_OAUTH_TOKEN`). Interactive login alone
 *     is NOT sufficient for `-p`. We can confirm readiness for free only when the
 *     token is present in the environment; otherwise we report "unknown" with the
 *     exact remediation and let the real run be the honest arbiter.
 *   - Codex: "Sign in with ChatGPT" writes an auth file under CODEX_HOME. We detect
 *     its PRESENCE only — we never open or read it.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentKind, AgentReadiness } from "./types";
import { which } from "./proc";

/** The Codex config/credential directory (honors CODEX_HOME, else ~/.codex). */
export function codexHome(): string {
  const fromEnv = process.env.CODEX_HOME;
  return fromEnv && fromEnv.trim() ? fromEnv : path.join(os.homedir(), ".codex");
}

/** Path to Codex's credential file. Existence is checked; contents are never read. */
export function codexAuthPath(): string {
  return path.join(codexHome(), "auth.json");
}

function claudeReadiness(): AgentReadiness {
  const binPath = which("claude");
  if (!binPath) {
    return {
      agent: "claude",
      installed: false,
      binPath: null,
      authenticated: false,
      detail: "Claude Code CLI not found on PATH.",
      remediation: "Install Claude Code, then run `claude` once to log in.",
    };
  }
  const hasToken = !!(process.env.CLAUDE_CODE_OAUTH_TOKEN && process.env.CLAUDE_CODE_OAUTH_TOKEN.trim());
  if (hasToken) {
    return {
      agent: "claude",
      installed: true,
      binPath,
      authenticated: true,
      detail: "Headless subscription OAuth token present in the environment.",
    };
  }
  return {
    agent: "claude",
    installed: true,
    binPath,
    authenticated: "unknown",
    detail:
      "Claude Code is installed, but headless `claude -p` cannot be confirmed for free. " +
      "Interactive login alone does NOT authorize `-p`.",
    remediation:
      "Run `claude setup-token` (subscription OAuth — not an API key). If `-p` still reports 401, " +
      "export the printed token as CLAUDE_CODE_OAUTH_TOKEN.",
  };
}

function codexReadiness(): AgentReadiness {
  const binPath = which("codex");
  if (!binPath) {
    return {
      agent: "codex",
      installed: false,
      binPath: null,
      authenticated: false,
      detail: "Codex CLI not found on PATH.",
      remediation: "Install the Codex CLI, then run `codex login` (Sign in with ChatGPT).",
    };
  }
  const loggedIn = fileExists(codexAuthPath());
  return {
    agent: "codex",
    installed: true,
    binPath,
    authenticated: loggedIn,
    detail: loggedIn
      ? "Codex CLI installed and a ChatGPT credential is present (contents not read)."
      : "Codex CLI installed but no ChatGPT credential found under CODEX_HOME.",
    remediation: loggedIn ? undefined : "Run `codex login` (Sign in with ChatGPT).",
  };
}

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

export function readinessFor(agent: AgentKind): AgentReadiness {
  return agent === "claude" ? claudeReadiness() : codexReadiness();
}

/**
 * An agent is "available" to benchmark when it is installed and not KNOWN to be
 * unauthenticated. Claude's `"unknown"` auth counts as available (we surface the
 * caveat; the run fails honestly if the token is missing). Codex requires a
 * detected login, since that signal is free and reliable.
 */
export function isAvailable(r: AgentReadiness): boolean {
  return r.installed && r.authenticated !== false;
}

export interface PreflightResult {
  ready: boolean;
  readiness: AgentReadiness[];
  /** agents that are not available, with their remediation */
  blocking: AgentReadiness[];
}

/** Check every requested agent. `ready` is false if any is unavailable. */
export function preflight(agents: AgentKind[]): PreflightResult {
  const readiness = agents.map(readinessFor);
  const blocking = readiness.filter((r) => !isAvailable(r));
  return { ready: blocking.length === 0, readiness, blocking };
}

/** A multi-line, credential-free summary suitable for stderr. */
export function formatReadiness(readiness: AgentReadiness[]): string {
  const mark = (r: AgentReadiness): string =>
    !r.installed ? "MISSING" : r.authenticated === true ? "READY" : r.authenticated === false ? "NOT LOGGED IN" : "INSTALLED (auth unverified)";
  return readiness
    .map((r) => {
      const head = `  ${r.agent.padEnd(7)} ${mark(r)} — ${r.detail}`;
      return r.remediation ? `${head}\n           ↳ ${r.remediation}` : head;
    })
    .join("\n");
}
