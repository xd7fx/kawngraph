/**
 * Parser regression against a REAL, sanitized Codex transcript (CLI 0.141.0).
 *
 * The fixture under tests/fixtures/ is the captured `codex exec --json` stream
 * from a live e2e run, with the prompt and large file dumps trimmed (the example
 * project's own source is already public; no credentials are ever present). It
 * pins the parser to bytes Codex actually emitted, not just hand-written shapes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseCodexLines } from "@athar/benchmark";

const FIXTURES = path.join(__dirname, "..", "fixtures");

function loadJsonl(file: string): Array<{ atMs: number; text: string }> {
  const text = fs.readFileSync(path.join(FIXTURES, file), "utf8");
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((t, i) => ({ atMs: i * 10, text: t }));
}

test("parseCodexLines: real e2e read-only transcript (Codex CLI 0.141.0)", () => {
  const cwd = "/staged/nextjs-supabase";
  const parsed = parseCodexLines(loadJsonl("codex-e2e-readonly.jsonl"), cwd);

  assert.equal(parsed.sawAny, true);
  assert.equal(parsed.diag.threadId, "th_fixture_e2e");
  assert.equal(parsed.numTurns, 1);

  // real usage numbers captured from the run — including reasoning tokens
  assert.equal(parsed.tokens.input, 36676);
  assert.equal(parsed.tokens.cacheRead, 32512);
  assert.equal(parsed.tokens.output, 390);
  assert.equal(parsed.tokens.reasoning, 51);

  // the PowerShell `Get-Content -LiteralPath '...'` read resolves to the concrete
  // file and is emitted exactly once despite arriving as started + completed
  const opened = parsed.tools.filter((t) => t.file === "app/api/zid/oauth/callback/route.ts");
  assert.equal(opened.length, 1, "Get-Content de-duplicated and resolved to the file");
  assert.equal(opened[0].kind, "read");

  // the final answer is the read-only failure + the computed guard patch
  assert.match(parsed.answer, /read-only/i);
  assert.match(parsed.answer, /code\.length/);

  // a known-good transcript yields no schema-drift diagnostics
  assert.deepEqual(parsed.diag.unknownItemTypes, []);
  assert.deepEqual(parsed.diag.unknownEventTypes, []);
  assert.equal(parsed.diag.declinedCommands, 0);
});
