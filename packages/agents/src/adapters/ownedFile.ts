import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { atomicWriteFile, backupFile, removeEmptyParentDir, removeFileIfExists } from "../config/atomicWrite";
import { getIntegration } from "../integrations";
import type {
  AdapterContext,
  AgentAdapter,
  AgentCapabilities,
  AgentId,
  AgentKind,
  ConfigFormatInfo,
  DetectResult,
  InstallPlan,
  InstallResult,
  PlannedFile,
  Scope,
  UninstallResult,
  VerifyResult,
} from "../types";

/**
 * Shared implementation for adapters whose integration is one or more
 * KawnGraph-OWNED files (not a merge into someone else's config). Used by the
 * `aider` (context file the agent `--read`s), `generic` (Markdown/JSON prompt
 * export), and `local` (local-LLM endpoint config) adapters.
 *
 * These files live under the project (typically `.kawn/`), so there is no foreign
 * config to preserve. Writes are atomic; if a file unexpectedly pre-exists with
 * different content it is backed up first and restored on uninstall — otherwise
 * uninstall simply removes the KawnGraph file (and prunes an empty parent dir).
 */
export interface OwnedFile {
  /** path relative to the project root */
  relFile: string;
  /** the exact bytes KawnGraph will write (may read the graph, hence async) */
  build(ctx: AdapterContext): Promise<string> | string;
}

export interface OwnedFileSpec {
  agent: AgentId;
  displayName: string;
  kind: AgentKind;
  supports: AgentCapabilities;
  autoSelectable: boolean;
  configFormat: ConfigFormatInfo;
  ownedKey: string;
  files: OwnedFile[];
  /** extra "this agent is used here" detection signals (relative paths) */
  presentSignals?: string[];
  /** refuse to proceed (e.g. `local` with no --provider); returns a reason or undefined */
  blockedReason?(ctx: AdapterContext): string | undefined;
  /** post-install guidance (e.g. the `aider --read …` command) */
  usage?(ctx: AdapterContext): string[];
}

async function builtFiles(ctx: AdapterContext, spec: OwnedFileSpec): Promise<{ rel: string; abs: string; content: string }[]> {
  const out: { rel: string; abs: string; content: string }[] = [];
  for (const f of spec.files) {
    out.push({ rel: f.relFile, abs: path.join(ctx.root, f.relFile), content: await f.build(ctx) });
  }
  return out;
}

export function makeOwnedFileAdapter(spec: OwnedFileSpec): AgentAdapter {
  return {
    id: spec.agent,
    displayName: spec.displayName,
    kind: spec.kind,
    supports: spec.supports,
    autoSelectable: spec.autoSelectable,
    configFormat: spec.configFormat,

    async detect(root: string, _scope: Scope): Promise<DetectResult> {
      const evidence: string[] = [];
      const installed = spec.files.every((f) => fs.existsSync(path.join(root, f.relFile)));
      for (const f of spec.files) if (fs.existsSync(path.join(root, f.relFile))) evidence.push(f.relFile);
      let present = installed;
      for (const sig of spec.presentSignals ?? []) {
        if (fs.existsSync(path.join(root, sig))) {
          present = true;
          if (!evidence.includes(sig)) evidence.push(sig);
        }
      }
      return { agent: spec.agent, present, installed, evidence };
    },

    async plan(ctx: AdapterContext): Promise<InstallPlan> {
      const blocked = spec.blockedReason?.(ctx);
      if (blocked) {
        return { agent: spec.agent, scope: ctx.scope, files: [], alreadyInstalled: false, notes: [], blocked };
      }
      const built = await builtFiles(ctx, spec);
      const files: PlannedFile[] = [];
      let allUnchanged = true;
      for (const b of built) {
        const exists = fs.existsSync(b.abs);
        const curr00 = exists ? await fsp.readFile(b.abs, "utf8") : null;
        const unchanged = curr00 === b.content;
        if (!unchanged) allUnchanged = false;
        files.push({
          absPath: b.abs,
          relPath: b.rel,
          exists,
          action: unchanged ? "unchanged" : exists ? "update" : "create",
          ownedKey: spec.ownedKey,
          summary: unchanged ? `${b.rel} already up to date — no change` : exists ? `update ${b.rel}` : `create ${b.rel}`,
          preview: b.content,
        });
      }
      return {
        agent: spec.agent,
        scope: ctx.scope,
        files,
        alreadyInstalled: allUnchanged && built.length > 0,
        notes: spec.usage?.(ctx) ?? [],
      };
    },

    async install(ctx: AdapterContext): Promise<InstallResult> {
      const plan = await this.plan(ctx);
      if (plan.blocked) throw new Error(plan.blocked);
      const result: InstallResult = {
        agent: spec.agent,
        scope: ctx.scope,
        changed: false,
        written: [],
        backups: {},
        ownedKeys: [spec.ownedKey],
        notes: plan.notes,
      };
      const built = await builtFiles(ctx, spec);
      for (const b of built) {
        const exists = fs.existsSync(b.abs);
        if (exists && (await fsp.readFile(b.abs, "utf8")) === b.content) continue; // already current
        if (exists) {
          const backup = await backupFile(b.abs, ctx.root);
          if (backup) result.backups[b.rel] = path.relative(ctx.root, backup);
        }
        await atomicWriteFile(b.abs, b.content);
        result.changed = true;
        result.written.push(b.rel);
      }
      return result;
    },

    async verify(ctx: AdapterContext): Promise<VerifyResult> {
      const missing: string[] = [];
      for (const f of spec.files) {
        const abs = path.join(ctx.root, f.relFile);
        if (!fs.existsSync(abs) || (await fsp.readFile(abs, "utf8")).trim().length === 0) missing.push(f.relFile);
      }
      return {
        agent: spec.agent,
        ok: missing.length === 0,
        detail: missing.length === 0 ? `wrote ${spec.files.map((f) => f.relFile).join(", ")}` : `missing/empty: ${missing.join(", ")}`,
      };
    },

    async uninstall(ctx: AdapterContext): Promise<UninstallResult> {
      const result: UninstallResult = { agent: spec.agent, scope: ctx.scope, changed: false, touched: [], backups: {}, notes: [] };
      const prior = await getIntegration(ctx.root, spec.agent, ctx.scope);
      for (const f of spec.files) {
        const abs = path.join(ctx.root, f.relFile);
        if (!fs.existsSync(abs)) continue;
        const backupRel = prior?.backups[f.relFile];
        if (backupRel) {
          // The file pre-existed our install — restore it byte-for-byte.
          const backupAbs = path.join(ctx.root, backupRel);
          if (fs.existsSync(backupAbs)) {
            await atomicWriteFile(abs, await fsp.readFile(backupAbs, "utf8"));
            result.notes.push(`restored ${f.relFile} from backup.`);
          } else {
            await removeFileIfExists(abs);
            result.notes.push(`removed ${f.relFile} (backup missing).`);
          }
        } else {
          await removeFileIfExists(abs);
          await removeEmptyParentDir(abs, ctx.root);
          result.notes.push(`removed ${f.relFile} (created by KawnGraph).`);
        }
        result.changed = true;
        result.touched.push(f.relFile);
      }
      if (!result.changed) result.notes.push(`nothing to remove for ${spec.displayName}.`);
      return result;
    },
  };
}
