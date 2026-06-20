import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createLogger, type Logger } from "@athar/shared";
import { initExternalProject, loadProjectsFile, assertGoldApproved } from "@athar/benchmark";
import { mkTmp } from "./helpers";

const log: Logger = createLogger("silent");

/** A tiny external project to point `init` at — never copied, only read. */
function makeExternal(): string {
  const dir = mkTmp("athar-ext-src-");
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src", "checkout.ts"), "export function checkout() { return 1; }\n", "utf8");
  fs.writeFileSync(path.join(dir, "src", "cart.ts"), "export function cart() { return 2; }\n", "utf8");
  fs.writeFileSync(path.join(dir, "README.md"), "# ext\nThe checkout flow lives in src/checkout.ts\n", "utf8");
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"ext","version":"1.0.0"}\n', "utf8");
  return dir;
}

test("benchmark init scaffolds a draft suite (read-only, external path referenced, never approved)", async () => {
  const ext = makeExternal();
  const repoRoot = mkTmp("athar-bench-root-");
  try {
    const res = await initExternalProject({
      projectPath: ext,
      repoRoot,
      task: "trace the checkout flow end to end",
      logger: log,
    });

    // ---- written where we said, with the external path embedded ----------
    assert.ok(fs.existsSync(res.outFile), "the draft file was written");
    assert.equal(res.outFile, path.join(repoRoot, "benchmarks", "local", `${res.projectId}.bench.json`));
    const draft = JSON.parse(fs.readFileSync(res.outFile, "utf8"));
    assert.equal(draft._draft, true, "the file is self-labeled as a draft");
    assert.match(draft._note, /do not commit/i, "the note warns against committing");
    assert.equal(path.resolve(draft.projects[0].path), path.resolve(ext), "references the external path, not a copy");

    // ---- the scan that suggested gold NEVER wrote into the external tree --
    assert.equal(fs.existsSync(path.join(ext, ".athar")), false, "init is read-only: no .athar in the external project");

    // ---- a concrete --task yields a single task with SUGGESTED, UNAPPROVED gold
    assert.equal(res.taskCount, 1);
    const t = draft.projects[0].tasks[0];
    assert.equal(t.prompt, "trace the checkout flow end to end");
    assert.equal(t.goldApproved, false, "suggested gold is never auto-approved");
    assert.ok(res.suggestedGold > 0 && t.gold.length === res.suggestedGold, "Athar suggested at least one draft gold file");
    assert.ok(t.gold.includes("src/checkout.ts"), "the obviously-relevant file is suggested");
  } finally {
    fs.rmSync(ext, { recursive: true, force: true });
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("benchmark init without a task scaffolds retrieval + e2e templates for a human to fill", async () => {
  const ext = makeExternal();
  const repoRoot = mkTmp("athar-bench-root-");
  try {
    const res = await initExternalProject({ projectPath: ext, repoRoot, logger: log });
    assert.equal(res.taskCount, 2);
    assert.equal(res.suggestedGold, 0, "no prompt → nothing to suggest, not a fabricated gold set");

    const draft = JSON.parse(fs.readFileSync(res.outFile, "utf8"));
    const [r, e] = draft.projects[0].tasks;
    assert.equal(r.mode, "retrieval");
    assert.equal(e.mode, "e2e");
    assert.deepEqual([r.goldApproved, e.goldApproved], [false, false], "both templates start unapproved");
    assert.deepEqual([r.prompt, e.prompt], ["", ""], "prompts are blank for the human to write");
    assert.deepEqual(r.gold, [], "retrieval template has an empty gold set");
    assert.equal(typeof e.testCommand, "string", "the e2e template carries a testCommand slot");
  } finally {
    fs.rmSync(ext, { recursive: true, force: true });
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("a draft suite cannot be run until every task's gold is approved", async () => {
  const ext = makeExternal();
  const repoRoot = mkTmp("athar-bench-root-");
  try {
    const res = await initExternalProject({ projectPath: ext, repoRoot, task: "trace checkout", logger: log });

    // the loader refuses while gold is draft — no fabricated precision/recall
    assert.throws(
      () => loadProjectsFile(res.outFile, repoRoot),
      /draft \(unapproved\) gold/i,
      "loading a draft suite is blocked with a clear, per-task message",
    );

    // a human reviews and approves
    const draft = JSON.parse(fs.readFileSync(res.outFile, "utf8"));
    for (const t of draft.projects[0].tasks) t.goldApproved = true;
    fs.writeFileSync(res.outFile, JSON.stringify(draft, null, 2), "utf8");

    const projects = loadProjectsFile(res.outFile, repoRoot);
    assert.equal(projects.length, 1);
    assert.equal(path.resolve(projects[0].path), path.resolve(ext), "approved suite resolves the external path");
    assert.ok(projects[0].tasks[0].gold.length > 0, "the (now approved) gold survives load");
  } finally {
    fs.rmSync(ext, { recursive: true, force: true });
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("assertGoldApproved names exactly the draft tasks and passes curated suites untouched", () => {
  assert.throws(
    () =>
      assertGoldApproved([
        { id: "p", path: "/x", tasks: [
          { id: "ok", prompt: "", gold: [], goldApproved: true },
          { id: "draft", prompt: "", gold: [], goldApproved: false },
        ] },
      ]),
    /p\/draft/,
    "only the unapproved task is named",
  );
  // tracked suites omit goldApproved entirely ⇒ treated as approved
  assert.doesNotThrow(() =>
    assertGoldApproved([{ id: "p", path: "/x", tasks: [{ id: "t", prompt: "", gold: ["a.ts"] }] }]),
  );
});

test("benchmark init refuses a missing project and won't clobber an existing draft without --force", async () => {
  const repoRoot = mkTmp("athar-bench-root-");
  const ext = makeExternal();
  try {
    await assert.rejects(
      initExternalProject({ projectPath: path.join(repoRoot, "nope"), repoRoot, logger: log }),
      /not found/i,
    );

    const first = await initExternalProject({ projectPath: ext, repoRoot, logger: log });
    await assert.rejects(
      initExternalProject({ projectPath: ext, repoRoot, logger: log }),
      /already exists/i,
      "a second init refuses to overwrite silently",
    );
    // --force overwrites
    const again = await initExternalProject({ projectPath: ext, repoRoot, force: true, logger: log });
    assert.equal(again.outFile, first.outFile, "--force rewrites the same draft path");
  } finally {
    fs.rmSync(ext, { recursive: true, force: true });
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});
