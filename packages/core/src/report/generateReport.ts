import { KawnGraph, KawnNode, KawnEdge } from "@kawngraph/shared";

interface Degree {
  node: KawnNode;
  in: number;
  out: number;
}

/** Render a human-readable markdown summary of the graph. */
export function generateReport(graph: KawnGraph): string {
  const lines: string[] = [];
  const push = (s = ""): void => {
    lines.push(s);
  };

  push(`# KawnGraph graph report`);
  push();
  push(`- Generated: ${graph.generatedAt}`);
  push(`- Root: \`${graph.root}\``);
  push(`- KawnGraph version: ${graph.kawnVersion}`);
  push(`- Nodes: **${graph.stats.nodes}** · Edges: **${graph.stats.edges}**`);
  push();

  countTable(push, "Nodes by layer", graph.stats.byLayer);
  countTable(push, "Nodes by type", graph.stats.byType);
  countTable(push, "Edges by type", graph.stats.byEdgeType);

  const degrees = computeDegrees(graph);
  push(`## Most connected nodes`);
  push();
  push(`| Node | Type | In | Out |`);
  push(`| ---- | ---- | --: | --: |`);
  for (const d of degrees.slice(0, 15)) {
    push(`| \`${d.node.label}\` | ${d.node.type} | ${d.in} | ${d.out} |`);
  }
  push();

  const routes = graph.nodes.filter((n) => n.type === "route").sort(byLabel);
  if (routes.length > 0) {
    push(`## Routes (${routes.length})`);
    push();
    for (const r of routes) push(`- \`${r.label}\` — \`${r.sourcePath}\``);
    push();
  }

  const tables = graph.nodes.filter((n) => n.type === "table").sort(byLabel);
  if (tables.length > 0) {
    push(`## Tables (${tables.length})`);
    push();
    for (const t of tables) push(`- \`${t.label}\``);
    push();
    const fks = graph.edges.filter((e) => e.type === "references" && e.from.startsWith("table:") && e.to.startsWith("table:"));
    if (fks.length > 0) {
      push(`### Foreign keys`);
      push();
      for (const e of fks) push(`- \`${strip(e.from)}\` → \`${strip(e.to)}\``);
      push();
    }
  }

  const docs = graph.nodes.filter((n) => n.type === "doc").sort(byLabel);
  if (docs.length > 0) {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    const sectionsByDoc = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      if (e.type !== "belongs_to" || !e.from.startsWith("section:")) continue;
      const set = sectionsByDoc.get(e.to) ?? new Set<string>();
      set.add(e.from);
      sectionsByDoc.set(e.to, set);
    }
    push(`## Docs (${docs.length})`);
    push();
    for (const d of docs) {
      const sectionIds = sectionsByDoc.get(d.id) ?? new Set<string>();
      const links: KawnEdge[] = graph.edges.filter(
        (e) =>
          ((e.type === "documents" || e.type === "mentions") && e.from === d.id) ||
          (e.type === "explains" && sectionIds.has(e.from)),
      );
      push(`- \`${d.label}\` — \`${d.sourcePath}\` · ${sectionIds.size} sections, ${links.length} code links`);
      for (const e of links) {
        const target = nodeById.get(e.to);
        if (target) push(`  - ${e.type} → \`${target.label}\` (${target.type})`);
      }
    }
    push();
  }

  const packages = graph.nodes.filter((n) => n.type === "package").sort(byLabel);
  if (packages.length > 0) {
    push(`## Packages (${packages.length})`);
    push();
    for (const p of packages) {
      const deps = graph.edges
        .filter((e) => e.type === "depends_on" && e.from === p.id)
        .map((e) => strip(e.to));
      push(`- \`${p.label}\`${deps.length ? ` → depends on ${deps.map((d) => `\`${d}\``).join(", ")}` : ""}`);
    }
    push();
  }

  return lines.join("\n") + "\n";
}

function countTable(push: (s?: string) => void, title: string, rec: Record<string, number>): void {
  const entries = Object.entries(rec).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return;
  push(`## ${title}`);
  push();
  push(`| Key | Count |`);
  push(`| --- | ----: |`);
  for (const [k, v] of entries) push(`| ${k} | ${v} |`);
  push();
}

function computeDegrees(graph: KawnGraph): Degree[] {
  const inMap = new Map<string, number>();
  const outMap = new Map<string, number>();
  for (const e of graph.edges) {
    outMap.set(e.from, (outMap.get(e.from) ?? 0) + 1);
    inMap.set(e.to, (inMap.get(e.to) ?? 0) + 1);
  }
  return graph.nodes
    .map((node) => ({ node, in: inMap.get(node.id) ?? 0, out: outMap.get(node.id) ?? 0 }))
    .sort((a, b) => b.in + b.out - (a.in + a.out));
}

function byLabel(a: KawnNode, b: KawnNode): number {
  return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
}

function strip(id: string): string {
  const i = id.indexOf(":");
  return i === -1 ? id : id.slice(i + 1);
}
