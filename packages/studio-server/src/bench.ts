/**
 * Read-only loader for the newest local benchmark report.
 *
 * The behavioral benchmark writes JSON/CSV/Markdown under the gitignored
 * `benchmark-results/` directory. This module finds the most recent full report
 * JSON and returns it for the Studio's Bench view. It NEVER runs a benchmark and
 * never writes anything — it only reads what a prior `kawn benchmark` produced.
 *
 * Two deliberate robustness choices:
 *  - It tolerates pre-rename reports that still use `athar*` keys
 *    (`atharVersion`/`atharCalled`/`atharPack`/tool `athar`) by normalizing them
 *    onto the current `kawn*` schema, so local artifacts created before the
 *    KawnGraph rename remain viewable (mirrors the repo's `.athar→.kawn` stance).
 *  - It returns a friendly `{ ok:false, reason }` envelope rather than throwing
 *    when nothing is present or a file is unreadable, so the view can render an
 *    explanatory empty state instead of a 500.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

export type BenchUnavailable = "none" | "unreadable";

export type BenchResult =
  | { ok: true; source: string; report: unknown }
  | { ok: false; reason: BenchUnavailable; detail?: string };

const RESULTS_DIR = "benchmark-results";
/** Refuse to slurp an absurdly large file into memory (defensive, not expected). */
const MAX_REPORT_BYTES = 16 * 1024 * 1024;

/** A full report is named `merged-*.json` (campaigns) or `benchmark-*.json` (single runs). */
function isReportName(name: string): boolean {
  return name.endsWith(".json") && (name.startsWith("merged-") || name.startsWith("benchmark-"));
}

/** Recursively collect candidate report files, skipping transcripts/raw dumps. */
async function walkReports(dir: string, out: string[]): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // dir missing or unreadable -> no candidates
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === "transcripts" || entry.name === "node_modules") continue;
      await walkReports(path.join(dir, entry.name), out);
    } else if (entry.isFile() && isReportName(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
}

async function newestByMtime(files: string[]): Promise<string | null> {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const file of files) {
    try {
      const st = await fs.stat(file);
      if (st.mtimeMs > bestMs) {
        bestMs = st.mtimeMs;
        best = file;
      }
    } catch {
      /* ignore a file that vanished between walk and stat */
    }
  }
  return best;
}

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Map pre-rename `athar*` report keys onto the current `kawn*` schema, in place. */
function normalizeLegacy(report: Record<string, unknown>): void {
  if (typeof report.kawnVersion !== "string" && typeof report.atharVersion === "string") {
    report.kawnVersion = report.atharVersion;
  }
  const runs = report.runs;
  if (!Array.isArray(runs)) return;
  for (const run of runs) {
    if (!isObj(run)) continue;
    if (run.kawnPack === undefined && "atharPack" in run) run.kawnPack = run.atharPack;
    const metrics = run.metrics;
    if (isObj(metrics)) {
      if (metrics.kawnCalled === undefined && "atharCalled" in metrics) metrics.kawnCalled = metrics.atharCalled;
      if (metrics.kawnFirst === undefined && "atharFirst" in metrics) metrics.kawnFirst = metrics.atharFirst;
      if (metrics.kawnOrder === undefined && "atharOrder" in metrics) metrics.kawnOrder = metrics.atharOrder;
    }
    const session = run.session;
    if (isObj(session) && Array.isArray(session.tools)) {
      for (const tool of session.tools) {
        if (isObj(tool) && tool.kawn === undefined && "athar" in tool) tool.kawn = tool.athar;
      }
    }
  }
}

/**
 * Load the newest local benchmark report under `<root>/benchmark-results/`.
 * Prefers a merged campaign report over a single-run report. Read-only.
 */
export async function loadBenchReport(root: string): Promise<BenchResult> {
  const dir = path.join(root, RESULTS_DIR);
  const all: string[] = [];
  await walkReports(dir, all);
  if (all.length === 0) return { ok: false, reason: "none" };

  // A merged campaign report supersedes the single-run chunks it was built from.
  const merged = all.filter((f) => path.basename(f).startsWith("merged-"));
  const chosen = await newestByMtime(merged.length > 0 ? merged : all);
  if (!chosen) return { ok: false, reason: "none" };

  try {
    const st = await fs.stat(chosen);
    if (st.size > MAX_REPORT_BYTES) {
      return { ok: false, reason: "unreadable", detail: "benchmark report is too large to load" };
    }
    const parsed: unknown = JSON.parse(await fs.readFile(chosen, "utf8"));
    if (!isObj(parsed)) return { ok: false, reason: "unreadable", detail: "report is not a JSON object" };
    normalizeLegacy(parsed);
    if (!Array.isArray(parsed.runs) || typeof parsed.kawnVersion !== "string") {
      return { ok: false, reason: "unreadable", detail: "not a valid benchmark report (missing runs[]/version)" };
    }
    const source = path.relative(root, chosen).split(path.sep).join("/");
    return { ok: true, source, report: parsed };
  } catch (e) {
    return { ok: false, reason: "unreadable", detail: e instanceof Error ? e.message : "failed to read report" };
  }
}
