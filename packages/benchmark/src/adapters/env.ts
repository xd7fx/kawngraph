/**
 * Build the environment for a benchmarked agent's child process: a copy of the
 * parent env with every API/secret key stripped, so a "subscription" run can only
 * authorize via the CLI's own stored credential (a stray key would silently turn
 * it into a metered API run).
 *
 * Two Windows-safety rules:
 *  - Secret detection is CASE-INSENSITIVE — Windows env keys are case-insensitive,
 *    so `Anthropic_Api_Key` must be dropped just like `ANTHROPIC_API_KEY`.
 *  - Every other variable is copied with its ORIGINAL casing and value, so PATH
 *    (Linux) and Path (Windows) survive intact.
 *
 * It never mutates `source` (defaults to process.env) — it builds a fresh object.
 */

/** API/secret env var names to strip (compared upper-cased, i.e. case-insensitively). */
export const SECRET_ENV_KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY"] as const;

const SECRET_SET = new Set<string>(SECRET_ENV_KEYS);

export function stripApiKeys(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const key of Object.keys(source)) {
    if (SECRET_SET.has(key.toUpperCase())) continue; // drop secrets, any casing
    out[key] = source[key]; // preserve original casing + value (PATH / Path / …)
  }
  return out;
}
