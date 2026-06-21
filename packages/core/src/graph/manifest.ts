import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { KawnGraph, GRAPH_SCHEMA_VERSION, KAWN_VERSION } from "@kawngraph/shared";
import { kawnDir, graphPath, ensureKawnDir } from "./graphStore";
import { serializeGraph } from "./serializeGraph";

/**
 * A deterministic freshness record written next to `graph.json` on every scan.
 * It lets `kawn status`, `kawn doctor`, the MCP server, and Studio answer
 * "is this graph still trustworthy?" WITHOUT rebuilding anything — building stays
 * an explicit CLI operation.
 */
export interface GraphManifest {
  schemaVersion: number;
  kawnVersion: string;
  scannedAt: string;
  /** absolute, normalized scan root */
  root: string;
  /** stable hash of the normalized root path (project identity) */
  rootFingerprint: string;
  /** Git HEAD at scan time, when the root is inside a git repo; else null */
  gitHead: string | null;
  /** number of `file` nodes in the graph (a proxy for tracked files) */
  trackedFileCount: number;
  nodes: number;
  edges: number;
  /** sha256 of the canonical `graph.json` bytes this manifest describes */
  graphHash: string;
}

export type FreshnessStatus =
  | "fresh"
  | "possibly-stale"
  | "stale"
  | "missing"
  | "malformed"
  | "incompatible";

export interface FreshnessResult {
  status: FreshnessStatus;
  /** human-readable, safe to show to a user or an agent */
  detail: string;
  /** the one safe command that resolves the problem, when applicable */
  remediation?: string;
  manifest?: GraphManifest;
  /** present when git is available and we could compare HEADs */
  gitHead?: string | null;
  scannedAt?: string;
}

export function manifestPath(root: string): string {
  return path.join(kawnDir(root), "manifest.json");
}

export function computeGraphHash(serialized: string): string {
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

function fingerprintRoot(absRoot: string): string {
  // Normalize to posix-style for a stable identity across separators.
  const norm = absRoot.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return createHash("sha256").update(norm, "utf8").digest("hex").slice(0, 16);
}

/** Best-effort `git rev-parse HEAD` for `root`. Returns null when not a repo or git is absent. */
export function currentGitHead(root: string): string | null {
  try {
    const out = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 4000,
    });
    const head = out.trim();
    return head.length > 0 ? head : null;
  } catch {
    return null;
  }
}

/** Best-effort working-tree dirtiness check (tracked changes only). Null when git is unavailable. */
function gitWorkingTreeDirty(root: string): boolean | null {
  try {
    const out = execFileSync("git", ["-C", root, "status", "--porcelain", "--untracked-files=no"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 4000,
    });
    return out.trim().length > 0;
  } catch {
    return null;
  }
}

/** Assemble (but do not write) the manifest for a freshly built graph + its serialized bytes. */
export function buildManifest(absRoot: string, graph: KawnGraph, serialized: string): GraphManifest {
  const trackedFileCount = graph.nodes.reduce((n, node) => (node.type === "file" ? n + 1 : n), 0);
  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    kawnVersion: KAWN_VERSION,
    scannedAt: new Date().toISOString(),
    root: absRoot,
    rootFingerprint: fingerprintRoot(absRoot),
    gitHead: currentGitHead(absRoot),
    trackedFileCount,
    nodes: graph.stats.nodes,
    edges: graph.stats.edges,
    graphHash: computeGraphHash(serialized),
  };
}

export async function writeManifest(root: string, manifest: GraphManifest): Promise<string> {
  await ensureKawnDir(root);
  const target = manifestPath(root);
  await fs.writeFile(target, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return target;
}

export async function readManifest(root: string): Promise<GraphManifest | null> {
  try {
    const raw = await fs.readFile(manifestPath(root), "utf8");
    const parsed = JSON.parse(raw) as GraphManifest;
    if (typeof parsed?.schemaVersion !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function looksLikeGraph(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  return Array.isArray(g.nodes) && Array.isArray(g.edges);
}

/**
 * Classify how trustworthy the on-disk graph is, read-only. Never rebuilds.
 * Order of checks matters: missing < malformed < incompatible < drift < fresh.
 */
export async function graphFreshness(root: string): Promise<FreshnessResult> {
  const UPDATE = "kawn update";
  let raw: string;
  try {
    raw = await fs.readFile(graphPath(root), "utf8");
  } catch {
    return {
      status: "missing",
      detail: "No .kawn/graph.json found.",
      remediation: "kawn scan",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: "malformed",
      detail: "graph.json is not valid JSON.",
      remediation: UPDATE,
    };
  }
  if (!looksLikeGraph(parsed)) {
    return {
      status: "malformed",
      detail: "graph.json is missing a nodes/edges array.",
      remediation: UPDATE,
    };
  }

  const manifest = (await readManifest(root)) ?? undefined;
  if (!manifest) {
    return {
      status: "possibly-stale",
      detail: "Graph present but no freshness manifest — cannot verify it is current.",
      remediation: UPDATE,
    };
  }
  if (manifest.schemaVersion !== GRAPH_SCHEMA_VERSION) {
    return {
      status: "incompatible",
      detail: `Graph schema v${manifest.schemaVersion} != supported v${GRAPH_SCHEMA_VERSION}.`,
      remediation: UPDATE,
      manifest,
      scannedAt: manifest.scannedAt,
    };
  }

  // Was graph.json edited out-of-band since the scan that wrote this manifest?
  if (computeGraphHash(raw) !== manifest.graphHash) {
    return {
      status: "possibly-stale",
      detail: "graph.json changed since it was generated (edited outside `kawn scan`).",
      remediation: UPDATE,
      manifest,
      scannedAt: manifest.scannedAt,
    };
  }

  const head = currentGitHead(root);
  if (head && manifest.gitHead) {
    if (head !== manifest.gitHead) {
      return {
        status: "stale",
        detail: `Git HEAD moved since the scan (${manifest.gitHead.slice(0, 8)} -> ${head.slice(0, 8)}).`,
        remediation: UPDATE,
        manifest,
        gitHead: head,
        scannedAt: manifest.scannedAt,
      };
    }
    const dirty = gitWorkingTreeDirty(root);
    if (dirty) {
      return {
        status: "possibly-stale",
        detail: "Git HEAD matches the scan but the working tree has uncommitted changes.",
        remediation: UPDATE,
        manifest,
        gitHead: head,
        scannedAt: manifest.scannedAt,
      };
    }
    return {
      status: "fresh",
      detail: "Graph matches the current commit with a clean working tree.",
      manifest,
      gitHead: head,
      scannedAt: manifest.scannedAt,
    };
  }

  // No git signal available — we cannot prove freshness, so we do not claim it.
  return {
    status: "possibly-stale",
    detail: "Graph integrity verified, but no git signal to confirm it reflects the latest code.",
    remediation: UPDATE,
    manifest,
    gitHead: head,
    scannedAt: manifest.scannedAt,
  };
}

/** Convenience: serialize the graph, hash it, and write the manifest. Returns the manifest. */
export async function writeManifestForGraph(
  absRoot: string,
  graph: KawnGraph,
): Promise<GraphManifest> {
  const serialized = serializeGraph(graph);
  const manifest = buildManifest(absRoot, graph, serialized);
  await writeManifest(absRoot, manifest);
  return manifest;
}
