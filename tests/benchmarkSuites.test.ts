import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadProjectsFile, findProjectByPath, genericProject, resolveProjectPath } from "@athar/benchmark";
import type { ProjectDef } from "@athar/benchmark";
import { REPO_ROOT, mkTmp } from "./helpers";

/** Write a suite (object → JSON, or a raw string verbatim) to a fresh temp file. */
function writeSuite(obj: unknown): { file: string; root: string } {
  const root = mkTmp("athar-bench-suite-");
  const file = path.join(root, "projects.json");
  fs.writeFileSync(file, typeof obj === "string" ? obj : JSON.stringify(obj), "utf8");
  return { file, root };
}

// ---------------------------------------------------------------------------
// loadProjectsFile: resolve paths, default ids, normalize gold sets.
// ---------------------------------------------------------------------------

test("loadProjectsFile resolves paths, defaults ids, and lowercases gold", () => {
  const { file, root } = writeSuite({
    projects: [
      {
        id: "p1",
        path: "sub/proj",
        tasks: [{ id: "t", prompt: "do", gold: ["SRC/A.TS", "Docs/B.md"], expectMentions: ["x"], mode: "e2e" }],
      },
      { path: "other" }, // id → basename, tasks → []
    ],
  });
  try {
    const projects = loadProjectsFile(file, root);
    assert.equal(projects.length, 2);

    const p1 = projects[0];
    assert.equal(p1.id, "p1");
    assert.equal(p1.path, path.resolve(root, "sub/proj"), "relative path resolved against repoRoot");
    assert.deepEqual(p1.tasks[0].gold, ["src/a.ts", "docs/b.md"], "gold normalized to lowercase posix");
    assert.deepEqual(p1.tasks[0].expectMentions, ["x"], "non-gold task fields are preserved");
    assert.equal(p1.tasks[0].mode, "e2e", "task mode is preserved");

    const p2 = projects[1];
    assert.equal(p2.id, "other", "missing id defaults to the path basename");
    assert.deepEqual(p2.tasks, [], "missing tasks default to an empty list");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("loadProjectsFile rejects invalid JSON", () => {
  const { file, root } = writeSuite("{ not json ");
  try {
    assert.throws(() => loadProjectsFile(file, root), /not valid JSON/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("loadProjectsFile rejects a file with no projects array", () => {
  const { file, root } = writeSuite({ nope: true });
  try {
    assert.throws(() => loadProjectsFile(file, root), /invalid projects file/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("loadProjectsFile rejects a project that is missing its path", () => {
  const { file, root } = writeSuite({ projects: [{ id: "x", tasks: [] }] });
  try {
    assert.throws(() => loadProjectsFile(file, root), /missing "path"/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// findProjectByPath / genericProject / resolveProjectPath
// ---------------------------------------------------------------------------

test("findProjectByPath matches a resolved path case-insensitively", () => {
  const projects: ProjectDef[] = [
    { id: "a", path: path.resolve("/tmp/Foo/Bar"), tasks: [] },
    { id: "b", path: path.resolve("/tmp/baz"), tasks: [] },
  ];
  const hit = findProjectByPath(projects, path.resolve("/tmp/foo/bar"));
  assert.ok(hit, "a case-different path still matches");
  assert.equal(hit!.id, "a");
  assert.equal(findProjectByPath(projects, path.resolve("/tmp/none")), undefined, "no match → undefined");
});

test("genericProject yields a single gold-free retrieval task", () => {
  const gp = genericProject(path.resolve("/tmp/my-app"));
  assert.equal(gp.id, "my-app", "id is the path basename");
  assert.equal(gp.path, path.resolve("/tmp/my-app"));
  assert.equal(gp.tasks.length, 1);
  assert.equal(gp.tasks[0].id, "explore");
  assert.equal(gp.tasks[0].mode, "retrieval");
  assert.deepEqual(gp.tasks[0].gold, [], "no curated gold → precision/recall honestly report n/a");
});

test("resolveProjectPath keeps absolute paths and resolves relative ones", () => {
  const abs = path.resolve("/var/data/proj");
  assert.equal(resolveProjectPath(abs, path.resolve("/repo/root")), abs, "absolute path is returned as-is");
  assert.equal(
    resolveProjectPath("examples/app", REPO_ROOT),
    path.resolve(REPO_ROOT, "examples/app"),
    "relative path is resolved against repoRoot",
  );
});

// ---------------------------------------------------------------------------
// The shipped, tracked suite under benchmarks/ must load and stay curated.
// ---------------------------------------------------------------------------

test("the shipped benchmarks/projects.json is a valid, curated suite", () => {
  const file = path.join(REPO_ROOT, "benchmarks", "projects.json");
  const projects = loadProjectsFile(file, REPO_ROOT);

  const byId = new Map(projects.map((p) => [p.id, p]));
  const nextjs = byId.get("nextjs-supabase");
  const atharSelf = byId.get("athar-self");
  assert.ok(nextjs, "nextjs-supabase suite is present");
  assert.ok(atharSelf, "athar-self suite is present");

  // every gold entry is already normalized (lowercase posix) on load
  for (const p of projects) {
    for (const t of p.tasks) {
      for (const g of t.gold) {
        assert.equal(g, g.toLowerCase(), `gold entry "${g}" is lowercased`);
        assert.ok(!g.includes("\\"), `gold entry "${g}" uses posix separators`);
      }
    }
  }

  // the retrieval gold names the real OAuth callback route
  const oauth = nextjs!.tasks.find((t) => t.id === "zid-oauth");
  assert.ok(oauth, "zid-oauth retrieval task present");
  assert.ok(oauth!.gold.includes("app/api/zid/oauth/callback/route.ts"), "gold includes the callback route");

  // there is an e2e task with a real grading command
  const e2e = nextjs!.tasks.find((t) => t.mode === "e2e");
  assert.ok(e2e, "an e2e task exists");
  assert.ok(typeof e2e!.testCommand === "string" && e2e!.testCommand.length > 0, "the e2e task ships a testCommand");

  // athar-self points at the MCP freshness gate
  const fresh = atharSelf!.tasks.find((t) => t.id === "freshness-gate");
  assert.ok(fresh, "freshness-gate task present");
  assert.ok(fresh!.gold.includes("packages/mcp/src/index.ts"), "gold includes the MCP server entry");
});
