import {
  AtharNode,
  AtharEdge,
  ScanResult,
  migrationId,
  tableId,
  edgeId,
  posixBasename,
} from "@athar/shared";

/** Normalize a SQL table identifier: strip quotes and a leading `public.` schema. */
function normalizeTable(raw: string): string {
  let name = raw.trim().replace(/"/g, "");
  if (name.toLowerCase().startsWith("public.")) name = name.slice("public.".length);
  return name;
}

function lineAt(content: string, index: number): number {
  let line = 1;
  const end = Math.min(index, content.length);
  for (let i = 0; i < end; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

/**
 * Minimal SQL scanner: extracts `CREATE TABLE` definitions and foreign-key
 * `REFERENCES` relationships. A foreign key is attributed to the most recent
 * `CREATE TABLE` / `ALTER TABLE` before it (its enclosing statement).
 */
export function scanSql(relPath: string, content: string): ScanResult {
  const nodes: AtharNode[] = [];
  const edges: AtharEdge[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  const mig = migrationId(relPath);
  nodes.push({ id: mig, type: "migration", layer: "data", label: posixBasename(relPath), sourcePath: relPath });

  const ensureTable = (raw: string, line: number): string => {
    const name = normalizeTable(raw);
    const id = tableId(name);
    if (!nodeIds.has(id)) {
      nodeIds.add(id);
      nodes.push({ id, type: "table", layer: "data", label: name, sourcePath: relPath, lineStart: line });
    }
    return id;
  };

  const addEdge = (edge: AtharEdge): void => {
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    edges.push(edge);
  };

  // Statement-context markers: track which table a foreign key belongs to.
  type Marker = { index: number; table: string };
  const markers: Marker[] = [];

  const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?("?[\w.]+"?)/gi;
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(content)) !== null) {
    const line = lineAt(content, m.index);
    const id = ensureTable(m[1], line);
    markers.push({ index: m.index, table: m[1] });
    addEdge({
      id: edgeId("defines", mig, id),
      from: mig,
      to: id,
      type: "defines",
      confidence: "extracted",
      evidence: { sourcePath: relPath, lineStart: line, snippet: m[0].trim() },
    });
  }

  const alterRe = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?("?[\w.]+"?)/gi;
  while ((m = alterRe.exec(content)) !== null) {
    markers.push({ index: m.index, table: m[1] });
    ensureTable(m[1], lineAt(content, m.index));
  }

  markers.sort((a, b) => a.index - b.index);
  const sourceTableAt = (index: number): string | null => {
    let found: string | null = null;
    for (const mk of markers) {
      if (mk.index < index) found = mk.table;
      else break;
    }
    return found;
  };

  const refRe = /references\s+("?[\w.]+"?)/gi;
  while ((m = refRe.exec(content)) !== null) {
    const line = lineAt(content, m.index);
    const targetId = ensureTable(m[1], line);
    const sourceRaw = sourceTableAt(m.index);
    if (!sourceRaw) continue;
    const sourceId = tableId(normalizeTable(sourceRaw));
    if (sourceId === targetId) continue;
    addEdge({
      id: edgeId("references", sourceId, targetId),
      from: sourceId,
      to: targetId,
      type: "references",
      confidence: "extracted",
      evidence: { sourcePath: relPath, lineStart: line, snippet: m[0].trim() },
    });
  }

  return { nodes, edges };
}
