import type { UniversalContextPack } from "./schema";
import { isProtocolCompatible } from "./version";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const MODES = new Set(["code", "docs", "all"]);
const SECTION_ROLES = new Set(["primary", "supporting", "data", "verification"]);
const RISK_LEVELS = new Set(["low", "medium", "high"]);

/**
 * Structurally validate an untrusted value as a {@link UniversalContextPack}.
 * This is what a consumer runs before trusting a pack it received: it checks the
 * protocol is major-compatible and that every promised field is present and well
 * typed — in particular that each item carries the four guarantees the protocol
 * is built around (why / layer / evidence / rank). Errors are collected (not
 * thrown) so a caller can report all problems at once.
 */
export function validateUniversalPack(value: unknown): ValidationResult {
  const errors: string[] = [];
  const add = (m: string): void => void errors.push(m);

  if (!isObject(value)) {
    return { ok: false, errors: ["pack is not an object"] };
  }
  const p = value as Record<string, unknown>;

  if (typeof p["protocolVersion"] !== "string") add("protocolVersion: expected string");
  else if (!isProtocolCompatible(p["protocolVersion"])) add(`protocolVersion: incompatible (${p["protocolVersion"]})`);

  if (typeof p["task"] !== "string") add("task: expected string");
  if (typeof p["mode"] !== "string" || !MODES.has(p["mode"] as string)) add("mode: expected code|docs|all");
  if (!isFiniteNumber(p["confidence"]) || (p["confidence"] as number) < 0 || (p["confidence"] as number) > 1)
    add("confidence: expected number in [0,1]");

  validateBudget(p["budget"], add);
  validateProvenance(p["provenance"], add);
  if (!isObject(p["capabilities"])) add("capabilities: expected object");

  if (!Array.isArray(p["sections"])) add("sections: expected array");
  else p["sections"].forEach((s, i) => validateSection(s, i, add));

  if (!Array.isArray(p["risks"])) add("risks: expected array");
  else p["risks"].forEach((r, i) => validateRisk(r, i, add));

  if (!Array.isArray(p["excluded"])) add("excluded: expected array");
  else
    p["excluded"].forEach((e, i) => {
      if (!isObject(e)) return add(`excluded[${i}]: expected object`);
      const x = e as Record<string, unknown>;
      if (typeof x["id"] !== "string") add(`excluded[${i}].id: expected string`);
      if (typeof x["label"] !== "string") add(`excluded[${i}].label: expected string`);
      if (typeof x["reason"] !== "string") add(`excluded[${i}].reason: expected string`);
    });

  return { ok: errors.length === 0, errors };
}

/** Validate and narrow, or throw with all problems joined. */
export function assertUniversalPack(value: unknown): UniversalContextPack {
  const { ok, errors } = validateUniversalPack(value);
  if (!ok) throw new Error(`invalid UniversalContextPack:\n  - ${errors.join("\n  - ")}`);
  return value as UniversalContextPack;
}

function validateBudget(b: unknown, add: (m: string) => void): void {
  if (!isObject(b)) return add("budget: expected object");
  const x = b as Record<string, unknown>;
  if (!isFiniteNumber(x["limit"])) add("budget.limit: expected number");
  if (!isFiniteNumber(x["used"])) add("budget.used: expected number");
}

function validateProvenance(pv: unknown, add: (m: string) => void): void {
  if (!isObject(pv)) return add("provenance: expected object");
  const x = pv as Record<string, unknown>;
  if (typeof x["producer"] !== "string") add("provenance.producer: expected string");
  if (typeof x["kawnVersion"] !== "string") add("provenance.kawnVersion: expected string");
  if (typeof x["generatedAt"] !== "string") add("provenance.generatedAt: expected string");
}

function validateSection(s: unknown, i: number, add: (m: string) => void): void {
  if (!isObject(s)) return add(`sections[${i}]: expected object`);
  const x = s as Record<string, unknown>;
  if (typeof x["id"] !== "string") add(`sections[${i}].id: expected string`);
  if (typeof x["title"] !== "string") add(`sections[${i}].title: expected string`);
  if (typeof x["role"] !== "string" || !SECTION_ROLES.has(x["role"] as string))
    add(`sections[${i}].role: expected primary|supporting|data|verification`);
  if (!Array.isArray(x["items"])) return add(`sections[${i}].items: expected array`);
  x["items"].forEach((it, j) => validateItem(it, `sections[${i}].items[${j}]`, add));
}

function validateItem(it: unknown, path: string, add: (m: string) => void): void {
  if (!isObject(it)) return add(`${path}: expected object`);
  const x = it as Record<string, unknown>;
  if (typeof x["id"] !== "string") add(`${path}.id: expected string`);
  if (typeof x["kind"] !== "string") add(`${path}.kind: expected string`);
  if (typeof x["label"] !== "string") add(`${path}.label: expected string`);
  if (typeof x["layer"] !== "string") add(`${path}.layer: expected string`);
  if (typeof x["why"] !== "string") add(`${path}.why: expected string`);
  if (!isFiniteNumber(x["tokensEstimate"])) add(`${path}.tokensEstimate: expected number`);

  if (!isObject(x["location"]) || typeof (x["location"] as Record<string, unknown>)["path"] !== "string")
    add(`${path}.location.path: expected string`);

  if (!isObject(x["rank"])) add(`${path}.rank: expected object`);
  else {
    const r = x["rank"] as Record<string, unknown>;
    if (!isFiniteNumber(r["score"])) add(`${path}.rank.score: expected number`);
    if (!isFiniteNumber(r["position"])) add(`${path}.rank.position: expected number`);
  }

  // The protocol's core promise: every item is grounded in evidence.
  if (!Array.isArray(x["evidence"]) || x["evidence"].length === 0) add(`${path}.evidence: expected non-empty array`);
  else
    (x["evidence"] as unknown[]).forEach((e, k) => {
      if (!isObject(e) || typeof (e as Record<string, unknown>)["sourcePath"] !== "string")
        add(`${path}.evidence[${k}].sourcePath: expected string`);
    });
}

function validateRisk(r: unknown, i: number, add: (m: string) => void): void {
  if (!isObject(r)) return add(`risks[${i}]: expected object`);
  const x = r as Record<string, unknown>;
  if (typeof x["level"] !== "string" || !RISK_LEVELS.has(x["level"] as string))
    add(`risks[${i}].level: expected low|medium|high`);
  if (typeof x["kind"] !== "string") add(`risks[${i}].kind: expected string`);
  if (typeof x["message"] !== "string") add(`risks[${i}].message: expected string`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
