/**
 * Built-in Markdown/MDX plugin. The scan phase emits the structural `doc` and
 * `section` nodes (and `section belongs_to doc`) and stashes the parsed
 * {@link DocScan} on the contribution's private `data` payload. The finalize phase
 * reads those payloads back and runs {@link linkDocsToCode} against the complete
 * node set, producing the deterministic, evidence-backed `documents` / `explains`
 * / `mentions` edges — exactly the two-pass shape legacy `scanRepo` used.
 */
import { defineScannerPlugin, type ScannerPlugin, type FinalizeContext } from "@athar/scanner-sdk";
import { scanDocs, type DocScan } from "../docs/scanDocs";
import { linkDocsToCode } from "../docs/linkDocsToCode";

const DOC_RE = /\.mdx?$/i;

export function docsPlugin(): ScannerPlugin {
  return defineScannerPlugin({
    id: "builtin:docs",
    version: "1.0.0",
    apiVersion: "1",
    displayName: "Markdown / MDX",
    languages: ["markdown"],
    extensions: [".md", ".mdx"],
    capabilities: {
      nodeTypes: ["doc", "section"],
      edgeTypes: ["belongs_to", "documents", "explains", "mentions"],
      emitsEvidence: true,
      crossFile: true,
    },
    order: 3,
    detect: (f) => DOC_RE.test(f.relPath),
    scan: (f, content) => {
      const { result, doc } = scanDocs(f.relPath, content);
      return { nodes: result.nodes, edges: result.edges, data: doc };
    },
    finalize: (ctx) => {
      const docScans = collectDocScans(ctx);
      if (docScans.length === 0) return { nodes: [], edges: [] };
      const r = linkDocsToCode(docScans, [...ctx.allNodes]);
      return { nodes: r.nodes, edges: r.edges };
    },
  });
}

/** Recover the per-file DocScan payloads this plugin stashed during scan(). */
function collectDocScans(ctx: FinalizeContext): DocScan[] {
  const out: DocScan[] = [];
  for (const c of ctx.own) {
    const data = c.data;
    if (data && typeof data === "object" && "docNodeId" in data && "parsed" in data) {
      out.push(data as DocScan);
    }
  }
  return out;
}
