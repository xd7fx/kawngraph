import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import type { McpLaunchSpec } from "./types";

/**
 * Resolve how to launch the KawnGraph MCP server for an integration — honestly.
 *
 * `@kawngraph/mcp` is not yet published to npm, so there is no portable `npx`
 * command we can write into a teammate's repo. We therefore resolve the server
 * that actually exists on THIS machine and record `source`/`portable` so setup
 * can warn that the generated config is machine-specific until publication.
 *
 * Resolution order:
 *   1. `kawn-mcp` on PATH (a global/linked install) — cleanest command.
 *   2. the `@kawngraph/mcp` bin resolved from node_modules — `node <abs path>`.
 *   3. fall back to a bare `kawn-mcp` command (honest about being unresolved).
 */
export function resolveMcpLaunch(root: string, override?: Partial<McpLaunchSpec>): McpLaunchSpec {
  if (override?.command) {
    return {
      command: override.command,
      args: override.args ?? ["--root", root],
      env: override.env ?? {},
      source: override.source ?? "local-node",
      portable: override.portable ?? false,
      serverEntry: override.serverEntry,
    };
  }

  const globalBin = findOnPath("kawn-mcp");
  if (globalBin) {
    return {
      command: "kawn-mcp",
      args: ["--root", root],
      env: {},
      source: "global-bin",
      portable: false,
      serverEntry: globalBin,
    };
  }

  const entry = resolveLocalServerEntry();
  if (entry) {
    return {
      command: "node",
      args: [entry, "--root", root],
      env: {},
      source: "local-node",
      portable: false,
      serverEntry: entry,
    };
  }

  return { command: "kawn-mcp", args: ["--root", root], env: {}, source: "global-bin", portable: false };
}

/**
 * The portable command KawnGraph will write ONCE `@kawngraph/mcp` is published to npm.
 * Kept here so the future migration is a one-line switch and the intent is
 * documented; not used while the package is unpublished.
 */
export function publishedNpxLaunch(root: string, pkg = "@kawngraph/mcp"): McpLaunchSpec {
  return {
    command: "npx",
    args: ["-y", pkg, "--root", root],
    env: {},
    source: "npx",
    portable: true,
  };
}

function findOnPath(name: string): string | null {
  const finder = process.platform === "win32" ? "where" : "which";
  try {
    const out = execFileSync(finder, [name], {
      encoding: "utf8",
      timeout: 4000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const first = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s.length > 0);
    return first ?? null;
  } catch {
    return null;
  }
}

function resolveLocalServerEntry(): string | null {
  try {
    const pkgJsonPath = require.resolve("@kawngraph/mcp/package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")) as { bin?: Record<string, string> | string };
    const dir = path.dirname(pkgJsonPath);
    let binRel: string | undefined;
    if (typeof pkg.bin === "string") binRel = pkg.bin;
    else if (pkg.bin && typeof pkg.bin === "object") binRel = pkg.bin["kawn-mcp"] ?? Object.values(pkg.bin)[0];
    if (!binRel) return null;
    const abs = path.join(dir, binRel);
    return fs.existsSync(abs) ? abs : null;
  } catch {
    return null;
  }
}
