import { KawnNode, ScanResult, packageId, posixDirname } from "@kawngraph/shared";

/**
 * Parse a package.json into a `package` node. Internal `depends_on` edges and
 * file `belongs_to` edges are derived later by the core builder, which knows the
 * full set of workspace packages.
 */
export function scanPackageJson(relPath: string, content: string): ScanResult {
  let pkg: unknown;
  try {
    pkg = JSON.parse(content);
  } catch {
    return { nodes: [], edges: [] };
  }
  if (typeof pkg !== "object" || pkg === null) return { nodes: [], edges: [] };

  const record = pkg as Record<string, unknown>;
  const name = record["name"];
  if (typeof name !== "string" || name.length === 0) return { nodes: [], edges: [] };

  const deps = {
    ...(asRecord(record["dependencies"])),
    ...(asRecord(record["devDependencies"])),
    ...(asRecord(record["peerDependencies"])),
  };

  const node: KawnNode = {
    id: packageId(name),
    type: "package",
    layer: "config",
    label: name,
    sourcePath: relPath,
    metadata: {
      version: typeof record["version"] === "string" ? record["version"] : undefined,
      dir: posixDirname(relPath),
      dependencies: Object.keys(deps),
    },
  };

  return { nodes: [node], edges: [] };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
