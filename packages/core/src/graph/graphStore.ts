import * as fs from "node:fs/promises";
import * as path from "node:path";
import { AtharGraph } from "@athar/shared";
import { serializeGraph } from "./serializeGraph";

export function atharDir(root: string): string {
  return path.join(root, ".athar");
}
export function graphPath(root: string): string {
  return path.join(atharDir(root), "graph.json");
}
export function reportPath(root: string): string {
  return path.join(atharDir(root), "report.md");
}

export async function ensureAtharDir(root: string): Promise<void> {
  await fs.mkdir(atharDir(root), { recursive: true });
}

export async function writeGraph(root: string, graph: AtharGraph): Promise<string> {
  await ensureAtharDir(root);
  const target = graphPath(root);
  await fs.writeFile(target, serializeGraph(graph), "utf8");
  return target;
}

export async function writeReport(root: string, markdown: string): Promise<string> {
  await ensureAtharDir(root);
  const target = reportPath(root);
  await fs.writeFile(target, markdown, "utf8");
  return target;
}

export async function readGraph(root: string): Promise<AtharGraph> {
  const raw = await fs.readFile(graphPath(root), "utf8");
  return JSON.parse(raw) as AtharGraph;
}

export async function graphExists(root: string): Promise<boolean> {
  try {
    await fs.access(graphPath(root));
    return true;
  } catch {
    return false;
  }
}
