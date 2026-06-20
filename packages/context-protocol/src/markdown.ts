import type { Evidence } from "@athar/shared";
import type { UcpItem, UcpRisk, UcpSection, UniversalContextPack } from "./schema";

/**
 * Render a {@link UniversalContextPack} as deterministic, agent-readable
 * Markdown. This is the "drop it in the prompt" form: an agent that can't (or
 * won't) parse JSON still gets the same structured guidance — sections in order,
 * and every item annotated with its why / layer / location / rank / evidence.
 */
export function toMarkdown(pack: UniversalContextPack): string {
  const out: string[] = [];
  out.push(`# Context Pack — "${pack.task}"`);
  out.push("");
  out.push(
    [
      `**mode:** ${pack.mode}`,
      `**confidence:** ${pack.confidence}`,
      `**budget:** ~${pack.budget.used}/${pack.budget.limit} tok`,
      `**protocol:** v${pack.protocolVersion}`,
      `**producer:** ${pack.provenance.producer} ${pack.provenance.atharVersion}`,
    ].join("  ·  "),
  );
  out.push("");

  for (const section of pack.sections) {
    out.push(renderSection(section));
    out.push("");
  }

  out.push(renderRisks(pack.risks));
  out.push("");
  out.push(renderExcluded(pack.excluded));

  return out.join("\n").trimEnd() + "\n";
}

function renderSection(section: UcpSection): string {
  const lines: string[] = [`## ${section.title} (${section.role}) — ${section.items.length}`];
  if (section.items.length === 0) {
    lines.push("");
    lines.push("_none_");
    return lines.join("\n");
  }
  lines.push("");
  for (const item of section.items) lines.push(renderItem(item));
  return lines.join("\n");
}

function renderItem(item: UcpItem): string {
  const loc = locationOf(item);
  const head = `${item.rank.position}. **${item.label}** \`${loc}\` _(${item.kind} · ${item.layer} · ~${item.tokensEstimate} tok · score ${item.rank.score})_`;
  const why = `   - why: ${item.why}`;
  const ev = `   - evidence: ${item.evidence.map(fmtEvidence).join("; ")}`;
  return [head, why, ev].join("\n");
}

function renderRisks(risks: UcpRisk[]): string {
  if (risks.length === 0) return "## Risks (0)\n\n_none_";
  const lines = [`## Risks (${risks.length})`, ""];
  for (const r of risks) lines.push(`- **${r.level.toUpperCase()}** ${r.kind} — ${r.message}`);
  return lines.join("\n");
}

function renderExcluded(excluded: UniversalContextPack["excluded"]): string {
  if (excluded.length === 0) return "## Excluded (0)\n\n_none_";
  const lines = [`## Excluded (${excluded.length})`, ""];
  for (const e of excluded) lines.push(`- ${e.label} — ${e.reason}`);
  return lines.join("\n");
}

function locationOf(item: UcpItem): string {
  const { path, lineStart, lineEnd } = item.location;
  if (lineStart && lineEnd && lineEnd !== lineStart) return `${path}:${lineStart}-${lineEnd}`;
  if (lineStart) return `${path}:${lineStart}`;
  return path;
}

function fmtEvidence(e: Evidence): string {
  if (e.lineStart && e.lineEnd && e.lineEnd !== e.lineStart) return `${e.sourcePath}:${e.lineStart}-${e.lineEnd}`;
  if (e.lineStart) return `${e.sourcePath}:${e.lineStart}`;
  return e.sourcePath;
}
