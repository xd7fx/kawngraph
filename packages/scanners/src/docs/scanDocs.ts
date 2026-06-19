import {
  AtharNode,
  AtharEdge,
  ScanResult,
  docId,
  sectionId,
  edgeId,
  posixBasename,
} from "@athar/shared";
import { parseMarkdown, ParsedMarkdown } from "./parseMarkdown";

export interface DocSection {
  id: string;
  slug: string;
  text: string;
  level: number;
  line: number;
}

/**
 * Everything {@link linkDocsToCode} needs to connect one doc to code nodes,
 * carried alongside the structural {@link ScanResult} so the file is parsed once.
 */
export interface DocScan {
  relPath: string;
  docNodeId: string;
  parsed: ParsedMarkdown;
  sections: DocSection[];
}

/**
 * Structural scan of a markdown/mdx file: emit the `doc` node and one `section`
 * node per heading (`section belongs_to doc`). No code links here — that is a
 * post-pass ({@link linkDocsToCode}) so it can resolve against the full graph.
 */
export function scanDocs(relPath: string, content: string): { result: ScanResult; doc: DocScan } {
  const parsed = parseMarkdown(content);
  const nodes: AtharNode[] = [];
  const edges: AtharEdge[] = [];

  const dId = docId(relPath);
  const docNode: AtharNode = {
    id: dId,
    type: "doc",
    layer: "docs",
    label: parsed.title ?? posixBasename(relPath),
    sourcePath: relPath,
  };
  const meta: Record<string, unknown> = { headings: parsed.headings.length };
  if (Object.keys(parsed.frontmatter).length > 0) meta["frontmatter"] = parsed.frontmatter;
  docNode.metadata = meta;
  nodes.push(docNode);

  const usedSlugs = new Map<string, number>();
  const sections: DocSection[] = [];
  for (const h of parsed.headings) {
    const base = h.slug || "section";
    const seen = usedSlugs.get(base) ?? 0;
    usedSlugs.set(base, seen + 1);
    const slug = seen === 0 ? base : `${base}-${seen}`;

    const sId = sectionId(relPath, slug);
    nodes.push({
      id: sId,
      type: "section",
      layer: "docs",
      label: h.text,
      sourcePath: relPath,
      lineStart: h.line,
      metadata: { level: h.level, slug },
    });
    edges.push({
      id: edgeId("belongs_to", sId, dId),
      from: sId,
      to: dId,
      type: "belongs_to",
      confidence: "extracted",
      evidence: { sourcePath: relPath, lineStart: h.line, snippet: `${"#".repeat(h.level)} ${h.text}` },
    });
    sections.push({ id: sId, slug, text: h.text, level: h.level, line: h.line });
  }

  return { result: { nodes, edges }, doc: { relPath, docNodeId: dId, parsed, sections } };
}
