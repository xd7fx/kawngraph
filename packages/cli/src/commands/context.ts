import * as fs from "node:fs/promises";
import { Logger, ContextMode, ContextPack, ContextItem, ContextRisk } from "@athar/shared";
import { readGraph, graphExists, buildContextPack } from "@athar/core";

export interface ContextArgs {
  root: string;
  task: string | undefined;
  budget?: number;
  mode: ContextMode;
  json: boolean;
  out?: string;
  logger: Logger;
}

export async function runContext(args: ContextArgs): Promise<void> {
  const { root, task, budget, mode, json, out, logger } = args;
  if (!task) {
    logger.error('usage: athar context "<task>" [--budget N] [--mode code|docs|all] [--json] [--out file]');
    process.exitCode = 1;
    return;
  }
  if (!(await graphExists(root))) {
    logger.error("no .athar/graph.json found — run `athar scan` first");
    process.exitCode = 1;
    return;
  }

  const graph = await readGraph(root);
  const pack = buildContextPack(graph, task, { budget, mode });

  const output = json ? JSON.stringify(pack, null, 2) : formatPack(pack);
  if (out) {
    await fs.writeFile(out, output.endsWith("\n") ? output : output + "\n", "utf8");
    logger.success(`wrote ${out}`);
  } else {
    process.stdout.write(output + "\n");
  }
}

function itemLine(i: ContextItem): string {
  const loc = i.lineStart ? `${i.sourcePath}:${i.lineStart}` : i.sourcePath;
  return `  [${i.type}] ${i.label}\n      ${loc}  ~${i.tokensEstimate} tok  ·  ${i.reason}`;
}

function riskLine(r: ContextRisk): string {
  return `  [${r.level.toUpperCase()}] ${r.kind} — ${r.message}`;
}

function section(title: string, items: ContextItem[]): string {
  if (items.length === 0) return `${title} (0): none`;
  return `${title} (${items.length}):\n${items.map(itemLine).join("\n")}`;
}

function formatPack(pack: ContextPack): string {
  const out: string[] = [];
  out.push(`Context pack for: "${pack.task}"   (mode: ${pack.mode})`);
  out.push(
    `Budget: ${pack.budget} tok · Used: ~${pack.tokensUsed} tok · Confidence: ${pack.confidence}`,
  );
  out.push("");
  out.push(section("Must read", pack.mustRead));
  out.push("");
  out.push(section("Related docs", pack.relatedDocs));
  out.push("");
  out.push(section("Tables", pack.tables));
  out.push("");
  out.push(section("Tests", pack.tests));
  out.push("");

  if (pack.risks.length > 0) {
    out.push(`Risks (${pack.risks.length}):`);
    out.push(pack.risks.map(riskLine).join("\n"));
  } else {
    out.push("Risks (0): none");
  }
  out.push("");

  if (pack.excluded.length > 0) {
    out.push(`Excluded (${pack.excluded.length}):`);
    out.push(pack.excluded.map((e) => `  - ${e.label} — ${e.reason}`).join("\n"));
  }
  return out.join("\n");
}
