import type { UniversalContextPack } from "./schema";
import { isProtocolCompatible } from "./version";
import { KAWN_PROTOCOL_CAPABILITIES } from "./capabilities";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

// A *produced* pack reports the concrete mode it actually used — `resolveMode`
// strips the ambiguous `auto` before the pack is built — so all of code/docs/
// data/tests/all are valid here, but `auto` is not (it means "undecided").
const MODES = new Set(["code", "docs", "data", "tests", "all"]);
const SECTION_ROLES = new Set(["primary", "supporting", "data", "verification"]);
const RISK_LEVELS = new Set(["low", "medium", "high"]);
const CAPABILITY_FLAGS = [
  "evidence",
  "explanations",
  "ranking",
  "tokenBudget",
  "layeredSections",
  "deterministic",
  "noLlm",
] as const;
// The protocol's closed type system. Sourced from the capabilities the producer
// advertises (which enumerate every NodeType / Layer) so this validator can never
// silently drift from the schema's own unions.
const NODE_KINDS = new Set<string>(KAWN_PROTOCOL_CAPABILITIES.nodeKinds);
const LAYERS = new Set<string>(KAWN_PROTOCOL_CAPABILITIES.layers);

/**
 * Structurally validate an untrusted value as a {@link UniversalContextPack}.
 * This is what a consumer runs before trusting a pack it received: it checks the
 * protocol is major-compatible and that every promised field is present and well
 * typed — in particular that each item carries the four guarantees the protocol
 * is built around (why / layer / evidence / rank), that enumerations (mode, role,
 * node kind, layer, risk level) are in range, that numbers are sound (budgets and
 * token estimates ≥ 0, ranks are 1-based integers), and that the advertised
 * capabilities are themselves well-formed and agree with the pack's version.
 * Errors are collected (not thrown) so a caller can report all problems at once.
 */
export function validateUniversalPack(value: unknown): ValidationResult {
  const errors: string[] = [];
  const add = (m: string): void => void errors.push(m);

  if (!isObject(value)) {
    return { ok: false, errors: ["pack is not an object"] };
  }
  const p = value as Record<string, unknown>;

  const version = typeof p["protocolVersion"] === "string" ? (p["protocolVersion"] as string) : undefined;
  if (version === undefined) add("protocolVersion: expected string");
  else if (!isProtocolCompatible(version)) add(`protocolVersion: incompatible (${version})`);

  if (typeof p["task"] !== "string") add("task: expected string");
  if (typeof p["mode"] !== "string" || !MODES.has(p["mode"] as string)) add("mode: expected code|docs|data|tests|all");
  if (!isFiniteNumber(p["confidence"]) || (p["confidence"] as number) < 0 || (p["confidence"] as number) > 1)
    add("confidence: expected number in [0,1]");

  validateBudget(p["budget"], add);
  validateProvenance(p["provenance"], add);
  validateCapabilities(p["capabilities"], version, add);

  if (!Array.isArray(p["sections"])) add("sections: expected array");
  else {
    const seenIds = new Set<string>();
    p["sections"].forEach((s, i) => {
      validateSection(s, i, add);
      if (isObject(s) && typeof (s as Record<string, unknown>)["id"] === "string") {
        const id = (s as Record<string, unknown>)["id"] as string;
        if (seenIds.has(id)) add(`sections[${i}].id: duplicate section id "${id}"`);
        seenIds.add(id);
      }
    });
  }

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
  if (!isNonNegative(x["limit"])) add("budget.limit: expected number >= 0");
  if (!isNonNegative(x["used"])) add("budget.used: expected number >= 0");
}

function validateProvenance(pv: unknown, add: (m: string) => void): void {
  if (!isObject(pv)) return add("provenance: expected object");
  const x = pv as Record<string, unknown>;
  if (typeof x["producer"] !== "string") add("provenance.producer: expected string");
  if (typeof x["kawnVersion"] !== "string") add("provenance.kawnVersion: expected string");
  if (typeof x["generatedAt"] !== "string") add("provenance.generatedAt: expected string");
}

/**
 * The producer's advertised guarantees must themselves be well-formed — a
 * consumer negotiates against this object, so a malformed one is as dangerous as
 * a malformed pack. The capability version must also be major-compatible with the
 * pack it travels with (they are produced together).
 */
function validateCapabilities(c: unknown, packVersion: string | undefined, add: (m: string) => void): void {
  if (!isObject(c)) return add("capabilities: expected object");
  const x = c as Record<string, unknown>;
  const capVersion = x["protocolVersion"];
  if (typeof capVersion !== "string") add("capabilities.protocolVersion: expected string");
  else if (packVersion !== undefined && !isProtocolCompatible(capVersion, packVersion))
    add(`capabilities.protocolVersion: incompatible with pack (${capVersion} vs ${packVersion})`);
  for (const flag of CAPABILITY_FLAGS) {
    if (typeof x[flag] !== "boolean") add(`capabilities.${flag}: expected boolean`);
  }
  if (!isStringArray(x["nodeKinds"])) add("capabilities.nodeKinds: expected string[]");
  if (!isStringArray(x["layers"])) add("capabilities.layers: expected string[]");
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
  else if (!NODE_KINDS.has(x["kind"] as string)) add(`${path}.kind: unknown node kind "${x["kind"]}"`);
  if (typeof x["label"] !== "string") add(`${path}.label: expected string`);
  if (typeof x["layer"] !== "string") add(`${path}.layer: expected string`);
  else if (!LAYERS.has(x["layer"] as string)) add(`${path}.layer: unknown layer "${x["layer"]}"`);
  if (typeof x["why"] !== "string") add(`${path}.why: expected string`);
  if (!isNonNegative(x["tokensEstimate"])) add(`${path}.tokensEstimate: expected number >= 0`);

  validateLocation(x["location"], path, add);

  if (!isObject(x["rank"])) add(`${path}.rank: expected object`);
  else {
    const r = x["rank"] as Record<string, unknown>;
    if (!isFiniteNumber(r["score"])) add(`${path}.rank.score: expected number`);
    if (!isPositiveInt(r["position"])) add(`${path}.rank.position: expected integer >= 1`);
  }

  // The protocol's core promise: every item is grounded in evidence.
  if (!Array.isArray(x["evidence"]) || x["evidence"].length === 0) add(`${path}.evidence: expected non-empty array`);
  else (x["evidence"] as unknown[]).forEach((e, k) => validateEvidence(e, `${path}.evidence[${k}]`, add));
}

function validateLocation(loc: unknown, path: string, add: (m: string) => void): void {
  if (!isObject(loc) || typeof (loc as Record<string, unknown>)["path"] !== "string") {
    return add(`${path}.location.path: expected string`);
  }
  const l = loc as Record<string, unknown>;
  if (l["lineStart"] !== undefined && !isFiniteNumber(l["lineStart"])) add(`${path}.location.lineStart: expected number`);
  if (l["lineEnd"] !== undefined && !isFiniteNumber(l["lineEnd"])) add(`${path}.location.lineEnd: expected number`);
}

/** An evidence entry: a source path, with optional numeric line bounds. Reused for items and risks. */
function validateEvidence(e: unknown, path: string, add: (m: string) => void): void {
  if (!isObject(e) || typeof (e as Record<string, unknown>)["sourcePath"] !== "string") {
    return add(`${path}.sourcePath: expected string`);
  }
  const x = e as Record<string, unknown>;
  if (x["lineStart"] !== undefined && !isFiniteNumber(x["lineStart"])) add(`${path}.lineStart: expected number`);
  if (x["lineEnd"] !== undefined && !isFiniteNumber(x["lineEnd"])) add(`${path}.lineEnd: expected number`);
}

function validateRisk(r: unknown, i: number, add: (m: string) => void): void {
  if (!isObject(r)) return add(`risks[${i}]: expected object`);
  const x = r as Record<string, unknown>;
  if (typeof x["level"] !== "string" || !RISK_LEVELS.has(x["level"] as string))
    add(`risks[${i}].level: expected low|medium|high`);
  if (typeof x["kind"] !== "string") add(`risks[${i}].kind: expected string`);
  if (typeof x["message"] !== "string") add(`risks[${i}].message: expected string`);
  if (x["nodeId"] !== undefined && typeof x["nodeId"] !== "string") add(`risks[${i}].nodeId: expected string`);
  if (x["evidence"] !== undefined) validateEvidence(x["evidence"], `risks[${i}].evidence`, add);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNonNegative(v: unknown): v is number {
  return isFiniteNumber(v) && v >= 0;
}

function isPositiveInt(v: unknown): v is number {
  return isFiniteNumber(v) && Number.isInteger(v) && v >= 1;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === "string");
}
