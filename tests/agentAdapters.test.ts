import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createLogger, type Logger } from "@kawngraph/shared";
import {
  planSetup,
  applySetup,
  disconnectAgent,
  detectAgents,
  resolveSelection,
  ADAPTERS,
  ALL_AGENT_IDS,
  AUTO_AGENT_IDS,
  getAdapter,
  type McpLaunchSpec,
} from "@kawngraph/agents";
import { mkTmp } from "./helpers";

const log: Logger = createLogger("silent");
const LAUNCH: Partial<McpLaunchSpec> = { command: "node", source: "npx", portable: true };
const readJson = (p: string): any => JSON.parse(fs.readFileSync(p, "utf8"));
const rm = (root: string) => fs.rmSync(root, { recursive: true, force: true });

// ---------------------------------------------------------------------------
// Capability model + registry
// ---------------------------------------------------------------------------

test("registry exposes the full adapter set with a coherent capability model", () => {
  assert.equal(ADAPTERS.length, 8);
  assert.deepEqual(
    ADAPTERS.map((a) => a.id),
    ["claude", "codex", "cursor", "copilot", "gemini", "aider", "generic", "local"],
  );
  for (const a of ADAPTERS) {
    assert.ok(["mcp", "context-file", "export", "local-llm"].includes(a.kind), `${a.id} has a valid kind`);
    assert.equal(typeof a.supports.mcp, "boolean");
    assert.equal(typeof a.supports.promptExport, "boolean");
    assert.ok(a.configFormat.verifiedOn && a.configFormat.docUrl, `${a.id} records a verified format + source`);
  }
  // MCP adapters advertise mcp; non-MCP advertise a non-MCP delivery.
  for (const id of ["claude", "codex", "cursor", "copilot", "gemini"]) assert.equal(getAdapter(id as never).supports.mcp, true);
  for (const id of ["aider", "generic", "local"]) assert.equal(getAdapter(id as never).supports.mcp, false);
});

test("generic and local are opt-in; the rest are auto-selectable", () => {
  assert.equal(getAdapter("generic").autoSelectable, false);
  assert.equal(getAdapter("local").autoSelectable, false);
  assert.deepEqual(AUTO_AGENT_IDS, ["claude", "codex", "cursor", "copilot", "gemini", "aider"]);
  // `all` installs only the auto-selectable set — never generic/local.
  const sel = resolveSelection("all", []);
  assert.deepEqual(sel.agents, AUTO_AGENT_IDS);
  assert.ok(!sel.agents.includes("generic" as never) && !sel.agents.includes("local" as never));
  assert.equal(ALL_AGENT_IDS.length, 8);
});

// ---------------------------------------------------------------------------
// Copilot — the `servers` (not `mcpServers`) key
// ---------------------------------------------------------------------------

test("copilot writes .vscode/mcp.json under the top-level `servers` key", async () => {
  const root = mkTmp("kawn-copilot-");
  await applySetup({ root, selector: "copilot", logger: log, launchOverride: LAUNCH });
  const cfg = readJson(path.join(root, ".vscode", "mcp.json"));
  assert.ok(cfg.servers && cfg.servers.kawn, "Copilot uses `servers`, not `mcpServers`");
  assert.equal(cfg.mcpServers, undefined, "must NOT use mcpServers for Copilot");
  assert.equal(cfg.servers.kawn.type, "stdio");
  assert.equal(cfg.servers.kawn.command, "node");
  rm(root);
});

test("gemini writes .gemini/settings.json under `mcpServers` with no type", async () => {
  const root = mkTmp("kawn-gemini-");
  await applySetup({ root, selector: "gemini", logger: log, launchOverride: LAUNCH });
  const cfg = readJson(path.join(root, ".gemini", "settings.json"));
  assert.ok(cfg.mcpServers.kawn);
  assert.equal(cfg.mcpServers.kawn.type, undefined);
  rm(root);
});

// ---------------------------------------------------------------------------
// Config merge + no-overwrite + backup + dry-run (Copilot's servers-key path)
// ---------------------------------------------------------------------------

test("config merge preserves unrelated servers and keys", async () => {
  const root = mkTmp("kawn-merge-");
  fs.mkdirSync(path.join(root, ".vscode"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".vscode", "mcp.json"),
    JSON.stringify({ servers: { playwright: { command: "x" } }, inputs: [{ id: "k" }] }, null, 2),
  );
  await applySetup({ root, selector: "copilot", logger: log, launchOverride: LAUNCH });
  const cfg = readJson(path.join(root, ".vscode", "mcp.json"));
  assert.ok(cfg.servers.kawn, "added our entry");
  assert.deepEqual(cfg.servers.playwright, { command: "x" }, "preserved a foreign server");
  assert.deepEqual(cfg.inputs, [{ id: "k" }], "preserved an unrelated top-level key");
  rm(root);
});

test("never overwrites a foreign `kawn` entry without --force; backs up on change", async () => {
  const root = mkTmp("kawn-noover-");
  fs.mkdirSync(path.join(root, ".vscode"), { recursive: true });
  fs.writeFileSync(path.join(root, ".vscode", "mcp.json"), JSON.stringify({ servers: { kawn: { command: "THEIRS" } } }));
  // Without --force: blocked, nothing written.
  const blockedPlan = await planSetup({ root, selector: "copilot", logger: log, launchOverride: LAUNCH });
  assert.ok(blockedPlan.plans[0].blocked, "a foreign kawn entry blocks without --force");
  // With --force: replaces, and the prior file is backed up.
  const report = await applySetup({ root, selector: "copilot", force: true, logger: log, launchOverride: LAUNCH });
  const cfg = readJson(path.join(root, ".vscode", "mcp.json"));
  assert.equal(cfg.servers.kawn.command, "node", "--force replaced the foreign entry");
  assert.equal(Object.keys(report.results[0].backups).length, 1, "the overwritten file was backed up");
  rm(root);
});

test("plan/dry-run computes actions without writing", async () => {
  const root = mkTmp("kawn-dry-");
  const plan = await planSetup({ root, selector: "copilot", logger: log, launchOverride: LAUNCH });
  assert.equal(plan.plans[0].files[0].action, "create");
  assert.ok(plan.plans[0].files[0].preview && plan.plans[0].files[0].preview.includes('"servers"'));
  assert.equal(fs.existsSync(path.join(root, ".vscode", "mcp.json")), false, "dry plan wrote nothing");
  rm(root);
});

// ---------------------------------------------------------------------------
// Owned-file adapters: generic (export), aider (context file), local (config)
// ---------------------------------------------------------------------------

test("generic export writes a USING-KAWN.md describing `kawn pack`", async () => {
  const root = mkTmp("kawn-generic-");
  const report = await applySetup({ root, selector: "generic", logger: log, launchOverride: LAUNCH });
  const file = path.join(root, ".kawn", "agent-context", "USING-KAWN.md");
  assert.ok(fs.existsSync(file));
  assert.match(fs.readFileSync(file, "utf8"), /kawn pack/);
  assert.ok(report.results[0].changed);
  // detection now reports it installed
  const det = (await detectAgents(root)).find((d) => d.agent === "generic")!;
  assert.equal(det.installed, true);
  rm(root);
});

test("aider writes a context file under .kawn/agent-context and is reversible", async () => {
  const root = mkTmp("kawn-aider-");
  await applySetup({ root, selector: "aider", logger: log, launchOverride: LAUNCH });
  const file = path.join(root, ".kawn", "agent-context", "kawn-context.md");
  assert.ok(fs.existsSync(file));
  const un = await disconnectAgent("aider", { root, logger: log, launchOverride: LAUNCH });
  assert.equal(un.changed, true);
  assert.equal(fs.existsSync(file), false, "uninstall removed the KawnGraph-created file");
  rm(root);
});

test("local provider config requires --provider and records the right endpoint", async () => {
  const root = mkTmp("kawn-local-");
  // No provider → blocked, nothing written.
  const blocked = await applySetup({ root, selector: "local", logger: log, launchOverride: LAUNCH });
  assert.equal(blocked.blocked.length, 1, "local without --provider is blocked");
  assert.equal(fs.existsSync(path.join(root, ".kawn", "local-llm.json")), false);
  // With provider → writes the OpenAI-compatible endpoint config.
  await applySetup({ root, selector: "local", options: { provider: "ollama" }, logger: log, launchOverride: LAUNCH });
  const cfg = readJson(path.join(root, ".kawn", "local-llm.json"));
  assert.equal(cfg.provider, "ollama");
  assert.equal(cfg.baseUrl, "http://localhost:11434/v1");
  assert.deepEqual(cfg.neverUsedFor, ["scanning", "required-retrieval"], "config is explicit that scanning never uses it");
  // lmstudio endpoint
  const root2 = mkTmp("kawn-local2-");
  await applySetup({ root: root2, selector: "local", options: { provider: "lmstudio" }, logger: log, launchOverride: LAUNCH });
  assert.equal(readJson(path.join(root2, ".kawn", "local-llm.json")).baseUrl, "http://localhost:1234/v1");
  rm(root);
  rm(root2);
});

// ---------------------------------------------------------------------------
// Detection + nested-path safety (.vscode / .gemini / .kawn/agent-context)
// ---------------------------------------------------------------------------

test("detection keys off agent-specific signals, not generic dirs", async () => {
  const root = mkTmp("kawn-detect-");
  fs.mkdirSync(path.join(root, ".github"), { recursive: true });
  fs.writeFileSync(path.join(root, ".github", "copilot-instructions.md"), "# hi");
  fs.mkdirSync(path.join(root, ".gemini"), { recursive: true });
  fs.writeFileSync(path.join(root, ".aider.conf.yml"), "model: x");
  const det = await detectAgents(root);
  const by = new Map(det.map((d) => [d.agent, d]));
  assert.equal(by.get("copilot")!.present, true, "copilot detected via .github/copilot-instructions.md");
  assert.equal(by.get("gemini")!.present, true, "gemini detected via .gemini/");
  assert.equal(by.get("aider")!.present, true, "aider detected via .aider.conf.yml");
  // auto-selection only picks present + auto-selectable agents (never generic/local)
  const sel = resolveSelection("auto", det);
  assert.ok(sel.agents.includes("copilot" as never));
  assert.ok(!sel.agents.includes("generic" as never));
  assert.ok(!sel.agents.includes("local" as never));
  rm(root);
});

test("nested config paths are created safely under the root (cross-platform)", async () => {
  const root = mkTmp("kawn-paths-");
  await applySetup({ root, selector: "copilot", logger: log, launchOverride: LAUNCH });
  await applySetup({ root, selector: "gemini", logger: log, launchOverride: LAUNCH });
  await applySetup({ root, selector: "generic", logger: log, launchOverride: LAUNCH });
  for (const rel of [[".vscode", "mcp.json"], [".gemini", "settings.json"], [".kawn", "agent-context", "USING-KAWN.md"]]) {
    assert.ok(fs.existsSync(path.join(root, ...rel)), `${rel.join("/")} created under root`);
  }
  rm(root);
});
