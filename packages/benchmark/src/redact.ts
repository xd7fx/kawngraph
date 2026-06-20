/**
 * Credential redaction. The benchmark captures agent transcripts, stderr, and
 * environment-shaped text; this module guarantees no OAuth token, API key, or JWT
 * is ever written to a report, a log, or disk.
 *
 * Rule (from the spec): "Never print, log, save, or commit OAuth tokens."
 * Everything captured passes through {@link redact} before it leaves an adapter,
 * and the full report object passes through {@link deepRedact} before serialization
 * — defense in depth, so a missed call site still cannot leak a secret.
 */

export const REDACTED = "***REDACTED***";

/**
 * High-signal secret shapes. Kept deliberately specific so ordinary prose, file
 * paths, and code are not mangled.
 */
const TOKEN_PATTERNS: RegExp[] = [
  // Anthropic API keys AND subscription OAuth tokens (sk-ant-..., sk-ant-oat01-...)
  /sk-ant-[A-Za-z0-9_-]{8,}/g,
  // OpenAI-style secret keys (sk-..., sk-proj-...)
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
  // JSON Web Tokens — Codex "Sign in with ChatGPT" access/id/refresh tokens
  /\bey[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g,
  // GitHub tokens (defensive; transcripts sometimes echo git remotes)
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
];

/**
 * Keys whose VALUE must be masked wherever it appears as `key=value`,
 * `key: value`, `"key": "value"`, or `--key value`.
 */
const SECRET_KEYS = [
  "CLAUDE_CODE_OAUTH_TOKEN",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "OPENAI_API_KEY",
  "access_token",
  "refresh_token",
  "id_token",
  "api_key",
  "apikey",
  "authorization",
  "auth_token",
  "secret",
  "password",
  "token",
];

const SECRET_KEY_SET = new Set(SECRET_KEYS.map((k) => k.toLowerCase()));
const KEYS_ALT = SECRET_KEYS.map((k) => k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|");

// "key": "value"   |   'key': 'value'   (JSON / object literals)
const JSON_KV = new RegExp(`(["']?(?:${KEYS_ALT})["']?\\s*:\\s*)(["'])([^"'\\n]+)(["'])`, "gi");
// KEY=value  |  --key=value   (env / CLI), value runs until whitespace, comma, or brace
const ENV_KV = new RegExp(`((?:^|[\\s,;])(?:--)?(?:${KEYS_ALT})=)([^\\s,;}'"]+)`, "gi");
// Authorization: Bearer <token>
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

/** Redact secrets from a single string. Returns the input unchanged if falsy. */
export function redact(input: string | null | undefined): string {
  if (!input) return input ?? "";
  let s = String(input);
  for (const re of TOKEN_PATTERNS) s = s.replace(re, REDACTED);
  s = s.replace(BEARER, `Bearer ${REDACTED}`);
  s = s.replace(JSON_KV, (_m, pre: string, q: string) => `${pre}${q}${REDACTED}${q}`);
  s = s.replace(ENV_KV, (_m, pre: string) => `${pre}${REDACTED}`);
  return s;
}

/**
 * Deep-redact an arbitrary JSON-like value:
 *   - string values are passed through {@link redact};
 *   - any property whose KEY is a known secret has its value replaced wholesale
 *     (covers tokens that don't match a shape, e.g. a short opaque value).
 * Returns a new value; the input is not mutated.
 */
export function deepRedact<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_SET.has(k.toLowerCase()) ? REDACTED : walk(v);
    }
    return out;
  }
  return value;
}
