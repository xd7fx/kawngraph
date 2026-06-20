/**
 * Process helpers. Two flavors:
 *   - {@link run} — synchronous, for short commands (which, git, scan, tests).
 *   - {@link runStreaming} — asynchronous, line-timestamped, timeout-killable, for
 *     long agent sessions where we must know WHEN each tool call happened.
 *
 * Windows note: under `shell: true` the command and args are quoted defensively,
 * because `process.execPath` is "C:\\Program Files\\nodejs\\node.exe" and the shell
 * would otherwise split it at the space.
 */
import { spawnSync, spawn } from "node:child_process";

export const isWin = process.platform === "win32";

/**
 * Run a raw shell command line (e.g. an e2e `testCommand`) in `opts.cwd`. Unlike
 * {@link run}, the whole string is handed to the shell verbatim so multi-token
 * commands and pipes work. Returns exit status + captured output.
 */
export function runShell(commandLine: string, opts: RunOptions = {}): RunResult {
  const r = spawnSync(commandLine, {
    cwd: opts.cwd,
    input: opts.input,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: opts.timeoutMs ?? 5 * 60 * 1000,
    env: opts.env ?? process.env,
  });
  const timedOut = r.error != null && (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
  return {
    status: typeof r.status === "number" ? r.status : null,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    timedOut,
  };
}

function quote(a: string): string {
  return /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
}

export interface RunOptions {
  cwd?: string;
  input?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Synchronous command. Quotes for the Windows shell so paths with spaces survive. */
export function run(cmd: string, args: string[], opts: RunOptions = {}): RunResult {
  const useShell = isWin;
  const finalCmd = useShell ? quote(cmd) : cmd;
  const finalArgs = useShell ? args.map(quote) : args;
  const r = spawnSync(finalCmd, finalArgs, {
    cwd: opts.cwd,
    input: opts.input,
    encoding: "utf8",
    shell: useShell,
    maxBuffer: 64 * 1024 * 1024,
    timeout: opts.timeoutMs ?? 5 * 60 * 1000,
    env: opts.env ?? process.env,
  });
  const timedOut = r.error != null && (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
  return {
    status: typeof r.status === "number" ? r.status : null,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    timedOut,
  };
}

/** Resolve a binary on PATH. Returns its absolute path, or null when not found. */
export function which(bin: string): string | null {
  const r = run(isWin ? "where" : "which", [bin], { timeoutMs: 15000 });
  if (r.status !== 0) return null;
  return (
    r.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s.length > 0) ?? null
  );
}

/** One stdout line with the ms offset (from process start) at which it arrived. */
export interface TimedLine {
  atMs: number;
  text: string;
}

export interface StreamOptions extends RunOptions {
  /** called for every complete stdout line as it arrives (for live progress) */
  onLine?: (line: TimedLine) => void;
}

export interface StreamResult extends RunResult {
  /** every stdout line, each tagged with its arrival time */
  lines: TimedLine[];
  wallMs: number;
}

/**
 * Spawn a long-running command, capturing stdout line-by-line with timestamps and
 * enforcing a hard timeout (the process tree is killed on expiry). The child's
 * stdin receives `opts.input` (the task prompt) and is then closed.
 */
export function runStreaming(cmd: string, args: string[], opts: StreamOptions = {}): Promise<StreamResult> {
  return new Promise((resolve) => {
    const useShell = isWin;
    const finalCmd = useShell ? quote(cmd) : cmd;
    const finalArgs = useShell ? args.map(quote) : args;
    const started = Date.now();

    const child = spawn(finalCmd, finalArgs, {
      cwd: opts.cwd,
      shell: useShell,
      env: opts.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const lines: TimedLine[] = [];
    let stdout = "";
    let stderr = "";
    let pending = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      // Kill the whole tree where possible (shell wrapper on Windows spawns children).
      try {
        if (isWin && child.pid != null) {
          run("taskkill", ["/PID", String(child.pid), "/T", "/F"], { timeoutMs: 10000 });
        } else {
          child.kill("SIGKILL");
        }
      } catch {
        /* best effort */
      }
    }, opts.timeoutMs ?? 8 * 60 * 1000);

    const pushLine = (text: string): void => {
      const line: TimedLine = { atMs: Date.now() - started, text };
      lines.push(line);
      opts.onLine?.(line);
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      pending += chunk;
      let nl: number;
      while ((nl = pending.indexOf("\n")) >= 0) {
        const raw = pending.slice(0, nl).replace(/\r$/, "");
        pending = pending.slice(nl + 1);
        if (raw.length > 0) pushLine(raw);
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    const finish = (status: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (pending.trim().length > 0) pushLine(pending.replace(/\r$/, ""));
      resolve({ status, stdout, stderr, timedOut, lines, wallMs: Date.now() - started });
    };

    child.on("error", (err) => {
      stderr += `\n[spawn error] ${err instanceof Error ? err.message : String(err)}`;
      finish(null);
    });
    child.on("close", (code) => finish(code));

    if (opts.input != null) {
      child.stdin.write(opts.input);
    }
    child.stdin.end();
  });
}
