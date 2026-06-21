import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  loadProjectsFile,
  findProjectByPath,
  genericProject,
  resolveProjectPath,
  findMissingGold,
  assertGoldExists,
} from "@kawngraph/benchmark";
import type { ProjectDef } from "@kawngraph/benchmark";
import { REPO_ROOT, mkTmp } from "./helpers";

/** Write a suite (object → JSON, or a raw string verbatim) to a fresh temp file. */
function writeSuite(obj: unknown): { file: string; root: string } {
  const root = mkTmp("kawn-bench-suite-");
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
  // The gold files must exist on disk (the existence gate runs on the RAW casing
  // before normalization lowercases them) — this test is about resolution +
  // normalization, not the missing-gold path.
  fs.mkdirSync(path.join(root, "sub", "proj", "SRC"), { recursive: true });
  fs.writeFileSync(path.join(root, "sub", "proj", "SRC", "A.TS"), "x\n", "utf8");
  fs.mkdirSync(path.join(root, "sub", "proj", "Docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "sub", "proj", "Docs", "B.md"), "x\n", "utf8");
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
  const kawnSelf = byId.get("kawn-self");
  assert.ok(nextjs, "nextjs-supabase suite is present");
  assert.ok(kawnSelf, "kawn-self suite is present");

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

  // kawn-self points at the MCP freshness gate
  const fresh = kawnSelf!.tasks.find((t) => t.id === "freshness-gate");
  assert.ok(fresh, "freshness-gate task present");
  assert.ok(fresh!.gold.includes("packages/mcp/src/index.ts"), "gold includes the MCP server entry");

  // the self-suite ships the four manually-verified retrieval tasks
  assert.deepEqual(
    kawnSelf!.tasks.map((t) => t.id).sort(),
    ["code-symbol-extraction", "context-pack-ranking", "docs-to-code-linking", "freshness-gate"],
    "kawn-self ships its four curated retrieval tasks",
  );

  // every curated task is fully specified and APPROVED — a tracked suite is never a draft
  for (const p of projects) {
    for (const t of p.tasks) {
      assert.ok(t.prompt.trim().length > 0, `${p.id}/${t.id} has a real prompt`);
      assert.ok(t.gold.length > 0, `${p.id}/${t.id} ships a gold set`);
      assert.notEqual(t.goldApproved, false, `${p.id}/${t.id} is not draft (gold is approved)`);
    }
  }
});

// ---------------------------------------------------------------------------
// Gold EXISTENCE validation — refuse to score against files that aren't there.
// (The `scancode.ts` class of bug: a gold path left behind after a rename.)
// ---------------------------------------------------------------------------

test("findMissingGold flags gold that doesn't exist and leaves real files alone", () => {
  const root = mkTmp("kawn-gold-");
  try {
    fs.mkdirSync(path.join(root, "proj", "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "proj", "src", "real.ts"), "export const x = 1;\n", "utf8");

    const projects = [
      {
        id: "p",
        path: "proj",
        tasks: [
          { id: "ok", gold: ["src/real.ts"] },
          { id: "stale", gold: ["src/real.ts", "src/ghost.ts"] },
        ],
      },
    ];

    const missing = findMissingGold(projects, root);
    assert.equal(missing.length, 1, "only the task naming a nonexistent file is flagged");
    assert.equal(missing[0].project, "p");
    assert.equal(missing[0].task, "stale");
    assert.deepEqual(missing[0].missing, ["src/ghost.ts"], "the real file is not reported, only the ghost");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("findMissingGold skips empty/whitespace gold (ad-hoc projects aren't penalized)", () => {
  const root = mkTmp("kawn-gold-");
  try {
    fs.mkdirSync(path.join(root, "proj"), { recursive: true });
    const projects = [
      { id: "p", path: "proj", tasks: [{ id: "explore", gold: [] }, { id: "blank", gold: ["", "   "] }] },
    ];
    assert.deepEqual(findMissingGold(projects, root), [], "no gold entries → nothing to validate, nothing flagged");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("assertGoldExists throws naming the offender, passes when every gold file is real", () => {
  const root = mkTmp("kawn-gold-");
  try {
    fs.mkdirSync(path.join(root, "proj"), { recursive: true });
    fs.writeFileSync(path.join(root, "proj", "real.ts"), "x\n", "utf8");

    assert.doesNotThrow(() => assertGoldExists([{ id: "p", path: "proj", tasks: [{ id: "t", gold: ["real.ts"] }] }], root));

    const bad = [{ id: "p", path: "proj", tasks: [{ id: "t", gold: ["ghost.ts"] }] }];
    assert.throws(() => assertGoldExists(bad, root), /do not exist on disk/i, "a missing gold file is a hard error");
    assert.throws(() => assertGoldExists(bad, root), /p\/t: ghost\.ts/, "the error names exactly which entry to fix");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("loadProjectsFile refuses a suite whose gold names a nonexistent file", () => {
  const root = mkTmp("kawn-bench-suite-");
  try {
    fs.mkdirSync(path.join(root, "proj", "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "proj", "src", "real.ts"), "x\n", "utf8");
    const file = path.join(root, "projects.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        projects: [
          { id: "p", path: "proj", tasks: [{ id: "t", prompt: "do", gold: ["src/real.ts", "src/ghost.ts"], mode: "retrieval" }] },
        ],
      }),
      "utf8",
    );
    assert.throws(() => loadProjectsFile(file, root), /do not exist on disk/i, "scoring against a missing gold file is blocked at load");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("loadProjectsFile validates gold on the raw path, then normalizes it to lowercase", () => {
  const root = mkTmp("kawn-bench-suite-");
  try {
    // The on-disk file keeps its real casing; validation must check the RAW path
    // (not the lowercased `norm` form), or it would false-negative on a
    // case-sensitive filesystem. After validation the gold is normalized.
    fs.mkdirSync(path.join(root, "proj", "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "proj", "src", "Real.ts"), "x\n", "utf8");
    const file = path.join(root, "projects.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        projects: [{ id: "p", path: "proj", tasks: [{ id: "t", prompt: "do", gold: ["src/Real.ts"], mode: "retrieval" }] }],
      }),
      "utf8",
    );
    const projects = loadProjectsFile(file, root);
    assert.equal(projects.length, 1);
    assert.deepEqual(projects[0].tasks[0].gold, ["src/real.ts"], "gold is normalized to lowercase posix after the existence check");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
