import * as fs from "node:fs/promises";
import * as path from "node:path";
import { KAWN_VERSION } from "@kawngraph/shared";
import { atomicWriteFile } from "./config/atomicWrite";
import { formatJson } from "./config/safeJson";
import type { AgentId, Scope } from "./types";

/**
 * KawnGraph's bookkeeping of what it installed, written to `.kawn/integrations.json`.
 * It records exactly which files were touched, which keys/tables KawnGraph owns, and
 * the backups captured at install time — so `disconnect` removes ONLY KawnGraph's
 * entries and every change stays reversible. This file is local state (`.kawn/`
 * is gitignored); `disconnect` also works without it by recognizing KawnGraph-owned
 * entries by name, so losing it never strands a user.
 */
export const INTEGRATION_SCHEMA_VERSION = 1;

export interface IntegrationRecord {
  agent: AgentId;
  scope: Scope;
  installedAt: string;
  kawnVersion: string;
  /** files KawnGraph created or modified, relative to root */
  files: string[];
  /** keys/tables KawnGraph owns within those files (e.g. `mcpServers.kawn`) */
  ownedKeys: string[];
  /** backups captured at install, keyed by the relative original path; absent key ⇒ file created by KawnGraph */
  backups: Record<string, string>;
  /** the launch command written, for doctor/troubleshooting transparency */
  launch: { command: string; args: string[]; source: string; portable: boolean };
}

export interface IntegrationManifest {
  schemaVersion: number;
  kawnVersion: string;
  updatedAt: string;
  integrations: IntegrationRecord[];
}

export function integrationManifestPath(root: string): string {
  return path.join(root, ".kawn", "integrations.json");
}

function empty(): IntegrationManifest {
  return {
    schemaVersion: INTEGRATION_SCHEMA_VERSION,
    kawnVersion: KAWN_VERSION,
    updatedAt: new Date().toISOString(),
    integrations: [],
  };
}

export async function readIntegrations(root: string): Promise<IntegrationManifest> {
  try {
    const raw = await fs.readFile(integrationManifestPath(root), "utf8");
    const parsed = JSON.parse(raw) as IntegrationManifest;
    if (typeof parsed?.schemaVersion === "number" && Array.isArray(parsed.integrations)) return parsed;
  } catch {
    /* fall through to empty */
  }
  return empty();
}

export async function writeIntegrations(root: string, manifest: IntegrationManifest): Promise<string> {
  const target = integrationManifestPath(root);
  const next: IntegrationManifest = {
    schemaVersion: INTEGRATION_SCHEMA_VERSION,
    kawnVersion: KAWN_VERSION,
    updatedAt: new Date().toISOString(),
    integrations: manifest.integrations,
  };
  await atomicWriteFile(target, formatJson(next));
  return target;
}

export async function getIntegration(root: string, agent: AgentId, scope: Scope): Promise<IntegrationRecord | null> {
  const m = await readIntegrations(root);
  return m.integrations.find((r) => r.agent === agent && r.scope === scope) ?? null;
}

export async function upsertIntegration(root: string, record: IntegrationRecord): Promise<void> {
  const m = await readIntegrations(root);
  m.integrations = m.integrations.filter((r) => !(r.agent === record.agent && r.scope === record.scope));
  m.integrations.push(record);
  await writeIntegrations(root, m);
}

export async function removeIntegrationRecord(
  root: string,
  agent: AgentId,
  scope: Scope,
): Promise<IntegrationRecord | null> {
  const m = await readIntegrations(root);
  const found = m.integrations.find((r) => r.agent === agent && r.scope === scope) ?? null;
  m.integrations = m.integrations.filter((r) => !(r.agent === agent && r.scope === scope));
  await writeIntegrations(root, m);
  return found;
}
