/**
 * Shared, normalized schema for the Athar behavioral benchmark.
 *
 * Every agent (Claude, Codex) is reduced to the SAME {@link NormalizedSession}
 * shape so metrics and reports never branch on the agent. Nothing in here ever
 * holds a credential — see `redact.ts`, which is applied to every captured string
 * before it reaches a {@link NormalizedSession}.
 */

/** Coding agents the benchmark can drive. Both use subscription auth — no API keys. */
export type AgentKind = "claude" | "codex";

/**
 * The two arms of the A/B test.
 *   - `without` = control (A): the agent runs with NO Athar.
 *   - `with`    = treatment (B): the same agent/model/task, Athar MCP available.
 */
export type Condition = "without" | "with";

/**
 * Benchmark family:
 *   - `retrieval` = identify files / flows / risks / tests, no editing (read-only).
 *   - `e2e`       = implement a real change in an isolated copy, then run tests.
 */
export type BenchmarkMode = "retrieval" | "e2e";

/** Normalized tool family, derived from each agent's raw tool name. */
export type ToolKind = "read" | "grep" | "glob" | "edit" | "write" | "athar" | "bash" | "other";

/** One task handed to the agent. */
export interface TaskDef {
  id: string;
  /** the prompt given to the agent verbatim */
  prompt: string;
  /**
   * Relevant files a correct answer/edit actually touches — repo-relative posix,
   * lowercased on load. Used for precision/recall. May be empty for an ad-hoc
   * project with no curated gold set (precision/recall then report as n/a).
   */
  gold: string[];
  /** retrieval correctness heuristic: substrings the final answer should contain */
  expectMentions?: string[];
  /** e2e only: command run (by the harness, not the agent) to grade the change */
  testCommand?: string;
  /** override the run-wide mode for this single task */
  mode?: BenchmarkMode;
}

/** A project to benchmark over. Its source is NEVER copied into the Athar repo. */
export interface ProjectDef {
  id: string;
  /** path to the project root (inside the repo, e.g. examples/x, or absolute/external) */
  path: string;
  tasks: TaskDef[];
  /** optional model alias passed through to the agent CLI */
  model?: string;
}

/** The on-disk suite format for `--projects-file`. */
export interface ProjectsFile {
  projects: ProjectDef[];
}

/** One normalized tool invocation. */
export interface ToolCall {
  /** raw name as the agent reported it (e.g. "Read", "mcp__athar__athar_context") */
  name: string;
  kind: ToolKind;
  /** is this an Athar MCP call? */
  athar: boolean;
  /** repo-relative posix file the call touched, when determinable */
  file?: string;
  /** ms since session start when the call was first observed (streaming), when known */
  atMs?: number;
}

/** Token accounting, only when the agent exposes it. All fields nullable. */
export interface TokenUsage {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheCreate: number | null;
}

/** The normalized outcome of ONE agent session (one condition, one repeat). */
export interface NormalizedSession {
  agent: AgentKind;
  condition: Condition;
  /** did the session run to completion? false => metrics are NOT trustworthy */
  ok: boolean;
  /** when !ok: a human-readable, already-redacted reason (auth wall, timeout, crash) */
  failure?: string;
  /** wall-clock the harness measured around the process */
  wallMs: number;
  /** the agent's own self-reported duration, when available */
  durationMs: number | null;
  /** ordered tool calls */
  tools: ToolCall[];
  tokens: TokenUsage;
  /** conversation turns, when available */
  numTurns: number | null;
  /** final answer text — already redacted + truncated */
  answer: string;
  cost: number | null;
  /** honesty flag, e.g. "Codex parser is best-effort (unverified against a live CLI)" */
  note?: string;
}

/** Metrics computed for one session against a task's gold set. */
export interface RunMetrics {
  atharCalled: boolean;
  atharFirst: boolean;
  /** 0-based index of the first Athar call among tool calls, or null */
  atharOrder: number | null;
  toolCalls: number;
  searches: number;
  distinctFilesOpened: number;
  irrelevantFilesOpened: number;
  relevantHit: number;
  goldCount: number;
  /** relevant opened / total opened; null when nothing was opened */
  precision: number | null;
  /** relevant hit (opened or named in the answer) / gold count; null when no gold */
  recall: number | null;
  /** ms to the first tool call that touched a gold file; null if none */
  timeToFirstRelevantMs: number | null;
  /** retrieval: did the answer contain every expected anchor? null if not graded */
  answerCorrect: boolean | null;
  /** e2e: did the test command pass? null if not run */
  testsPassed: boolean | null;
}

/** One fully-described run: project × task × agent × condition × repeat. */
export interface BenchmarkRun {
  projectId: string;
  taskId: string;
  agent: AgentKind;
  condition: Condition;
  /** 1-based repeat index */
  repeat: number;
  mode: BenchmarkMode;
  /** commit the staged copy was pinned to, when the source is a git repo */
  commit: string | null;
  model: string | null;
  ok: boolean;
  failure?: string;
  metrics: RunMetrics | null;
  session: NormalizedSession;
  startedAt: string;
}

/** Graph scan time, recorded ONCE per project as a setup cost — never folded into runs. */
export interface ScanCost {
  projectId: string;
  scanMs: number;
  nodes: number;
  edges: number;
  trackedFileCount: number;
}

/** Readiness of one agent's subscription auth — reported WITHOUT exposing credentials. */
export interface AgentReadiness {
  agent: AgentKind;
  installed: boolean;
  /** path to the CLI binary, for diagnostics only */
  binPath: string | null;
  /** true = confirmed ready; false = confirmed not ready; "unknown" = can't tell for free */
  authenticated: boolean | "unknown";
  /** safe, credential-free explanation */
  detail: string;
  /** the one command that fixes an auth gap, when applicable */
  remediation?: string;
}

/** The complete, serializable benchmark report. */
export interface BenchmarkReport {
  atharVersion: string;
  createdAt: string;
  seed: number;
  mode: BenchmarkMode | "mixed";
  repeat: number;
  agents: AgentKind[];
  readiness: AgentReadiness[];
  scanCosts: ScanCost[];
  runs: BenchmarkRun[];
  /** environment note — never holds secrets */
  env: { platform: string; node: string };
}
