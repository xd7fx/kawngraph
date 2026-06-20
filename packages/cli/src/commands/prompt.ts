import * as readline from "node:readline";

/**
 * Ask a yes/no question. Returns `assumeYes` immediately when `--yes` was passed,
 * and `false` (never hangs) when stdin is not a TTY — so CI and piped invocations
 * are safe and deterministic. The prompt is written to stderr to keep stdout
 * reserved for machine-readable output.
 */
export function confirm(question: string, assumeYes: boolean): Promise<boolean> {
  if (assumeYes) return Promise.resolve(true);
  if (!process.stdin.isTTY) return Promise.resolve(false);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}
