/**
 * Built-in package.json plugin. Emits one `package` node per manifest during the
 * scan phase, then derives the cross-cutting `belongs_to` (file/migration ->
 * package) and `depends_on` (package -> workspace package) edges in finalize,
 * once the full node set and the workspace package names are known.
 *
 * This mirrors the legacy `scanRepo` behaviour exactly: package nodes first (so
 * later plugins can resolve bare workspace imports), membership + dependency
 * edges last (so they see every file/migration node).
 */
import type { AtharEdge } from "@athar/shared";
import { edgeId, packageId, posixBasename } from "@athar/shared";
import { defineScannerPlugin, type ScannerPlugin, type FinalizeContext } from "@athar/scanner-sdk";
import { scanPackageJson } from "../config/scanPackageJson";

interface PackageInfo {
  id: string;
  name: string;
  dir: string;
  deps: string[];
}

export function packagePlugin(): ScannerPlugin {
  return defineScannerPlugin({
    id: "builtin:package",
    version: "1.0.0",
    apiVersion: "1",
    displayName: "package.json",
    languages: ["json"],
    extensions: [".json"],
    capabilities: {
      nodeTypes: ["package"],
      edgeTypes: ["belongs_to", "depends_on"],
      emitsEvidence: true,
      crossFile: true,
    },
    order: 0,
    detect: (f) => posixBasename(f.relPath) === "package.json",
    scan: (f, content) => {
      const r = scanPackageJson(f.relPath, content);
      return { nodes: r.nodes, edges: r.edges };
    },
    finalize: (ctx) => ({ nodes: [], edges: derivePackageEdges(ctx) }),
  });
}

/** Reconstruct the package list from the graph and derive membership + dep edges. */
function derivePackageEdges(ctx: FinalizeContext): AtharEdge[] {
  const packages: PackageInfo[] = ctx.allNodes
    .filter((n) => n.type === "package")
    .map((n) => {
      const meta = n.metadata ?? {};
      return {
        id: n.id,
        name: n.label,
        dir: typeof meta["dir"] === "string" ? (meta["dir"] as string) : ".",
        deps: Array.isArray(meta["dependencies"]) ? (meta["dependencies"] as string[]) : [],
      };
    });
  const workspaceNames = new Set(packages.map((p) => p.name));
  const edges: AtharEdge[] = [];

  const byDirDesc = [...packages].sort((a, b) => b.dir.length - a.dir.length);
  const nearest = (rel: string): PackageInfo | null => {
    for (const p of byDirDesc) {
      const matches = p.dir === "." ? true : rel === p.dir || rel.startsWith(p.dir + "/");
      if (matches) return p;
    }
    return null;
  };

  for (const node of ctx.allNodes) {
    if (node.type !== "file" && node.type !== "migration") continue;
    const pkg = nearest(node.sourcePath);
    if (!pkg) continue;
    edges.push({
      id: edgeId("belongs_to", node.id, pkg.id),
      from: node.id,
      to: pkg.id,
      type: "belongs_to",
      confidence: "linked",
      evidence: { sourcePath: node.sourcePath },
    });
  }

  for (const pkg of packages) {
    for (const dep of pkg.deps) {
      if (!workspaceNames.has(dep)) continue;
      const to = packageId(dep);
      edges.push({
        id: edgeId("depends_on", pkg.id, to),
        from: pkg.id,
        to,
        type: "depends_on",
        confidence: "extracted",
        evidence: { sourcePath: pkg.dir === "." ? "package.json" : `${pkg.dir}/package.json` },
      });
    }
  }

  return edges;
}
