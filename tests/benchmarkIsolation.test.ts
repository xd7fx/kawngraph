import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { createLogger, type Logger } from "@athar/shared";
import { prepareProject, sessionWorkspace, cleanupStaged, snapshotDir, diffSnapshot } from "@athar/benchmark";
import { mkTmp } from "./helpers";

const log: Logger = createLogger("silent");

/** Build a tiny source project; git-init + commit it so the commit can be pinned. */
function makeSourceRepo(): { src: string; head: string | null } {
  const src = mkTmp("athar-bench-src-");
  fs.mkdirSync(path.join(src, "src"), { recursive: true });
  fs.writeFileSync(path.join(src, "src", "a.ts"), "export const a = 1;\n", "utf8");
  fs.writeFileSync(path.join(src, "src", "b.ts"), "import { a } from './a';\nexport const b = a + 1;\n", "utf8");
  fs.writeFileSync(path.join(src, "README.md"), "# fixture\n", "utf8");

  let head: string | null = null;
  try {
    execFileSync("git", ["-C", src, "init", "-q"], { stdio: "ignore" });
    execFileSync("git", ["-C", src, "add", "-A"], { stdio: "ignore" });
    execFileSync(
      "git",
      ["-C", src, "-c", "user.email=t@example.com", "-c", "user.name=test", "commit", "-q", "-m", "init"],
      { stdio: "ignore" },
    );
    head = execFileSync("git", ["-C", src, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    head = null; // git not available — commit pinning is simply reported as null
  }
  return { src, head };
}

test("A/B isolation: control vs treatment copies, one-time scan cost, workspaces, cleanup", async () => {
  const { src, head } = makeSourceRepo();
  const staged = await prepareProject({ projectId: "fixture", srcPath: src, logger: log });

  try {
    // ---- commit pinning ---------------------------------------------------
    if (head) {
      assert.match(staged.commit ?? "", /^[0-9a-f]{40}$/, "commit is a full git sha");
      assert.equal(staged.commit, head, "staged copies are pinned to the source HEAD");
    } else {
      assert.equal(staged.commit, null, "no git → commit reported as null, not fabricated");
    }

    // ---- control (base) has NO graph; treatment (withBase) HAS one --------
    assert.ok(fs.existsSync(path.join(staged.base, "src", "a.ts")), "base is a real copy");
    assert.equal(fs.existsSync(path.join(staged.base, ".athar")), false, "control arm has no .athar graph");
    assert.equal(fs.existsSync(path.join(staged.base, ".git")), false, ".git is never copied into a staged tree");
    assert.ok(
      fs.existsSync(path.join(staged.withBase, ".athar", "graph.json")),
      "treatment arm was scanned: graph.json exists",
    );

    // ---- scan cost is recorded separately, never fabricated ---------------
    assert.equal(staged.scanCost.projectId, "fixture");
    assert.equal(typeof staged.scanCost.scanMs, "number");
    assert.ok(staged.scanCost.scanMs >= 0);
    assert.ok(staged.scanCost.nodes > 0, "the scan produced graph nodes");
    assert.ok(staged.scanCost.trackedFileCount >= 1, "at least one tracked file node");

    // ---- the scanned graph is kept in memory for Athar pack metrics -------
    assert.ok(staged.graph && staged.graph.nodes.length > 0, "the scanned graph is returned in memory");
    assert.equal(staged.graph.stats.nodes, staged.scanCost.nodes, "in-memory graph matches the recorded scan cost");

    // ---- retrieval workspaces: reuse the shared copies (read-only) --------
    const wo = sessionWorkspace(staged, "without", "retrieval");
    assert.equal(wo.cwd, staged.base, "control retrieval runs in the un-scanned base copy");
    assert.equal(wo.ephemeral, false);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(wo.mcpConfigPath, "utf8")).mcpServers,
      {},
      "control arm registers no MCP servers",
    );

    const wi = sessionWorkspace(staged, "with", "retrieval");
    assert.equal(wi.cwd, staged.withBase, "treatment retrieval runs in the scanned copy");
    assert.equal(wi.ephemeral, false);
    const wiCfg = JSON.parse(fs.readFileSync(wi.mcpConfigPath, "utf8"));
    assert.ok(wiCfg.mcpServers.athar, "treatment arm registers the athar MCP server");
    assert.ok(Array.isArray(wiCfg.mcpServers.athar.args), "the server launch carries args");

    // ---- e2e workspaces: a throwaway clean copy per session --------------
    const e1 = sessionWorkspace(staged, "with", "e2e");
    assert.equal(e1.ephemeral, true);
    assert.notEqual(e1.cwd, staged.withBase, "e2e never edits the shared copy");
    assert.ok(fs.existsSync(path.join(e1.cwd, "src", "a.ts")), "e2e copy contains the project");
    const e2 = sessionWorkspace(staged, "with", "e2e");
    assert.notEqual(e2.cwd, e1.cwd, "each e2e session gets its own clean worktree");

    // ---- cleanup removes everything --------------------------------------
    const root = staged.rootDir;
    cleanupStaged(staged);
    assert.equal(fs.existsSync(root), false, "cleanup removes the staged temp tree");
  } finally {
    try {
      cleanupStaged(staged);
    } catch {
      /* already gone */
    }
    fs.rmSync(src, { recursive: true, force: true });
  }
});

test("prepareProject fails clearly when the source path does not exist", async () => {
  const missing = path.join(mkTmp("athar-bench-missing-"), "nope");
  await assert.rejects(
    prepareProject({ projectId: "x", srcPath: missing, logger: log }),
    /project not found/i,
  );
});

// §4 — the e2e change-boundary depends on a content snapshot/diff that attributes
// exactly the agent's edits and never lets build/dep noise look like a change.
test("snapshotDir + diffSnapshot detect added / modified / removed and ignore excluded dirs", () => {
  const dir = mkTmp("athar-bench-snap-");
  try {
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "keep.ts"), "const keep = 1;\n", "utf8");
    fs.writeFileSync(path.join(dir, "src", "edit.ts"), "const edit = 1;\n", "utf8");
    fs.writeFileSync(path.join(dir, "src", "gone.ts"), "const gone = 1;\n", "utf8");

    const pre = snapshotDir(dir);

    // mutate the workspace as an agent edit would
    fs.writeFileSync(path.join(dir, "src", "edit.ts"), "const edit = 2;\n", "utf8"); // modify
    fs.writeFileSync(path.join(dir, "src", "new.ts"), "const fresh = 1;\n", "utf8"); // add
    fs.rmSync(path.join(dir, "src", "gone.ts")); // remove
    // build / dependency noise that must NEVER be attributed to the agent
    fs.mkdirSync(path.join(dir, "node_modules", "x"), { recursive: true });
    fs.writeFileSync(path.join(dir, "node_modules", "x", "index.js"), "module.exports = 1;\n", "utf8");
    fs.mkdirSync(path.join(dir, "dist"), { recursive: true });
    fs.writeFileSync(path.join(dir, "dist", "out.js"), "console.log(1);\n", "utf8");

    const diff = diffSnapshot(dir, pre);
    assert.deepEqual(diff.modified, ["src/edit.ts"], "the edited file is detected, normalized posix");
    assert.deepEqual(diff.added, ["src/new.ts"], "the new file is detected");
    assert.deepEqual(diff.removed, ["src/gone.ts"], "the deleted file is detected");
    assert.ok(
      !JSON.stringify(diff).includes("node_modules") && !JSON.stringify(diff).includes("dist/"),
      "excluded dirs (node_modules/dist/.git/…) never masquerade as agent edits",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
