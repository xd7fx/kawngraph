/**
 * ScannerRegistry — deterministic orchestration of scanner plugins.
 *
 * Phases, all deterministic:
 *   1. detect   — each file is assigned to the FIRST plugin (in order) that claims it.
 *   2. scan     — plugins run in order; a plugin scanning later sees workspace
 *                 packages discovered by earlier plugins (mirrors the legacy
 *                 "packages first, then code" rule).
 *   3. finalize — plugins run in order with the COMPLETE node set, to resolve
 *                 cross-file edges (docs->code, package membership).
 *
 * Guarantees: deterministic plugin order (by `order` then id), failure isolation
 * (a throwing detect/scan/finalize becomes a diagnostic and never aborts the run),
 * bounded file sizes, no auto-loading (callers register every plugin explicitly),
 * and a read-only context (no filesystem, no network).
 */
import type { KawnNode, KawnEdge } from "@kawngraph/shared";
import { posixDirname, posixJoin } from "@kawngraph/shared";
import type { ScannerPlugin } from "./plugin";
import type { FinalizeContext, PluginDiagnostic, ScanContext, ScanContribution, ScanFile } from "./types";
import { diag } from "./diagnostics";
import { validateContribution, validatePlugin } from "./validation";

export interface RegistryOptions {
  /** files larger than this many bytes are skipped with a diagnostic (default 2 MiB) */
  maxFileBytes?: number;
  /** root label (display) */
  root?: string;
}

export interface FileInput {
  file: ScanFile;
  content: string;
}

export interface RegistryScanResult {
  /** every contribution (scan + finalize) in execution order */
  contributions: ScanContribution[];
  /** all nodes, in execution order (registry does not dedup across plugins) */
  nodes: KawnNode[];
  /** all edges, in execution order */
  edges: KawnEdge[];
  diagnostics: PluginDiagnostic[];
}

const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_ORDER = 100;

export class ScannerRegistry {
  private readonly plugins: ScannerPlugin[] = [];
  private readonly diagnostics: PluginDiagnostic[] = [];

  /**
   * Register a plugin. Invalid/incompatible plugins are rejected with a diagnostic
   * and NOT added (failure isolation). No third-party auto-loading: callers must
   * explicitly register every plugin.
   */
  register(plugin: ScannerPlugin): boolean {
    const v = validatePlugin(plugin);
    if (!v.ok) {
      this.diagnostics.push(...v.diagnostics);
      return false;
    }
    if (this.plugins.some((p) => p.id === plugin.id)) {
      this.diagnostics.push(
        diag("warn", `plugin ${plugin.id} already registered (ignored)`, { pluginId: plugin.id, code: "dup_plugin" }),
      );
      return false;
    }
    this.plugins.push(plugin);
    return true;
  }

  /** Plugins in deterministic execution order: by `order` then by id. */
  ordered(): ScannerPlugin[] {
    return [...this.plugins].sort(
      (a, b) => (a.order ?? DEFAULT_ORDER) - (b.order ?? DEFAULT_ORDER) || a.id.localeCompare(b.id),
    );
  }

  list(): ScannerPlugin[] {
    return [...this.plugins];
  }

  registryDiagnostics(): PluginDiagnostic[] {
    return [...this.diagnostics];
  }

  /** Run the full scan: detect -> scan (ordered) -> finalize (ordered). */
  async scan(inputs: FileInput[], opts: RegistryOptions = {}): Promise<RegistryScanResult> {
    const maxBytes = opts.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    const root = opts.root ?? ".";
    const diagnostics: PluginDiagnostic[] = [...this.diagnostics];
    const plugins = this.ordered();

    // 1) detect: assign each file to the first plugin (in order) that claims it.
    const assignment = new Map<string, FileInput[]>();
    const knownFiles = new Set<string>();
    const importTargets = new Set<string>(); // files owned by import-resolving plugins
    for (const input of inputs) {
      const { file } = input;
      knownFiles.add(file.relPath);
      if (file.size > maxBytes) {
        diagnostics.push(
          diag("warn", `skipped ${file.relPath} (${file.size} bytes > ${maxBytes})`, {
            sourcePath: file.relPath,
            code: "file_too_large",
          }),
        );
        continue;
      }
      let owner: ScannerPlugin | undefined;
      for (const p of plugins) {
        let claims = false;
        try {
          claims = p.detect(file);
        } catch (err) {
          diagnostics.push(
            diag("error", `detect threw in ${p.id}: ${(err as Error).message}`, {
              pluginId: p.id,
              sourcePath: file.relPath,
              code: "detect_threw",
            }),
          );
        }
        if (claims) {
          owner = p;
          break;
        }
      }
      if (!owner) continue;
      if (!assignment.has(owner.id)) assignment.set(owner.id, []);
      assignment.get(owner.id)!.push(input);
      if (owner.capabilities.resolvesImports) importTargets.add(file.relPath);
    }

    // shared accumulation
    const allNodes: KawnNode[] = [];
    const allEdges: KawnEdge[] = [];
    const contributions: ScanContribution[] = [];
    const ownByPlugin = new Map<string, ScanContribution[]>();
    const workspacePackages = new Set<string>(); // package node labels seen so far

    const makeScanContext = (): ScanContext => ({
      root,
      knownFiles,
      resolveLocalImport: (fromRel, specifier) => resolveLocalImport(fromRel, specifier, importTargets),
      matchWorkspacePackage: (specifier) => matchWorkspacePackage(specifier, workspacePackages),
    });

    // 2) scan phase, in plugin order
    for (const p of plugins) {
      const files = assignment.get(p.id) ?? [];
      const own: ScanContribution[] = [];
      for (const { file, content } of files) {
        let contrib: ScanContribution;
        try {
          contrib = await p.scan(file, content, makeScanContext());
        } catch (err) {
          diagnostics.push(
            diag("warn", `scan threw in ${p.id} for ${file.relPath}: ${(err as Error).message}`, {
              pluginId: p.id,
              sourcePath: file.relPath,
              code: "scan_threw",
            }),
          );
          continue;
        }
        const { contribution, diagnostics: vds } = validateContribution(contrib, p.id, p.capabilities);
        diagnostics.push(...vds);
        contributions.push(contribution);
        own.push(contribution);
        for (const n of contribution.nodes) {
          allNodes.push(n);
          if (n.type === "package") workspacePackages.add(n.label);
        }
        for (const e of contribution.edges) allEdges.push(e);
      }
      ownByPlugin.set(p.id, own);
    }

    // 3) finalize phase, in plugin order (cross-file edges against the full node set)
    for (const p of plugins) {
      if (typeof p.finalize !== "function") continue;
      const ctx: FinalizeContext = { root, allNodes, allEdges, own: ownByPlugin.get(p.id) ?? [] };
      let contrib: ScanContribution;
      try {
        contrib = await p.finalize(ctx);
      } catch (err) {
        diagnostics.push(
          diag("warn", `finalize threw in ${p.id}: ${(err as Error).message}`, {
            pluginId: p.id,
            code: "finalize_threw",
          }),
        );
        continue;
      }
      const { contribution, diagnostics: vds } = validateContribution(contrib, p.id, p.capabilities);
      diagnostics.push(...vds);
      contributions.push(contribution);
      for (const n of contribution.nodes) allNodes.push(n);
      for (const e of contribution.edges) allEdges.push(e);
    }

    return { contributions, nodes: allNodes, edges: allEdges, diagnostics };
  }
}

// --- import resolution (mirrors the legacy scanRepo rules exactly) ---

const CODE_EXTS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const INDEX_FILES = ["index.ts", "index.tsx", "index.js", "index.jsx"];

function resolveLocalImport(fromRel: string, specifier: string, fileSet: ReadonlySet<string>): string | null {
  if (!specifier.startsWith(".")) return null;
  const target = posixJoin(posixDirname(fromRel), specifier);
  for (const ext of CODE_EXTS) {
    if (fileSet.has(target + ext)) return target + ext;
  }
  for (const idx of INDEX_FILES) {
    const cand = posixJoin(target, idx);
    if (fileSet.has(cand)) return cand;
  }
  return null;
}

function matchWorkspacePackage(specifier: string, names: ReadonlySet<string>): string | null {
  for (const name of names) {
    if (specifier === name || specifier.startsWith(name + "/")) return name;
  }
  return null;
}
