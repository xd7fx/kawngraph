import type { CheckResult, DoctorReport } from "./checks";

const TAG: Record<CheckResult["status"], string> = {
  pass: "PASS",
  warn: "WARN",
  fail: "FAIL",
};

/** Render a doctor report as plain text (stable, no colors — safe for any terminal or log). */
export function formatDoctorText(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(`athar doctor — ${report.root}`);
  lines.push("");
  for (const c of report.checks) {
    lines.push(`[${TAG[c.status]}] ${c.title}: ${c.detail}`);
    if (c.remediation && c.status !== "pass") lines.push(`        ↳ fix: ${c.remediation}`);
  }
  lines.push("");
  lines.push(
    `${report.ok ? "healthy" : "problems found"} — ${report.summary.pass} pass · ${report.summary.warn} warn · ${report.summary.fail} fail`,
  );
  return lines.join("\n");
}

/** Stable JSON form for CI / programmatic use (`athar doctor --json`). */
export function formatDoctorJson(report: DoctorReport): string {
  return JSON.stringify(report, null, 2) + "\n";
}

/** Process exit code: 0 when healthy (no failing checks), 1 otherwise. */
export function doctorExitCode(report: DoctorReport): number {
  return report.ok ? 0 : 1;
}
