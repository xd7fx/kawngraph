import * as fs from "node:fs/promises";
import { Logger, ContextMode, ContextFreshness } from "@kawngraph/shared";
import { readGraph, graphExists, buildContextPack, graphFreshness } from "@kawngraph/core";
import { toUniversalPack, toMarkdown } from "@kawngraph/context-protocol";
import { localSummarize } from "./localLlm";

/**
 * `kawn pack` — export the SAME Context Pack in a tool-agnostic format so any
 * agent (even one without MCP) can consume it:
 *   - `markdown` (default) — an agent-neutral, ready-to-paste prompt (UCP Markdown)
 *   - `json`               — the agent-neutral Universal Context Pack as JSON
 *
 * `--local` optionally condenses the Markdown via a local LLM (Ollama / LM Studio);
 * it is never required and silently falls back to the deterministic pack.
 */
export type PackFormat = "markdown" | "json";

export interface PackArgs {
  root: string;
  task: string | undefined;
  budget?: number;
  mode: ContextMode;
  format: PackFormat;
  out?: string;
  local: boolean;
  model?: string;
  logger: Logger;
}

export async function runPack(args: PackArgs): Promise<void> {
  const { root, task, budget, mode, format, out, local, model, logger } = args;
  if (!task) {
    logger.error('usage: kawn pack "<task>" [--format markdown|json] [--budget N] [--mode …] [--local] [--out file]');
    process.exitCode = 1;
    return;
  }
  if (!(await graphExists(root))) {
    logger.error("no .kawn/graph.json found — run `kawn scan` first");
    process.exitCode = 1;
    return;
  }

  const graph = await readGraph(root);
  const f = await graphFreshness(root);
  const freshness: ContextFreshness = {
    status: f.status,
    detail: f.detail,
    scannedAt: f.scannedAt,
    gitHead: f.gitHead,
    remediation: f.remediation,
  };
  const pack = buildContextPack(graph, task, { budget, mode, freshness });
  const universal = toUniversalPack(pack, { graph });
  const markdown = toMarkdown(universal);

  let output: string;
  if (format === "json") {
    output = JSON.stringify(universal, null, 2);
  } else {
    output = markdown;
    if (local) {
      const r = await localSummarize(root, markdown, { model });
      if (r.ok) {
        output = `<!-- condensed by local LLM: ${r.provider}/${r.model} (optional; source pack is deterministic) -->\n\n${r.text}`;
        logger.info(`condensed via local ${r.provider} model "${r.model}"`);
      } else {
        // Never fail or pollute stdout: fall back to the deterministic pack.
        logger.warn(`--local skipped: ${r.error}. Emitting the deterministic pack instead.`);
      }
    }
  }

  if (out) {
    await fs.writeFile(out, output.endsWith("\n") ? output : output + "\n", "utf8");
    logger.success(`wrote ${out}`);
  } else {
    process.stdout.write(output.endsWith("\n") ? output : output + "\n");
  }
}
