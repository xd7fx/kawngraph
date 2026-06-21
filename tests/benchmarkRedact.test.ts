import { test } from "node:test";
import assert from "node:assert/strict";
import { redact, deepRedact, REDACTED } from "@kawngraph/benchmark";

// ---------------------------------------------------------------------------
// redact(): high-signal secret shapes are masked; ordinary prose is left alone.
// The spec rule under test: "Never print, log, save, or commit OAuth tokens."
// ---------------------------------------------------------------------------

test("redact masks Anthropic keys and subscription OAuth tokens (sk-ant-…)", () => {
  const out = redact("using sk-ant-oat01-ABCDEFGH12345678 now");
  assert.match(out, /using \*\*\*REDACTED\*\*\* now/);
  assert.doesNotMatch(out, /ABCDEFGH/);
});

test("redact masks OpenAI-style secret keys (sk-proj-…)", () => {
  const out = redact("key sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX done");
  assert.match(out, /key \*\*\*REDACTED\*\*\* done/);
});

test("redact masks JWTs (Codex Sign-in-with-ChatGPT tokens)", () => {
  const jwt = "eyJhbGciOi.eyJzdWIiOiABC.SflKxwRJSMeKKF";
  const out = redact(`auth=${jwt}`);
  assert.doesNotMatch(out, /SflKxwRJSMeKKF/);
  assert.match(out, /\*\*\*REDACTED\*\*\*/);
});

test("redact masks GitHub tokens", () => {
  const out = redact("remote ghp_0123456789abcdefghijABCD origin");
  assert.match(out, /remote \*\*\*REDACTED\*\*\* origin/);
});

test("redact masks 'Authorization: Bearer <token>'", () => {
  const out = redact("Authorization: Bearer abc.def-ghi_jkl=");
  assert.equal(out, `Authorization: Bearer ${REDACTED}`);
});

test("redact masks JSON key/value secrets by key name", () => {
  const out = redact('{"api_key":"plainvalue12"}');
  assert.equal(out, `{"api_key":"${REDACTED}"}`);
});

test("redact masks env/CLI key=value secrets by key name", () => {
  assert.equal(redact("OPENAI_API_KEY=plainvalue123"), `OPENAI_API_KEY=${REDACTED}`);
  assert.equal(
    redact("CLAUDE_CODE_OAUTH_TOKEN=opaque-value-xyz"),
    `CLAUDE_CODE_OAUTH_TOKEN=${REDACTED}`,
  );
});

test("redact leaves ordinary prose, file paths, and code untouched", () => {
  const benign = "Read src/lib/oauth.ts then call exchangeCodeForToken(code).";
  assert.equal(redact(benign), benign);
});

test("redact returns an empty string for null/undefined", () => {
  assert.equal(redact(null), "");
  assert.equal(redact(undefined), "");
});

// ---------------------------------------------------------------------------
// deepRedact(): defense in depth over the whole report object.
// ---------------------------------------------------------------------------

test("deepRedact masks values whose KEY is a known secret, at any depth", () => {
  const input = {
    safe: "hello",
    access_token: "short-opaque",
    nested: { refresh_token: "also-secret", keep: "ok" },
    list: [{ password: "p" }, { id_token: "t" }],
  };
  const out = deepRedact(input);
  assert.equal(out.access_token, REDACTED);
  assert.equal(out.nested.refresh_token, REDACTED);
  assert.equal(out.nested.keep, "ok");
  assert.equal(out.list[0].password, REDACTED);
  assert.equal(out.list[1].id_token, REDACTED);
  assert.equal(out.safe, "hello");
});

test("deepRedact also runs string redaction on ordinary string values", () => {
  const out = deepRedact({ note: "token sk-ant-oat01-ABCDEFGH12345678 leaked" });
  assert.doesNotMatch(out.note, /ABCDEFGH/);
  assert.match(out.note, /\*\*\*REDACTED\*\*\*/);
});

test("deepRedact does not mutate its input", () => {
  const input = { access_token: "secret", deep: { token: "x" } };
  const copy = JSON.parse(JSON.stringify(input));
  deepRedact(input);
  assert.deepEqual(input, copy, "original object must be unchanged");
});

test("deepRedact masks a secret-keyed value even when it is a non-string", () => {
  const out = deepRedact({ token: 1234567 });
  assert.equal(out.token, REDACTED);
});
