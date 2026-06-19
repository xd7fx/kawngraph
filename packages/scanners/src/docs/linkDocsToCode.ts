import {
  AtharNode,
  AtharEdge,
  EdgeType,
  Evidence,
  ScanResult,
  edgeId,
  toPosix,
  posixDirname,
  posixJoin,
} from "@athar/shared";
import { DocScan } from "./scanDocs";

/**
 * Post-pass that links docs to code with NO LLM — only deterministic, evidence-
 * backed rules over the already-built node set:
 *
 * - `documents` (doc -> file): a markdown link resolves to a known file node.
 * - `explains`  (section -> route|symbol|table): a heading names a code entity.
 * - `mentions`  (doc -> route|file|symbol|table): the body references one.
 *
 * Distinctive tokens (file paths, route URLs) are matched anywhere in the text;
 * plain identifiers (symbol/table names) are matched as whole words and, when
 * not "code-like", only inside code spans/fences — keeping false positives low.
 */

interface RouteIx {
  id: string;
  url: string;
  label: string;
}

interface Indices {
  fileByPath: Map<string, string>;
  symbolByName: Map<string, string[]>;
  tableByName: Map<string, string>;
  routes: RouteIx[];
}

// Route handlers are named after the HTTP method; the `route` node already
// represents them, so they are not linked as standalone symbols (avoids a doc
// saying "GET" linking to every GET handler).
const HTTP_METHOD_NAMES = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function buildIndices(nodes: AtharNode[]): Indices {
  const fileByPath = new Map<string, string>();
  const symbolByName = new Map<string, string[]>();
  const tableByName = new Map<string, string>();
  const routes: RouteIx[] = [];

  for (const n of nodes) {
    if (n.type === "file") {
      fileByPath.set(toPosix(n.sourcePath), n.id);
    } else if (n.type === "function" || n.type === "class") {
      if (n.type === "function" && HTTP_METHOD_NAMES.has(n.label)) continue;
      const arr = symbolByName.get(n.label);
      if (arr) arr.push(n.id);
      else symbolByName.set(n.label, [n.id]);
    } else if (n.type === "table") {
      tableByName.set(n.label.toLowerCase(), n.id);
    } else if (n.type === "route") {
      const url = typeof n.metadata?.["url"] === "string" ? (n.metadata["url"] as string) : "";
      routes.push({ id: n.id, url, label: n.label });
    }
  }
  return { fileByPath, symbolByName, tableByName, routes };
}

function lineAt(content: string, index: number): number {
  let line = 1;
  const end = Math.min(index, content.length);
  for (let i = 0; i < end; i++) if (content[i] === "\n") line++;
  return line;
}

function evidenceAt(relPath: string, content: string, index: number): Evidence {
  const line = lineAt(content, index);
  const text = (content.split(/\r?\n/)[line - 1] ?? "").trim().slice(0, 200);
  return { sourcePath: relPath, lineStart: line, snippet: text };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** First whole-word occurrence of `name`, or null. `flags` lets callers add "i". */
function findWord(content: string, name: string, flags = ""): number {
  const re = new RegExp(`(?<![\\w$])${escapeRe(name)}(?![\\w$])`, flags);
  const m = re.exec(content);
  return m ? m.index : -1;
}

/** A symbol distinctive enough to match in prose without code fences around it. */
function isCodeLikeSymbol(name: string): boolean {
  return /[A-Z_]/.test(name) || name.length >= 8;
}

function isCodeLikeTable(name: string): boolean {
  return name.includes("_") || name.length >= 7;
}

/** Resolve a link/path string (relative to the doc, or repo-root) to a file node. */
function resolveFile(docRel: string, href: string, fileByPath: Map<string, string>): string | null {
  const clean = href.split("#")[0].split("?")[0].trim();
  if (!clean || /^[a-z]+:\/\//i.test(clean) || clean.startsWith("mailto:")) return null;
  const candidates: string[] = [];
  if (clean.startsWith("/")) candidates.push(clean.slice(1));
  else if (clean.startsWith(".")) candidates.push(posixJoin(posixDirname(docRel), clean));
  else {
    candidates.push(clean);
    candidates.push(posixJoin(posixDirname(docRel), clean));
  }
  for (const c of candidates) {
    const id = fileByPath.get(toPosix(c));
    if (id) return id;
  }
  return null;
}

export function linkDocsToCode(docs: DocScan[], nodes: AtharNode[]): ScanResult {
  if (docs.length === 0) return { nodes: [], edges: [] };
  const ix = buildIndices(nodes);
  const edges: AtharEdge[] = [];
  const seen = new Set<string>();

  const add = (type: EdgeType, from: string, to: string, evidence: Evidence): void => {
    const id = edgeId(type, from, to);
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({ id, from, to, type, confidence: "linked", evidence });
  };

  for (const doc of docs) {
    const docRel = doc.relPath;
    const content = doc.parsed.content;
    // Concatenated code spans/fences, used to allow non-distinctive name matches.
    const codeText = [
      ...doc.parsed.inlineCode.map((c) => c.text),
      ...doc.parsed.codeBlocks.map((b) => b.content),
    ].join("\n");

    const explained = new Set<string>(); // targets already tied to a section heading
    const documentedFiles = new Set<string>();

    // explains: a heading names a route / symbol / table
    for (const sec of doc.sections) {
      const t = sec.text;
      for (const r of ix.routes) {
        if ((r.url && t.includes(r.url)) || t.includes(r.label)) {
          add("explains", sec.id, r.id, { sourcePath: docRel, lineStart: sec.line, snippet: t });
          explained.add(r.id);
        }
      }
      for (const [name, ids] of ix.symbolByName) {
        if (findWord(t, name) !== -1) {
          for (const id of ids) {
            add("explains", sec.id, id, { sourcePath: docRel, lineStart: sec.line, snippet: t });
            explained.add(id);
          }
        }
      }
      for (const [name, id] of ix.tableByName) {
        if (findWord(t, name, "i") !== -1) {
          add("explains", sec.id, id, { sourcePath: docRel, lineStart: sec.line, snippet: t });
          explained.add(id);
        }
      }
    }

    // documents: markdown links pointing at a file node
    for (const link of doc.parsed.links) {
      const fid = resolveFile(docRel, link.href, ix.fileByPath);
      if (fid) {
        add("documents", doc.docNodeId, fid, {
          sourcePath: docRel,
          lineStart: link.line,
          snippet: `[${link.text}](${link.href})`,
        });
        documentedFiles.add(fid);
      }
    }

    // mentions: body references not already captured as explains/documents
    for (const r of ix.routes) {
      if (explained.has(r.id)) continue;
      const idx = r.url ? content.indexOf(r.url) : -1;
      const labelIdx = idx === -1 ? content.indexOf(r.label) : idx;
      if (labelIdx !== -1) add("mentions", doc.docNodeId, r.id, evidenceAt(docRel, content, labelIdx));
    }

    for (const [path, fid] of ix.fileByPath) {
      if (documentedFiles.has(fid)) continue;
      const idx = content.indexOf(path);
      if (idx !== -1) add("mentions", doc.docNodeId, fid, evidenceAt(docRel, content, idx));
    }

    for (const [name, ids] of ix.symbolByName) {
      if (ids.every((id) => explained.has(id))) continue;
      let idx = isCodeLikeSymbol(name) ? findWord(content, name) : -1;
      if (idx === -1 && findWord(codeText, name) !== -1) idx = content.indexOf(name);
      if (idx !== -1) {
        for (const id of ids) {
          if (!explained.has(id)) add("mentions", doc.docNodeId, id, evidenceAt(docRel, content, idx));
        }
      }
    }

    for (const [name, id] of ix.tableByName) {
      if (explained.has(id)) continue;
      let idx = isCodeLikeTable(name) ? findWord(content, name, "i") : -1;
      if (idx === -1 && findWord(codeText, name, "i") !== -1) {
        idx = content.toLowerCase().indexOf(name);
      }
      if (idx !== -1) add("mentions", doc.docNodeId, id, evidenceAt(docRel, content, idx));
    }
  }

  return { nodes: [], edges };
}
