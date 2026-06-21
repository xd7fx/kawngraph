import { KawnGraph, KawnNode, ContextRisk } from "@kawngraph/shared";
import { ChangeSet, ChangedFile, ChangeStatus } from "../git/changedFiles";
import { reverseReachable, ReachNode } from "./reachable";
import { scoreRisks } from "./riskScore";

/** One changed file, resolved against the graph from the last scan. */
export interface ChangedFileImpact {
  /** root-relative POSIX path (the NEW path for renames/copies). */
  path: string;
  status: ChangeStatus;
  /** previous path, only for renames/copies. */
  oldPath?: string;
  /** true when the file maps to at least one node in the current graph. */
  inGraph: boolean;
  /** the file node, when the graph has one for this path. */
  fileNode?: KawnNode;
  /** functions/classes/routes/etc. defined in this file, sorted by id. */
  symbols: KawnNode[];
}

export interface ChangeImpactOptions {
  /** Max hops from the changed nodes (default 6). */
  maxDepth?: number;
  /** Cap on impacted nodes — keeps the blast radius bounded (default 500). */
  maxNodes?: number;
}

/**
 * The blast radius of a change set: which graph nodes the changed files map to,
 * everything that depends on them (bounded), and the docs/tables/tests connected
 * to that scope — every relationship grounded in an existing graph edge.
 */
export interface ChangeImpact {
  /** Human-readable description of what was compared (from the change set). */
  label: string;
  /** The diff range in PR mode, or null in working-tree mode. */
  range: string | null;
  /** Every changed file, resolved against the graph, sorted by path. */
  files: ChangedFileImpact[];
  /** Changed paths that map to no node in the graph (rescan to include). */
  unmappedFiles: string[];
  /** The graph nodes the changed files map to (the seeds), sorted by id. */
  changedNodes: KawnNode[];
  /** Everything that depends on the changed nodes, nearest-first. */
  impacted: ReachNode[];
  /** true when the impact was cut off at `maxNodes` (more dependents exist). */
  impactTruncated: boolean;
  /** Downstream source files to re-check (impacted paths minus changed paths). */
  filesToRecheck: string[];
  /** Docs connected to the changed/impacted scope, sorted by id. */
  relatedDocs: KawnNode[];
  /** Tables connected to the changed/impacted scope, sorted by id. */
  relatedTables: KawnNode[];
  /** Tests connected to the changed/impacted scope, sorted by id. */
  relatedTests: KawnNode[];
  /** Evidence-backed risk flags over the full scope (changed + impacted). */
  risks: ContextRisk[];
}

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_NODES = 500;

interface PathHit {
  fileNode?: KawnNode;
  symbols: KawnNode[];
}

/**
 * Map a {@link ChangeSet} onto the current graph and compute its impact. Pure
 * and deterministic: identical inputs yield an identical result. Nothing is
 * invented — changed files map to nodes by `sourcePath`, dependents come from
 * existing dependency edges, and related docs/tables/tests are the graph
 * neighbours of the changed scope.
 */
export function analyzeChangeImpact(
  graph: KawnGraph,
  changeSet: ChangeSet,
  opts: ChangeImpactOptions = {},
): ChangeImpact {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxNodes = opts.maxNodes ?? DEFAULT_MAX_NODES;

  const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));
  const byPath = new Map<string, KawnNode[]>();
  for (const n of graph.nodes) {
    const arr = byPath.get(n.sourcePath) ?? [];
    arr.push(n);
    byPath.set(n.sourcePath, arr);
  }

  const lookup = (p: string): PathHit => {
    const all = byPath.get(p) ?? [];
    return {
      fileNode: all.find((n) => n.type === "file"),
      symbols: all.filter((n) => n.type !== "file"),
    };
  };

  // Resolve each changed file to graph nodes. Renames/copies are resolved by the
  // OLD path when the new path has no nodes yet — the graph predates the rename,
  // so dependents still point at the old file's nodes.
  const sortedFiles = [...changeSet.files].sort((a, b) => a.path.localeCompare(b.path));
  const files: ChangedFileImpact[] = [];
  const unmappedFiles: string[] = [];
  const seedIds = new Set<string>();
  const changedPaths = new Set<string>();

  for (const f of sortedFiles) {
    changedPaths.add(f.path);
    let hit = lookup(f.path);
    if (!hit.fileNode && hit.symbols.length === 0 && f.oldPath) hit = lookup(f.oldPath);

    const symbols = [...hit.symbols].sort((a, b) => a.id.localeCompare(b.id));
    const inGraph = hit.fileNode !== undefined || symbols.length > 0;
    if (!inGraph) unmappedFiles.push(f.path);

    if (hit.fileNode) seedIds.add(hit.fileNode.id);
    for (const s of symbols) seedIds.add(s.id);

    files.push(buildFileImpact(f, inGraph, hit.fileNode, symbols));
  }

  const changedNodes = [...seedIds]
    .map((id) => byId.get(id))
    .filter((n): n is KawnNode => n !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id));

  // Reverse reachability: who depends on the changed nodes (bounded, ordered).
  const reach = reverseReachable(graph, seedIds, { maxDepth, maxNodes });

  // Full scope = changed + impacted. Used for boundary neighbours and risks.
  const scopeIds = new Set<string>(seedIds);
  for (const r of reach.nodes) scopeIds.add(r.node.id);

  // Downstream files to re-check: impacted source files minus the ones you
  // already changed (those you know about).
  const recheck = new Set<string>();
  for (const r of reach.nodes) {
    if (!changedPaths.has(r.node.sourcePath)) recheck.add(r.node.sourcePath);
  }
  const filesToRecheck = [...recheck].sort();

  // Boundary neighbours: nodes just outside the scope connected to it by a real
  // edge. Categorised by node type, so only docs/tables/tests surface here.
  const docs = new Map<string, KawnNode>();
  const tables = new Map<string, KawnNode>();
  const tests = new Map<string, KawnNode>();
  for (const e of graph.edges) {
    const fromIn = scopeIds.has(e.from);
    const toIn = scopeIds.has(e.to);
    if (fromIn === toIn) continue; // internal edge or wholly outside — not a boundary
    const otherId = fromIn ? e.to : e.from;
    const other = byId.get(otherId);
    if (!other) continue;
    if (other.type === "doc" || other.type === "section") docs.set(other.id, other);
    else if (other.type === "table" || other.type === "migration") tables.set(other.id, other);
    else if (other.type === "test") tests.set(other.id, other);
  }

  const risks = scoreRisks(graph, scopeIds);

  return {
    label: changeSet.label,
    range: changeSet.range,
    files,
    unmappedFiles: unmappedFiles.sort(),
    changedNodes,
    impacted: reach.nodes,
    impactTruncated: reach.truncated,
    filesToRecheck,
    relatedDocs: byIdSorted(docs),
    relatedTables: byIdSorted(tables),
    relatedTests: byIdSorted(tests),
    risks,
  };
}

function buildFileImpact(
  f: ChangedFile,
  inGraph: boolean,
  fileNode: KawnNode | undefined,
  symbols: KawnNode[],
): ChangedFileImpact {
  const out: ChangedFileImpact = { path: f.path, status: f.status, inGraph, symbols };
  if (f.oldPath !== undefined) out.oldPath = f.oldPath;
  if (fileNode !== undefined) out.fileNode = fileNode;
  return out;
}

function byIdSorted(map: Map<string, KawnNode>): KawnNode[] {
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}
