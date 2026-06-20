import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  Logger,
  ContextMode,
  ContextPack,
  ContextItem,
  ContextRisk,
  AtharNode,
} from "@athar/shared";
import {
  readGraph,
  graphExists,
  gitChangedFiles,
  analyzeChangeImpact,
  buildContextPack,
  GitError,
  type ChangeSet,
  type ChangeImpact,
  type ChangedFileImpact,
} from "@athar/core";

/**
 * The three diff-driven views, all over a single git change set:
 *   - `diff`    — what changed, mapped onto the graph (in-graph / unmapped)
 *   - `impact`  — the blast radius: changed nodes → dependents → re-check list
 *   - `context` — a budgeted Context Pack to actually work the change
 */
export type ChangesView = "diff" | "impact" | "context";

export interface ChangesArgs {
  root: string;
  /** Base ref → PR mode (`base...head`). Unset → working-tree mode. */
  base?: string;
  /** Head ref for PR mode (default HEAD). */
  head?: string;
  /** Max impact depth (default 6). */
  depth?: number;
  /** Token budget for the context view (default 8000). */
  budget?: number;
  mode: ContextMode;
  json: boolean;
  out?: string;
  logger: Logger;
}

const USAGE: Record<ChangesView, string> = {
  diff: "usage: athar diff [--base <ref>] [--head <ref>] [--root path] [--json]",
  impact: "usage: athar pr-impact [--base <ref>] [--head <ref>] [--depth N] [--root path] [--json]",
  context:
    'usage: athar pr-context [--base <ref>] [--head <ref>] [--budget N] [--mode code|docs|all] [--root path] [--json]',
};

export async function runChanges(args: ChangesArgs, view: ChangesView): Promise<void> {
  const { root, base, head, depth, budget, mode, json, out, logger } = args;

  // 1. Read the change set from local git only — read-only and offline. Never a
  //    remote, never the GitHub API. A typed GitError becomes an actionable line.
  let changeSet: ChangeSet;
  try {
    changeSet = gitChangedFiles(root, base !== undefined ? { base, head } : {});
  } catch (err) {
    if (err instanceof GitError) {
      logger.error(`${err.message}  (${USAGE[view]})`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const hasGraph = await graphExists(root);

  // The impact/context views need the graph; diff degrades gracefully without it.
  if (!hasGraph && view !== "diff") {
    logger.error("no .athar/graph.json found — run `athar scan` first");
    process.exitCode = 1;
    return;
  }

  if (changeSet.files.length === 0) {
    const output = json
      ? jsonString({ label: changeSet.label, range: changeSet.range, files: [] })
      : `No changes detected (${changeSet.label}).`;
    await emit(output, out, logger);
    return;
  }

  // 2. diff view with no graph: a plain, honest change list + a nudge to scan.
  if (view === "diff" && !hasGraph) {
    const output = json ? jsonString(changeSet) : formatPlainDiff(changeSet);
    await emit(output, out, logger);
    return;
  }

  // 3. One analysis feeds every graph-aware view.
  const graph = await readGraph(root);
  const impact = analyzeChangeImpact(graph, changeSet, depth !== undefined ? { maxDepth: depth } : {});

  if (view === "diff") {
    await emit(json ? jsonString(impactDiffJson(impact)) : formatDiff(impact), out, logger);
    return;
  }

  if (view === "impact") {
    await emit(json ? jsonString(impactJson(impact)) : formatImpact(impact), out, logger);
    return;
  }

  // context view: a real, budgeted Context Pack seeded by the changed surface.
  const task = synthTask(impact);
  const pack = buildContextPack(graph, task, budget !== undefined ? { budget, mode } : { mode });
  if (json) {
    await emit(jsonString({ change: changeSummary(impact), task, pack }), out, logger);
  } else {
    await emit(formatContext(impact, task, pack), out, logger);
  }
}

// ── task synthesis ──────────────────────────────────────────────────────────

/**
 * A task string for the context pack, built from the change itself: prefer the
 * names of changed symbols (functions/classes/routes), falling back to changed
 * file basenames. These are high-signal keywords that rank the changed surface
 * and its neighbours to the top of the pack.
 */
function synthTask(impact: ChangeImpact): string {
  const symbolNames = impact.changedNodes.filter((n) => n.type !== "file").map((n) => n.label);
  const fileNames = impact.files.map((f) => baseName(f.path));
  const source = symbolNames.length > 0 ? symbolNames : fileNames;
  const uniq = [...new Set(source)].slice(0, 12);
  const what = uniq.length > 0 ? uniq.join(", ") : "the changed files";
  return `review and safely change ${what}`;
}

function baseName(p: string): string {
  return p.split("/").pop() ?? p;
}

// ── JSON shapes ─────────────────────────────────────────────────────────────

function jsonString(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function nodeBrief(n: AtharNode): { id: string; type: string; label: string; sourcePath: string; lineStart?: number } {
  return n.lineStart !== undefined
    ? { id: n.id, type: n.type, label: n.label, sourcePath: n.sourcePath, lineStart: n.lineStart }
    : { id: n.id, type: n.type, label: n.label, sourcePath: n.sourcePath };
}

function fileJson(f: ChangedFileImpact): Record<string, unknown> {
  return {
    path: f.path,
    status: f.status,
    ...(f.oldPath !== undefined ? { oldPath: f.oldPath } : {}),
    inGraph: f.inGraph,
    symbols: f.symbols.map(nodeBrief),
  };
}

function impactDiffJson(impact: ChangeImpact): Record<string, unknown> {
  return {
    label: impact.label,
    range: impact.range,
    files: impact.files.map(fileJson),
    unmappedFiles: impact.unmappedFiles,
  };
}

function impactJson(impact: ChangeImpact): Record<string, unknown> {
  return {
    label: impact.label,
    range: impact.range,
    files: impact.files.map(fileJson),
    unmappedFiles: impact.unmappedFiles,
    changedNodes: impact.changedNodes.map(nodeBrief),
    impacted: impact.impacted.map((r) => ({ depth: r.depth, via: r.via, node: nodeBrief(r.node) })),
    impactTruncated: impact.impactTruncated,
    filesToRecheck: impact.filesToRecheck,
    relatedDocs: impact.relatedDocs.map(nodeBrief),
    relatedTables: impact.relatedTables.map(nodeBrief),
    relatedTests: impact.relatedTests.map(nodeBrief),
    risks: impact.risks,
  };
}

function changeSummary(impact: ChangeImpact): Record<string, unknown> {
  return {
    label: impact.label,
    range: impact.range,
    changedFiles: impact.files.length,
    changedNodes: impact.changedNodes.length,
    impacted: impact.impacted.length,
    filesToRecheck: impact.filesToRecheck,
    unmappedFiles: impact.unmappedFiles,
  };
}

// ── text renderers ──────────────────────────────────────────────────────────

const STATUS_PAD = 10;

function loc(n: { sourcePath: string; lineStart?: number }): string {
  return n.lineStart ? `${n.sourcePath}:${n.lineStart}` : n.sourcePath;
}

function formatPlainDiff(cs: ChangeSet): string {
  const out: string[] = [`Changed files (${cs.files.length}) — ${cs.label}:`];
  for (const f of cs.files) {
    const rename = f.oldPath ? `  (from ${f.oldPath})` : "";
    out.push(`  ${f.status.padEnd(STATUS_PAD)} ${f.path}${rename}`);
  }
  out.push("");
  out.push("No graph yet — run `athar scan` to see which nodes these map to and what they impact.");
  return out.join("\n");
}

function formatDiff(impact: ChangeImpact): string {
  const out: string[] = [`Changed files (${impact.files.length}) — ${impact.label}:`];
  for (const f of impact.files) {
    const rename = f.oldPath ? `  (from ${f.oldPath})` : "";
    const map = f.inGraph
      ? f.symbols.length > 0
        ? `${f.symbols.length} symbol(s)`
        : "file node"
      : "not in graph";
    out.push(`  ${f.status.padEnd(STATUS_PAD)} ${f.path}${rename}   [${map}]`);
  }
  if (impact.unmappedFiles.length > 0) {
    out.push("");
    out.push(`Not in the graph yet — run \`athar update\` to include (${impact.unmappedFiles.length}):`);
    for (const p of impact.unmappedFiles) out.push(`  - ${p}`);
  }
  return out.join("\n");
}

function formatImpact(impact: ChangeImpact): string {
  const out: string[] = [];
  out.push(`Impact — ${impact.label}`);
  out.push("");

  out.push(`Changed nodes (${impact.changedNodes.length}):`);
  if (impact.changedNodes.length === 0) {
    out.push("  none of the changed files map to the graph (run `athar update`).");
  } else {
    for (const n of impact.changedNodes) {
      out.push(`  [${n.type}] ${n.label}  (${loc(n)})`);
    }
  }
  out.push("");

  const trunc = impact.impactTruncated ? " (truncated — more exist)" : "";
  out.push(`Impacted (${impact.impacted.length})${trunc}, nearest first:`);
  if (impact.impacted.length === 0) {
    out.push("  nothing depends on the changed nodes.");
  } else {
    for (const r of impact.impacted) {
      out.push(`  [d${r.depth}] ${r.via.padEnd(STATUS_PAD)} ${r.node.type.padEnd(8)} ${r.node.label}  (${r.node.sourcePath})`);
    }
  }
  out.push("");

  out.push(`Files to re-check (${impact.filesToRecheck.length}):`);
  for (const p of impact.filesToRecheck) out.push(`  - ${p}`);
  out.push("");

  pushNodeList(out, "Related docs", impact.relatedDocs);
  pushNodeList(out, "Related tables", impact.relatedTables);
  pushNodeList(out, "Related tests", impact.relatedTests);

  out.push(risksBlock(impact.risks));

  if (impact.unmappedFiles.length > 0) {
    out.push("");
    out.push(`Changed but not in graph (${impact.unmappedFiles.length}): ${impact.unmappedFiles.join(", ")}`);
  }
  return out.join("\n");
}

function formatContext(impact: ChangeImpact, task: string, pack: ContextPack): string {
  const out: string[] = [];
  out.push(`Context pack to work this change — ${impact.label}`);
  out.push(
    `${impact.files.length} file(s) changed · ${impact.changedNodes.length} node(s) · ${impact.impacted.length} impacted`,
  );
  out.push(`Task: "${task}"`);
  out.push(`Budget: ${pack.budget} tok · Used: ~${pack.tokensUsed} tok · Confidence: ${pack.confidence}`);
  out.push("");
  out.push(packSection("Must read", pack.mustRead));
  out.push("");
  out.push(packSection("Related docs", pack.relatedDocs));
  out.push("");
  out.push(packSection("Tables", pack.tables));
  out.push("");
  out.push(packSection("Tests", pack.tests));
  out.push("");
  if (impact.filesToRecheck.length > 0) {
    out.push(`Files to re-check (${impact.filesToRecheck.length}):`);
    for (const p of impact.filesToRecheck) out.push(`  - ${p}`);
    out.push("");
  }
  out.push(risksBlock(pack.risks));
  return out.join("\n");
}

function pushNodeList(out: string[], title: string, nodes: AtharNode[]): void {
  if (nodes.length === 0) {
    out.push(`${title} (0): none`);
  } else {
    out.push(`${title} (${nodes.length}):`);
    for (const n of nodes) out.push(`  [${n.type}] ${n.label}  (${loc(n)})`);
  }
  out.push("");
}

function packItem(i: ContextItem): string {
  const at = i.lineStart ? `${i.sourcePath}:${i.lineStart}` : i.sourcePath;
  return `  [${i.type}] ${i.label}\n      ${at}  ~${i.tokensEstimate} tok  ·  ${i.reason}`;
}

function packSection(title: string, items: ContextItem[]): string {
  if (items.length === 0) return `${title} (0): none`;
  return `${title} (${items.length}):\n${items.map(packItem).join("\n")}`;
}

function risksBlock(risks: ContextRisk[]): string {
  if (risks.length === 0) return "Risks (0): none";
  const lines = risks.map((r) => `  [${r.level.toUpperCase()}] ${r.kind} — ${r.message}`);
  return `Risks (${risks.length}):\n${lines.join("\n")}`;
}

// ── output ──────────────────────────────────────────────────────────────────

async function emit(output: string, out: string | undefined, logger: Logger): Promise<void> {
  const text = output.endsWith("\n") ? output : output + "\n";
  if (out) {
    await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await fs.writeFile(out, text, "utf8");
    logger.success(`wrote ${out}`);
  } else {
    process.stdout.write(text);
  }
}
