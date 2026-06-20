import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createLogger, type Logger } from "@athar/shared";
import {
  planSetup,
  applySetup,
  disconnectAgent,
  detectAgents,
  resolveSelection,
  getIntegration,
  readIntegrations,
  runDoctor,
  doctorExitCode,
  backupsDir,
  renderMcpServerBlock,
  upsertTomlTable,
  removeTomlTable,
  hasTomlTable,
  hasInlineMcpServer,
  type McpLaunchSpec,
} from "@athar/agents";
import { mkTmp } from "./helpers";

// A silent logger and a deterministic, "portable" launch so generated config and
// notes are stable — no dependence on what Athar resolves on this machine.
const log: Logger = createLogger("silent");
const LAUNCH: Partial<McpLaunchSpec> = { command: "node", source: "npx", portable: true };

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// ---------------------------------------------------------------------------
// Adapters: each writes exactly the verified shape for its agent.
// ---------------------------------------------------------------------------

test("claude install writes .mcp.json with a stdio mcpServers.athar entry", async () => {
  const root = mkTmp("athar-claude-");
  await applySetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  const cfg = readJson(path.join(root, ".mcp.json"));
  assert.ok(cfg.mcpServers && cfg.mcpServers.athar, "mcpServers.athar must exist");
  assert.equal(cfg.mcpServers.athar.type, "stdio", "Claude entries carry type:stdio");
  assert.equal(cfg.mcpServers.athar.command, "node");
  assert.deepEqual(cfg.mcpServers.athar.args, ["--root", path.resolve(root)]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("cursor install writes .cursor/mcp.json WITHOUT a type field", async () => {
  const root = mkTmp("athar-cursor-");
  await applySetup({ root, selector: "cursor", logger: log, launchOverride: LAUNCH });
  const cfg = readJson(path.join(root, ".cursor", "mcp.json"));
  assert.ok(cfg.mcpServers.athar, "mcpServers.athar must exist");
  assert.equal(cfg.mcpServers.athar.type, undefined, "Cursor entries omit the type field");
  assert.equal(cfg.mcpServers.athar.command, "node");
  fs.rmSync(root, { recursive: true, force: true });
});

test("codex install writes .codex/config.toml with an [mcp_servers.athar] table", async () => {
  const root = mkTmp("athar-codex-");
  await applySetup({ root, selector: "codex", logger: log, launchOverride: LAUNCH });
  const toml = fs.readFileSync(path.join(root, ".codex", "config.toml"), "utf8");
  assert.match(toml, /\[mcp_servers\.athar\]/);
  assert.match(toml, /command = "node"/);
  assert.match(toml, /args = \["--root",/);
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Idempotency: a second run is an exact no-op.
// ---------------------------------------------------------------------------

test("re-running setup is idempotent (plan unchanged, nothing rewritten)", async () => {
  const root = mkTmp("athar-idem-");
  await applySetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  const before = fs.readFileSync(path.join(root, ".mcp.json"), "utf8");

  const plan = await planSetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  assert.equal(plan.plans[0].alreadyInstalled, true);
  assert.equal(plan.plans[0].files[0].action, "unchanged");

  const report = await applySetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  assert.equal(report.results[0].changed, false, "second install must not change the file");
  const after = fs.readFileSync(path.join(root, ".mcp.json"), "utf8");
  assert.equal(after, before, "file bytes unchanged on idempotent re-run");
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Never overwrite unrelated config; every change is reversible.
// ---------------------------------------------------------------------------

test("install preserves a pre-existing server and unrelated top-level keys", async () => {
  const root = mkTmp("athar-preserve-");
  fs.writeFileSync(
    path.join(root, ".mcp.json"),
    JSON.stringify(
      { mcpServers: { other: { type: "stdio", command: "node", args: ["other.js"] } }, keepMe: { a: 1 } },
      null,
      2,
    ),
    "utf8",
  );
  await applySetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  const cfg = readJson(path.join(root, ".mcp.json"));
  assert.ok(cfg.mcpServers.other, "unrelated server preserved");
  assert.ok(cfg.mcpServers.athar, "athar added");
  assert.deepEqual(cfg.keepMe, { a: 1 }, "unrelated top-level key preserved");

  // ... and disconnect restores exactly the user's content.
  const un = await disconnectAgent("claude", { root, logger: log, launchOverride: LAUNCH });
  assert.equal(un.changed, true);
  const after = readJson(path.join(root, ".mcp.json"));
  assert.equal(after.mcpServers.athar, undefined, "athar removed");
  assert.ok(after.mcpServers.other, "unrelated server still present after disconnect");
  assert.deepEqual(after.keepMe, { a: 1 }, "unrelated top-level key still present");
  fs.rmSync(root, { recursive: true, force: true });
});

test("disconnect backs up the file it edits before removing Athar's entry", async () => {
  const root = mkTmp("athar-backup-");
  fs.writeFileSync(
    path.join(root, ".mcp.json"),
    JSON.stringify({ mcpServers: { other: { command: "x", args: [] } } }, null, 2),
    "utf8",
  );
  await applySetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  await disconnectAgent("claude", { root, logger: log, launchOverride: LAUNCH });
  const backups = fs.existsSync(backupsDir(root)) ? fs.readdirSync(backupsDir(root)) : [];
  assert.ok(backups.length >= 1, "a backup of the edited file should exist");
  fs.rmSync(root, { recursive: true, force: true });
});

test("round-trip on a self-created file leaves no trace (file + empty dir removed)", async () => {
  const root = mkTmp("athar-roundtrip-");
  await applySetup({ root, selector: "cursor", logger: log, launchOverride: LAUNCH });
  assert.ok(fs.existsSync(path.join(root, ".cursor", "mcp.json")));
  await disconnectAgent("cursor", { root, logger: log, launchOverride: LAUNCH });
  assert.equal(fs.existsSync(path.join(root, ".cursor", "mcp.json")), false, "self-created file removed");
  assert.equal(fs.existsSync(path.join(root, ".cursor")), false, "now-empty self-created dir removed");
  fs.rmSync(root, { recursive: true, force: true });
});

test("disconnect keeps a non-empty agent dir that holds unrelated user files", async () => {
  const root = mkTmp("athar-keepdir-");
  await applySetup({ root, selector: "cursor", logger: log, launchOverride: LAUNCH });
  fs.writeFileSync(path.join(root, ".cursor", "rules.md"), "user content", "utf8");
  await disconnectAgent("cursor", { root, logger: log, launchOverride: LAUNCH });
  assert.equal(fs.existsSync(path.join(root, ".cursor", "mcp.json")), false, "our file removed");
  assert.ok(fs.existsSync(path.join(root, ".cursor", "rules.md")), "unrelated user file preserved");
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Refuse to clobber foreign entries / malformed files.
// ---------------------------------------------------------------------------

test("a pre-existing foreign 'athar' entry blocks install unless --force", async () => {
  const root = mkTmp("athar-foreign-");
  const file = path.join(root, ".mcp.json");
  fs.writeFileSync(
    file,
    JSON.stringify({ mcpServers: { athar: { command: "not-ours", args: [] } } }, null, 2),
    "utf8",
  );
  const blocked = await planSetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  assert.ok(blocked.plans[0].blocked, "must refuse to overwrite a foreign athar entry");
  assert.match(blocked.plans[0].blocked!, /force/i);
  // The file is untouched by planning.
  assert.equal(readJson(file).mcpServers.athar.command, "not-ours");

  const forced = await planSetup({ root, selector: "claude", logger: log, force: true, launchOverride: LAUNCH });
  assert.equal(forced.plans[0].blocked, undefined, "--force allows replacing it");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a malformed JSON config is refused and left untouched", async () => {
  const root = mkTmp("athar-malformed-");
  const file = path.join(root, ".mcp.json");
  fs.writeFileSync(file, "{ this is not json", "utf8");
  const plan = await planSetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  assert.ok(plan.plans[0].blocked, "malformed JSON must block");
  assert.match(plan.plans[0].blocked!, /JSON/i);
  assert.equal(fs.readFileSync(file, "utf8"), "{ this is not json", "file left byte-for-byte intact");
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Integration manifest records and clears ownership.
// ---------------------------------------------------------------------------

test("applySetup records an integration; disconnect removes it", async () => {
  const root = mkTmp("athar-manifest-");
  await applySetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  const rec = await getIntegration(root, "claude", "project");
  assert.ok(rec, "integration recorded");
  assert.ok(rec!.files.includes(".mcp.json"), "records the file it manages");
  assert.equal(rec!.scope, "project");

  await disconnectAgent("claude", { root, logger: log, launchOverride: LAUNCH });
  assert.ok(!(await getIntegration(root, "claude", "project")), "record cleared on disconnect");
  const man = await readIntegrations(root);
  assert.equal(man.integrations.find((i) => i.agent === "claude"), undefined);
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Detection + selection.
// ---------------------------------------------------------------------------

test("detectAgents reports an installed agent; resolveSelection honours the selector", async () => {
  const root = mkTmp("athar-detect-");
  await applySetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  const detected = await detectAgents(root, "project");
  const claude = detected.find((d) => d.agent === "claude")!;
  assert.equal(claude.installed, true, "claude detected as installed");
  assert.equal(claude.present, true);

  assert.deepEqual(resolveSelection("claude", detected).agents, ["claude"], "specific selector");
  assert.ok(resolveSelection("all", detected).agents.includes("claude"), "all includes detected");
  assert.ok(resolveSelection("auto", detected).agents.includes("claude"), "auto includes installed");
  fs.rmSync(root, { recursive: true, force: true });
});

test("auto selection on a bare project selects nothing and explains why", async () => {
  const root = mkTmp("athar-auto-empty-");
  const detected = await detectAgents(root, "project");
  const sel = resolveSelection("auto", detected);
  assert.equal(sel.agents.length, 0, "no agents present → none selected");
  assert.ok(sel.note && sel.note.length > 0, "explains that nothing was detected");
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Honesty: a non-portable launch is flagged in the notes.
// ---------------------------------------------------------------------------

test("a machine-specific (non-portable) launch is surfaced as a note", async () => {
  const root = mkTmp("athar-portable-");
  const report = await applySetup({
    root,
    selector: "claude",
    logger: log,
    launchOverride: { command: "node", source: "local-node", portable: false },
  });
  const notes = report.results.flatMap((r) => r.notes);
  assert.ok(notes.some((n) => /not portable/i.test(n)), "warns the generated command is machine-specific");
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// disconnect-after-edit: only Athar's block goes; the user's edits stay.
// ---------------------------------------------------------------------------

test("codex disconnect preserves a user table and comment added after install", async () => {
  const root = mkTmp("athar-codex-edit-");
  const file = path.join(root, ".codex", "config.toml");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "# user header comment\n[other]\nkey = 1\n", "utf8");
  await applySetup({ root, selector: "codex", logger: log, launchOverride: LAUNCH });
  let toml = fs.readFileSync(file, "utf8");
  assert.match(toml, /\[other\]/);
  assert.match(toml, /\[mcp_servers\.athar\]/);

  await disconnectAgent("codex", { root, logger: log, launchOverride: LAUNCH });
  toml = fs.readFileSync(file, "utf8");
  assert.match(toml, /# user header comment/, "user comment preserved");
  assert.match(toml, /\[other\]/, "unrelated table preserved");
  assert.match(toml, /key = 1/);
  assert.doesNotMatch(toml, /\[mcp_servers\.athar\]/, "athar table removed");
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Cross-platform: paths with spaces and non-ASCII characters.
// ---------------------------------------------------------------------------

test("setup works under a path with spaces and non-ASCII characters", async () => {
  const base = mkTmp("athar-unicode-");
  const root = path.join(base, "a b déjà vu ⓐ");
  fs.mkdirSync(root, { recursive: true });
  await applySetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  const cfg = readJson(path.join(root, ".mcp.json"));
  assert.equal(cfg.mcpServers.athar.command, "node");
  assert.equal(cfg.mcpServers.athar.args[0], "--root");
  fs.rmSync(base, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Doctor: read-only health audit, hermetic (no live probe).
// ---------------------------------------------------------------------------

test("doctor reports node PASS and a FAIL when the graph is missing", async () => {
  const root = mkTmp("athar-doctor-");
  const report = await runDoctor({ root, scope: "project", skipProbe: true });
  const node = report.checks.find((c) => c.id === "node-version")!;
  assert.equal(node.status, "pass");
  const graph = report.checks.find((c) => c.id === "graph")!;
  assert.equal(graph.status, "fail", "no graph → fail");
  assert.equal(report.ok, false, "a FAIL makes the report not-ok");
  assert.equal(doctorExitCode(report), 1, "non-zero exit when not healthy");
  fs.rmSync(root, { recursive: true, force: true });
});

test("doctor marks a connected agent as PASS after install", async () => {
  const root = mkTmp("athar-doctor2-");
  await applySetup({ root, selector: "claude", logger: log, launchOverride: LAUNCH });
  const report = await runDoctor({ root, scope: "project", skipProbe: true });
  const claude = report.checks.find((c) => c.id === "agent-claude")!;
  assert.equal(claude.status, "pass", "connected agent is a PASS");
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// safeToml: block-aware editing primitives.
// ---------------------------------------------------------------------------

test("renderMcpServerBlock renders a valid, env-omitting table block", () => {
  const block = renderMcpServerBlock("athar", { command: "node", args: ["--root", "/x"] });
  assert.equal(block.split("\n")[0], "[mcp_servers.athar]");
  assert.match(block, /command = "node"/);
  assert.match(block, /args = \["--root", "\/x"\]/);
  assert.doesNotMatch(block, /env =/, "no env line when env is empty");
});

test("upsertTomlTable inserts, replaces in place, and is an exact no-op when unchanged", () => {
  const block = renderMcpServerBlock("athar", { command: "node", args: ["--root", "/x"] });
  // Insert into a file with an unrelated table + comments.
  const original = "# top\n[tools]\nweb = true\n";
  const ins = upsertTomlTable(original, "mcp_servers.athar", block);
  assert.equal(ins.changed, true);
  assert.match(ins.source, /# top/);
  assert.match(ins.source, /\[tools\]/);
  assert.match(ins.source, /\[mcp_servers\.athar\]/);

  // Re-running with the same block is a byte-exact no-op (the idempotency fix).
  const again = upsertTomlTable(ins.source, "mcp_servers.athar", block);
  assert.equal(again.changed, false, "identical upsert must not change bytes");
  assert.equal(again.action, "unchanged");
  assert.equal(again.source, ins.source);

  // Replacing with a different block edits only our table.
  const block2 = renderMcpServerBlock("athar", { command: "node", args: ["--root", "/y"] });
  const rep = upsertTomlTable(ins.source, "mcp_servers.athar", block2);
  assert.equal(rep.changed, true);
  assert.match(rep.source, /--root", "\/y/);
  assert.match(rep.source, /\[tools\]/, "unrelated table survives a replace");
  assert.match(rep.source, /# top/, "comment survives a replace");
});

test("removeTomlTable removes only its table, keeping comments and other tables", () => {
  const block = renderMcpServerBlock("athar", { command: "node", args: [] });
  const withAthar = upsertTomlTable("# keep me\n[tools]\nweb = true\n", "mcp_servers.athar", block).source;
  const rem = removeTomlTable(withAthar, "mcp_servers.athar");
  assert.equal(rem.changed, true);
  assert.doesNotMatch(rem.source, /\[mcp_servers\.athar\]/);
  assert.match(rem.source, /# keep me/);
  assert.match(rem.source, /\[tools\]/);
  assert.match(rem.source, /web = true/);
  // Removing again is a no-op.
  assert.equal(removeTomlTable(rem.source, "mcp_servers.athar").changed, false);
});

test("hasTomlTable / hasInlineMcpServer classify table vs inline forms", () => {
  const block = renderMcpServerBlock("athar", { command: "node", args: [] });
  const tableForm = upsertTomlTable("", "mcp_servers.athar", block).source;
  assert.equal(hasTomlTable(tableForm, "mcp_servers.athar"), true);
  assert.equal(hasInlineMcpServer(tableForm, "athar"), false, "the block form is not inline");

  // Dotted inline-table form.
  assert.equal(hasInlineMcpServer('mcp_servers.athar = { command = "x" }\n', "athar"), true);
  // Key under an open [mcp_servers] table.
  assert.equal(hasInlineMcpServer("[mcp_servers]\nathar = { command = \"x\" }\n", "athar"), true);
});
