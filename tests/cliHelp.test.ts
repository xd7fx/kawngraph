import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { REPO_ROOT } from "./helpers";

/**
 * `kawn --help` must render cleanly on every terminal — including Windows
 * PowerShell on a legacy (non-UTF-8) code page, where multi-byte glyphs like
 * — · ─ … mojibake and visually glue onto neighbouring words. So the help is kept
 * pure ASCII, and inline phrases stay correctly spaced (regression guard for the
 * "Doit all" / "ContextPack" / "LLM(ollama" report).
 */
const CLI = path.join(REPO_ROOT, "packages", "cli", "dist", "index.js");

function help(): string {
  const r = spawnSync(process.execPath, [CLI, "--help"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

test("--help is pure ASCII (PowerShell / legacy-codepage safe)", () => {
  const out = help();
  const nonAscii = [...out].filter((c) => (c.codePointAt(0) ?? 0) > 127);
  const kinds = [...new Set(nonAscii)].map((c) => "U+" + (c.codePointAt(0) ?? 0).toString(16));
  assert.equal(nonAscii.length, 0, `--help has non-ASCII chars: ${kinds.join(", ")}`);
});

test("--help keeps inline phrases correctly spaced", () => {
  const out = help();
  for (const phrase of [
    "Do it all",
    "keep the map fresh",
    "KawnGraph makes",
    "Context Pack",
    "OAuth callback",
    "local LLM (ollama",
    "no network, no GitHub API",
    "all agents",
    "into one",
    "ask / impact / map",
  ]) {
    assert.ok(out.includes(phrase), `--help should contain "${phrase}"`);
  }
});

test("--help has no glued-together words (reported regressions)", () => {
  const out = help();
  for (const bad of [
    "Doit",
    "keepthe",
    "KawnGraphmakes",
    "technicalnames",
    "filesto",
    "intoone",
    "allagents",
    "ContextPack",
    "OAuthcallback",
    "agentclaude",
    "LLM(ollama",
    "network,no",
    "default:1",
    "model idfor",
  ]) {
    assert.ok(!out.includes(bad), `--help must not contain glued "${bad}"`);
  }
});
