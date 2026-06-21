import * as fs from "node:fs/promises";
import * as path from "node:path";
import { KawnGraph } from "@kawngraph/shared";
import { serializeGraph } from "./serializeGraph";

export function kawnDir(root: string): string {
  return path.join(root, ".kawn");
}
export function graphPath(root: string): string {
  return path.join(kawnDir(root), "graph.json");
}
export function reportPath(root: string): string {
  return path.join(kawnDir(root), "report.md");
}

export async function ensureKawnDir(root: string): Promise<void> {
  await fs.mkdir(kawnDir(root), { recursive: true });
}

export async function writeGraph(root: string, graph: KawnGraph): Promise<string> {
  await ensureKawnDir(root);
  const target = graphPath(root);
  await fs.writeFile(target, serializeGraph(graph), "utf8");
  return target;
}

export async function writeReport(root: string, markdown: string): Promise<string> {
  await ensureKawnDir(root);
  const target = reportPath(root);
  await fs.writeFile(target, markdown, "utf8");
  return target;
}

export async function readGraph(root: string): Promise<KawnGraph> {
  const raw = await fs.readFile(graphPath(root), "utf8");
  return JSON.parse(raw) as KawnGraph;
}

export async function graphExists(root: string): Promise<boolean> {
  try {
    await fs.access(graphPath(root));
    return true;
  } catch {
    return false;
  }
}
