import { KawnGraph, KawnNode, ContextRisk, RiskLevel } from "@kawngraph/shared";

/**
 * Heuristic, evidence-backed risk flags for the nodes a Context Pack includes.
 * No LLM — just signal patterns that should make an agent slow down:
 * auth/token surfaces, data writes, and tenant-isolation (Zid: `store_id`).
 *
 * Flags are *aggregated by kind* (one auth flag listing the surfaces, not one
 * per file) so the list stays high-signal. These are hints, not guarantees.
 */

const AUTH_RE = /(auth|oauth|token|secret|password|credential|session|login|jwt|api[_-]?key)/i;
const WRITE_RE = /(save|insert|update|delete|persist|upsert|write|create|mutat)/i;
const TENANT_RE = /(store[_-]?id|tenant|merchant|account[_-]?id|org[_-]?id)/i;

const LEVEL_RANK: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

/** "a, b, c (+2 more)" from a node list, used to name the surfaces behind a flag. */
function names(nodes: KawnNode[], max = 3): string {
  const labels = nodes.map((n) => n.label);
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} (+${labels.length - max} more)`;
}

export function scoreRisks(graph: KawnGraph, nodeIds: Set<string>): ContextRisk[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));
  // Only code/data nodes carry code-risk signals — a doc that *describes* OAuth
  // is not itself an auth surface.
  const codeish: KawnNode[] = [];
  for (const id of nodeIds) {
    const n = byId.get(id);
    if (n && (n.layer === "code" || n.layer === "data")) codeish.push(n);
  }

  const risks: ContextRisk[] = [];

  const authNodes = codeish.filter((n) => AUTH_RE.test(`${n.label} ${n.sourcePath}`));
  if (authNodes.length > 0) {
    risks.push({
      level: "high",
      kind: "auth",
      message: `Auth/token surface in scope — verify scopes, token storage, and expiry: ${names(authNodes)}`,
      nodeId: authNodes[0].id,
      evidence: { sourcePath: authNodes[0].sourcePath, lineStart: authNodes[0].lineStart },
    });
  }

  const tenantNodes = codeish.filter((n) => TENANT_RE.test(`${n.label} ${n.sourcePath}`));
  if (tenantNodes.length > 0) {
    risks.push({
      level: "high",
      kind: "tenant-isolation",
      message: `Tenant-scoped (store/merchant) — preserve isolation across stores: ${names(tenantNodes)}`,
      nodeId: tenantNodes[0].id,
      evidence: { sourcePath: tenantNodes[0].sourcePath, lineStart: tenantNodes[0].lineStart },
    });
  }

  const writeNodes = codeish.filter((n) => (n.type === "function" || n.type === "route") && WRITE_RE.test(n.label));
  if (writeNodes.length > 0) {
    risks.push({
      level: "medium",
      kind: "data-write",
      message: `Persists data — writes here can corrupt state: ${names(writeNodes)}`,
      nodeId: writeNodes[0].id,
      evidence: { sourcePath: writeNodes[0].sourcePath, lineStart: writeNodes[0].lineStart },
    });
  }

  // Foreign keys among included tables: writes must keep referential integrity.
  for (const e of graph.edges) {
    if (e.type !== "references") continue;
    if (!e.from.startsWith("table:") || !e.to.startsWith("table:")) continue;
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    risks.push({
      level: "medium",
      kind: "referential-integrity",
      message: `\`${from?.label}\` references \`${to?.label}\` — keep the foreign key consistent on writes`,
      nodeId: e.from,
      evidence: e.evidence,
    });
  }

  if (codeish.some((n) => n.type === "table" || n.type === "migration")) {
    risks.push({
      level: "medium",
      kind: "schema",
      message: "The data layer is in scope — schema or migration changes need a backfill/rollout plan",
    });
  }

  return risks.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
}
