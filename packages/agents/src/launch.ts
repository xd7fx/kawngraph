import * as fs from "node:fs";
import * as path from "node:path";
import { KAWN_VERSION } from "@kawngraph/shared";
import type { McpLaunchSpec } from "./types";

const MCP_PKG = "@kawngraph/mcp";

/**
 * Resolve how to launch the KawnGraph MCP server for an integration — portably.
 *
 * A published/user install MUST NOT depend on a global `kawn-mcp` binary being on
 * PATH (it frequently is not — e.g. on Windows when npm's global bin dir is not in
 * PATH), so the default is a portable `npx -y @kawngraph/mcp@<version>` launch that
 * needs nothing but Node. Only when KawnGraph runs from the monorepo source do we
 * launch the built server directly with `node packages/mcp/dist/index.js`.
 *
 * Resolution order:
 *   1. an explicit override (tests / advanced users).
 *   2. monorepo source build → `node <repo>/packages/mcp/dist/index.js` (contributors).
 *   3. published default → `npx -y @kawngraph/mcp@<version> --root <root>` (portable).
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

  const monorepoEntry = resolveMonorepoServerEntry();
  if (monorepoEntry) {
    return {
      command: "node",
      args: [monorepoEntry, "--root", root],
      env: {},
      source: "local-node",
      portable: false,
      serverEntry: monorepoEntry,
    };
  }

  return publishedNpxLaunch(root);
}

/**
 * The portable launch used for every published/user install: `npx` fetches and runs
 * `@kawngraph/mcp` on demand, so nothing has to be installed globally or be on PATH.
 * Pinned to this CLI's version so the server matches the client. Pass an
 * already-versioned `pkg` (e.g. `@kawngraph/mcp@0.1.2`) to override the pin.
 */
export function publishedNpxLaunch(root: string, pkg: string = MCP_PKG): McpLaunchSpec {
  // `@kawngraph/mcp` has a leading scope `@`; a version `@` only appears after index 0.
  const spec = pkg.includes("@", 1) ? pkg : `${pkg}@${KAWN_VERSION}`;
  return {
    command: "npx",
    args: ["-y", spec, "--root", root],
    env: {},
    source: "npx",
    portable: true,
  };
}

/**
 * The launch to USE for setup/doctor's own live verification handshake. We always
 * WRITE a portable `npx` command into the user's config, but to verify quickly (and
 * offline) we prefer the `@kawngraph/mcp` already installed in `node_modules` — it is
 * the exact code `npx` would fetch. Falls back to the written launch when no local
 * copy is resolvable (then the probe runs the npx command as written).
 */
export function resolveProbeLaunch(root: string, written: McpLaunchSpec): McpLaunchSpec {
  if (written.source === "local-node") return written; // monorepo: already a local node launch
  const entry = resolveInstalledServerEntry();
  if (entry) {
    return { command: "node", args: [entry, "--root", root], env: {}, source: "local-node", portable: written.portable, serverEntry: entry };
  }
  return written;
}

/** Resolve `@kawngraph/mcp`'s server entry from node_modules (a published/installed copy). */
function resolveInstalledServerEntry(): string | null {
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

/**
 * If KawnGraph is running from the monorepo checkout, return the absolute path to
 * the built MCP server (`packages/mcp/dist/index.js`). Returns null for any
 * published/installed copy (which lives under `node_modules` with no monorepo
 * root above it), so those fall back to the portable npx launch.
 */
function resolveMonorepoServerEntry(): string | null {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    try {
      const pkgPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { name?: string };
        if (pkg.name === "kawngraph-monorepo") {
          const entry = path.join(dir, "packages", "mcp", "dist", "index.js");
          return fs.existsSync(entry) ? entry : null;
        }
      }
    } catch {
      /* unreadable package.json — keep walking up */
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
