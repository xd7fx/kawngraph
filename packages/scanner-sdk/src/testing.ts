/**
 * Plugin test harness. Lets a plugin author drive a plugin over in-memory files
 * and assert determinism without touching the filesystem.
 */
import type { ScannerPlugin } from "./plugin";
import { ScannerRegistry, type FileInput, type RegistryOptions, type RegistryScanResult } from "./registry";
import type { ScanFile } from "./types";

/** Build a ScanFile from a path + content (computes ext + byte size). */
export function makeScanFile(relPath: string, content: string): ScanFile {
  const base = relPath.slice(relPath.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot).toLowerCase() : "";
  return { relPath, ext, size: Buffer.byteLength(content, "utf8") };
}

/** Turn a {path: content} map into registry inputs. */
export function toInputs(files: Record<string, string>): FileInput[] {
  return Object.entries(files).map(([p, c]) => ({ file: makeScanFile(p, c), content: c }));
}

/**
 * Run one or more plugins over an in-memory file map and return the merged result.
 * Convenience for plugin unit tests; uses a private registry.
 */
export async function runPlugins(
  plugins: ScannerPlugin | ScannerPlugin[],
  files: Record<string, string>,
  opts?: RegistryOptions,
): Promise<RegistryScanResult> {
  const reg = new ScannerRegistry();
  for (const p of Array.isArray(plugins) ? plugins : [plugins]) reg.register(p);
  return reg.scan(toInputs(files), opts);
}

/** A stable fingerprint of a scan result: sorted node and edge ids. */
export function fingerprint(r: RegistryScanResult): { nodes: string[]; edges: string[] } {
  return {
    nodes: r.nodes.map((n) => n.id).sort(),
    edges: r.edges.map((e) => e.id).sort(),
  };
}

/** True when a plugin produces identical output across two independent runs. */
export async function isDeterministic(
  plugins: ScannerPlugin | ScannerPlugin[],
  files: Record<string, string>,
): Promise<boolean> {
  const a = fingerprint(await runPlugins(plugins, files));
  const b = fingerprint(await runPlugins(plugins, files));
  return JSON.stringify(a) === JSON.stringify(b);
}
