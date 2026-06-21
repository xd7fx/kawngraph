import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { atomicWriteFile, backupFile, removeEmptyParentDir, removeFileIfExists } from "../config/atomicWrite";
import {
  hasInlineMcpServer,
  hasTomlTable,
  removeTomlTable,
  renderMcpServerBlock,
  upsertTomlTable,
} from "../config/safeToml";
import { getIntegration } from "../integrations";
import { probeMcpServer } from "../mcpProbe";
import { KAWN_SERVER_NAME, LEGACY_SERVER_NAME } from "../types";
import type {
  AdapterContext,
  AgentAdapter,
  DetectResult,
  InstallPlan,
  InstallResult,
  McpLaunchSpec,
  PlannedFile,
  Scope,
  UninstallResult,
  VerifyResult,
} from "../types";

/**
 * Codex integration.
 *
 * Config format verified 2026-06-19 against
 * https://developers.openai.com/codex/mcp and the Codex config reference:
 * a project-scoped `.codex/config.toml` with a `[mcp_servers.<name>]` table
 * (`command`, `args`, optional `env`). Codex loads project MCP servers only for
 * TRUSTED projects, and the closest config (root → cwd) wins. KawnGraph edits only
 * its own table as a text block, preserving comments and unrelated tables; it
 * never modifies AGENTS.md.
 */
const REL_FILE = path.join(".codex", "config.toml");
const TABLE = `mcp_servers.${KAWN_SERVER_NAME}`;
/** Pre-rebrand table name; migrated to `${TABLE}` on setup/connect, removed on disconnect. */
const LEGACY_TABLE = `mcp_servers.${LEGACY_SERVER_NAME}`;
const OWNED_KEY = TABLE;
const DOC = {
  file: ".codex/config.toml",
  ownedKey: TABLE,
  docUrl: "https://developers.openai.com/codex/mcp",
  verifiedOn: "2026-06-19",
};

function desiredBlock(launch: McpLaunchSpec): string {
  return renderMcpServerBlock(KAWN_SERVER_NAME, {
    command: launch.command,
    args: launch.args,
    env: Object.keys(launch.env).length > 0 ? launch.env : undefined,
  });
}

async function readSource(abs: string): Promise<{ exists: boolean; source: string }> {
  try {
    return { exists: true, source: await fsp.readFile(abs, "utf8") };
  } catch {
    return { exists: false, source: "" };
  }
}

export const codexAdapter: AgentAdapter = {
  id: "codex",
  displayName: "Codex",
  configFormat: DOC,

  async detect(root: string, _scope: Scope): Promise<DetectResult> {
    const abs = path.join(root, REL_FILE);
    const evidence: string[] = [];
    let present = false;
    let installed = false;
    if (fs.existsSync(path.join(root, ".codex"))) {
      present = true;
      evidence.push(".codex");
    }
    if (fs.existsSync(path.join(root, "AGENTS.md"))) {
      present = true;
      evidence.push("AGENTS.md");
    }
    const { exists, source } = await readSource(abs);
    if (exists) {
      present = true;
      if (!evidence.includes(REL_FILE)) evidence.push(REL_FILE);
      installed = hasTomlTable(source, TABLE);
    }
    return { agent: "codex", present, installed, evidence };
  },

  async plan(ctx: AdapterContext): Promise<InstallPlan> {
    const abs = path.join(ctx.root, REL_FILE);
    const { exists, source } = await readSource(abs);
    const notes: string[] = [
      "Codex loads project MCP servers only for trusted projects — make sure this project is trusted in Codex.",
    ];

    if (hasInlineMcpServer(source, KAWN_SERVER_NAME)) {
      return {
        agent: "codex",
        scope: ctx.scope,
        files: [],
        alreadyInstalled: false,
        notes,
        blocked: `${DOC.file} defines "${KAWN_SERVER_NAME}" as an inline mcp_servers entry. KawnGraph manages the [${TABLE}] table form only — resolve the inline definition manually, then retry.`,
      };
    }

    const edit = upsertTomlTable(source, TABLE, desiredBlock(ctx.launch));
    const hasLegacy = hasTomlTable(source, LEGACY_TABLE);
    // Carry a pre-rebrand [mcp_servers.athar] table over to [mcp_servers.kawn] —
    // remove it in the same edit so the two never coexist.
    const nextSource = hasLegacy ? removeTomlTable(edit.source, LEGACY_TABLE).source : edit.source;
    const changed = nextSource !== source;
    const alreadyInstalled = !changed && hasTomlTable(source, TABLE);

    if (hasTomlTable(source, TABLE) && edit.changed) {
      const prior = await getIntegration(ctx.root, "codex", ctx.scope);
      if (!prior && !ctx.force) {
        return {
          agent: "codex",
          scope: ctx.scope,
          files: [],
          alreadyInstalled: false,
          notes,
          blocked: `${DOC.file} already defines [${TABLE}] that KawnGraph did not create. Re-run with --force to replace it.`,
        };
      }
      if (!prior && ctx.force) notes.push(`Replacing a pre-existing [${TABLE}] table (--force).`);
    }

    if (hasLegacy) notes.push(`Migrating a legacy [${LEGACY_TABLE}] table to [${TABLE}] in ${DOC.file}.`);
    if (hasInlineMcpServer(source, LEGACY_SERVER_NAME)) {
      notes.push(
        `${DOC.file} also defines a legacy inline "${LEGACY_SERVER_NAME}" mcp_servers entry — remove it manually; KawnGraph migrates the [table] form only.`,
      );
    }

    if (!ctx.launch.portable) {
      notes.push(
        `The generated command references a local KawnGraph install (${ctx.launch.source}); it is not portable across machines until @kawngraph/mcp is published to npm.`,
      );
    }

    const planned: PlannedFile = {
      absPath: abs,
      relPath: DOC.file,
      exists,
      action: alreadyInstalled ? "unchanged" : exists ? "update" : "create",
      ownedKey: OWNED_KEY,
      summary: alreadyInstalled
        ? `${DOC.file} already registers KawnGraph — no change`
        : hasLegacy
          ? `migrate [${LEGACY_TABLE}] → [${TABLE}] in ${DOC.file}`
          : exists
            ? `add [${TABLE}] to ${DOC.file}`
            : `create ${DOC.file} with [${TABLE}]`,
      preview: nextSource,
    };
    return { agent: "codex", scope: ctx.scope, files: [planned], alreadyInstalled, notes };
  },

  async install(ctx: AdapterContext): Promise<InstallResult> {
    const plan = await codexAdapter.plan(ctx);
    if (plan.blocked) throw new Error(plan.blocked);
    const abs = path.join(ctx.root, REL_FILE);
    const result: InstallResult = {
      agent: "codex",
      scope: ctx.scope,
      changed: false,
      written: [],
      backups: {},
      ownedKeys: [OWNED_KEY],
      notes: plan.notes,
    };
    if (plan.alreadyInstalled) return result;

    const backup = await backupFile(abs, ctx.root);
    if (backup) result.backups[DOC.file] = path.relative(ctx.root, backup);

    const { source } = await readSource(abs);
    const edit = upsertTomlTable(source, TABLE, desiredBlock(ctx.launch));
    const out = hasTomlTable(source, LEGACY_TABLE) ? removeTomlTable(edit.source, LEGACY_TABLE).source : edit.source;
    await atomicWriteFile(abs, out.endsWith("\n") ? out : out + "\n");
    result.changed = true;
    result.written.push(DOC.file);
    return result;
  },

  async uninstall(ctx: AdapterContext): Promise<UninstallResult> {
    const abs = path.join(ctx.root, REL_FILE);
    const result: UninstallResult = {
      agent: "codex",
      scope: ctx.scope,
      changed: false,
      touched: [],
      backups: {},
      notes: [],
    };
    const { exists, source } = await readSource(abs);
    if (!exists) {
      result.notes.push(`${DOC.file} not present — nothing to remove.`);
      return result;
    }
    const hasKawn = hasTomlTable(source, TABLE);
    const hasLegacy = hasTomlTable(source, LEGACY_TABLE);
    if (!hasKawn && !hasLegacy) {
      result.notes.push(`${DOC.file} has no [${TABLE}] — nothing to remove.`);
      return result;
    }

    const backup = await backupFile(abs, ctx.root);
    if (backup) result.backups[DOC.file] = path.relative(ctx.root, backup);

    // Remove our canonical table and any leftover pre-rebrand one in a single pass.
    let edited = source;
    if (hasKawn) edited = removeTomlTable(edited, TABLE).source;
    if (hasLegacy) edited = removeTomlTable(edited, LEGACY_TABLE).source;
    const removed = [...(hasKawn ? [TABLE] : []), ...(hasLegacy ? [LEGACY_TABLE] : [])]
      .map((t) => `[${t}]`)
      .join(" and ");
    const prior = await getIntegration(ctx.root, "codex", ctx.scope);
    const createdByUs = Boolean(prior) && !prior!.backups[DOC.file];

    if (edited.trim().length === 0 && createdByUs) {
      await removeFileIfExists(abs);
      await removeEmptyParentDir(abs, ctx.root);
      result.notes.push(`removed ${DOC.file} (created by KawnGraph, now empty).`);
    } else {
      const out = edited.trim().length === 0 ? "" : edited.endsWith("\n") ? edited : edited + "\n";
      await atomicWriteFile(abs, out);
      result.notes.push(`removed ${removed} from ${DOC.file}, preserved everything else.`);
    }
    result.changed = true;
    result.touched.push(DOC.file);
    return result;
  },

  async verify(ctx: AdapterContext): Promise<VerifyResult> {
    const probe = await probeMcpServer(ctx.launch, { smokeQuery: "verify kawn integration", cwd: ctx.root });
    return {
      agent: "codex",
      ok: probe.ok,
      detail: probe.ok
        ? `handshake ok · tools: ${probe.tools.join(", ")}${probe.contextOk ? " · kawn_context ok" : ""}`
        : probe.detail,
    };
  },
};
