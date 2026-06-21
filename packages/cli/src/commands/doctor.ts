import * as path from "node:path";
import { Logger } from "@kawngraph/shared";
import { runDoctor, formatDoctorText, formatDoctorJson, doctorExitCode, type Scope } from "@kawngraph/agents";

export interface DoctorArgs {
  root: string;
  scope: Scope;
  json: boolean;
  /** skip the live MCP handshake (faster; no child process) */
  skipProbe: boolean;
  logger: Logger;
}

/**
 * `kawn doctor` — read-only health audit. Reports PASS/WARN/FAIL for the Node
 * runtime, graph freshness, MCP server resolution + live handshake, and each
 * agent integration. Exits non-zero when any check FAILs so CI can gate on it.
 * Never scans, never writes the graph, never edits agent config.
 */
export async function runDoctorCommand(args: DoctorArgs): Promise<void> {
  const root = path.resolve(args.root);
  const report = await runDoctor({ root, scope: args.scope, skipProbe: args.skipProbe });
  if (args.json) {
    process.stdout.write(formatDoctorJson(report));
  } else {
    process.stdout.write(formatDoctorText(report) + "\n");
  }
  process.exitCode = doctorExitCode(report);
}
