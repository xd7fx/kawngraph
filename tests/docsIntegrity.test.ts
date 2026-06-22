import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "./helpers";

/**
 * Documentation-integrity guards. These keep the published presentation honest
 * and self-consistent without re-running any agents:
 *
 *  - the committed benchmark artifact validates (every run usable, no invalid
 *    gold silently kept) and is sanitized (no legacy `athar*` keys, no machine
 *    paths);
 *  - the README benchmark block is exactly what the regen script produces from
 *    that artifact (numbers can never drift away from the campaign);
 *  - every README translation is structurally aligned with the canonical README
 *    (headings, byte-identical code blocks, unchanged benchmark numbers, recorded
 *    canonical hash) — i.e. `scripts/check-readme-translations.mjs` passes.
 */

const SUMMARY = path.join(REPO_ROOT, "benchmarks", "published", "campaign-2026-06-20.summary.json");

function runScript(rel: string, args: string[] = []): { code: number | null; stdout: string; stderr: string } {
  const res = spawnSync(process.execPath, [path.join(REPO_ROOT, rel), ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return { code: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

test("published benchmark artifact is valid and exploratory", () => {
  const s = JSON.parse(fs.readFileSync(SUMMARY, "utf8"));
  assert.equal(s.schema, "kawngraph.benchmark.published/v1");
  const v = s.validation;
  // every run is accounted for: usable + excluded == total
  assert.equal(v.usableRuns + v.excludedRuns, v.totalRuns, "usable + excluded must equal total");
  // no run with an invalid gold reference is silently kept
  assert.equal(v.runsWithInvalidGold, 0, "this campaign has no invalid-gold runs");
  // n<5 per arm => exploratory, directional only (must be stated, not hidden)
  assert.equal(v.exploratory, true);
  assert.ok(v.minSamplePerArm >= 1 && v.minSamplePerArm < 5, "exploratory sample size");
  assert.ok(Array.isArray(s.cells) && s.cells.length > 0, "has per-cell results");
});

test("published benchmark artifact is sanitized (no legacy brand, no machine paths)", () => {
  const raw = fs.readFileSync(SUMMARY, "utf8");
  assert.doesNotMatch(raw, /athar/i, "no legacy athar* keys/labels in the published artifact");
  assert.doesNotMatch(raw, /[A-Za-z]:\\\\|\/Users\/|AppData|binPath/i, "no absolute machine paths");
});

test("README benchmark block matches the regenerated block (no drift)", () => {
  const r = runScript("scripts/readme-benchmark.mjs", ["--check"]);
  assert.equal(r.code, 0, `README benchmark block is out of date — run node scripts/readme-benchmark.mjs\n${r.stderr}`);
});

test("all README translations pass the parity checker", () => {
  const r = runScript("scripts/check-readme-translations.mjs");
  assert.equal(r.code, 0, `translation parity check failed:\n${r.stdout}\n${r.stderr}`);
});
