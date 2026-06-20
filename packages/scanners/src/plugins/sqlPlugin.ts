/**
 * Built-in SQL plugin. Wraps {@link scanSql}: extracts `CREATE TABLE` definitions
 * (`migration defines table`) and foreign-key `REFERENCES` relationships
 * (`table references table`). Pure per-file; no cross-file pass needed.
 */
import { defineScannerPlugin, type ScannerPlugin } from "@athar/scanner-sdk";
import { scanSql } from "../sql/scanSql";

const SQL_RE = /\.sql$/i;

export function sqlPlugin(): ScannerPlugin {
  return defineScannerPlugin({
    id: "builtin:sql",
    version: "1.0.0",
    apiVersion: "1",
    displayName: "SQL",
    languages: ["sql"],
    extensions: [".sql"],
    capabilities: {
      nodeTypes: ["migration", "table"],
      edgeTypes: ["defines", "references"],
      emitsEvidence: true,
    },
    order: 2,
    detect: (f) => SQL_RE.test(f.relPath),
    scan: (f, content) => {
      const r = scanSql(f.relPath, content);
      return { nodes: r.nodes, edges: r.edges };
    },
  });
}
