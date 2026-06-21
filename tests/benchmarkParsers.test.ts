import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseClaudeLines,
  parseCodexLines,
  classifyTool,
  isKawnTool,
  norm,
  relToRoot,
  toToolCall,
  claudeChildEnv,
  codexChildEnv,
} from "@kawngraph/benchmark";

const CWD = "/proj";
const line = (atMs: number, obj: unknown) => ({ atMs, text: JSON.stringify(obj) });

// ---------------------------------------------------------------------------
// Claude stream-json parser
// ---------------------------------------------------------------------------

test("parseClaudeLines extracts ordered, timestamped tool calls and the result", () => {
  const lines = [
    line(0, { type: "system", subtype: "init" }),
    line(100, {
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "mcp__kawn__kawn_context", input: { task: "x" } }] },
    }),
    line(1200, {
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "thinking" },
          { type: "tool_use", name: "Read", input: { file_path: "/proj/src/lib/oauth.ts" } },
        ],
      },
    }),
    line(1500, {
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Grep", input: { pattern: "foo", path: "/proj/src/x.ts" } }] },
    }),
    line(2000, {
      type: "result",
      subtype: "success",
      is_error: false,
      result: "Done. See src/lib/oauth.ts",
      duration_ms: 1900,
      num_turns: 3,
      total_cost_usd: 0.012,
      usage: { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 10, cache_creation_input_tokens: 5 },
    }),
    { atMs: 2001, text: "not json {" }, // malformed → skipped, must not throw
    { atMs: 2002, text: "plain log line" }, // non-JSON → skipped
  ];

  const { tools, final } = parseClaudeLines(lines, CWD);

  assert.equal(tools.length, 3, "three tool_use blocks across assistant events");
  assert.deepEqual(tools[0], { name: "mcp__kawn__kawn_context", kind: "kawn", kawn: true, file: undefined, atMs: 100 });
  assert.deepEqual(tools[1], { name: "Read", kind: "read", kawn: false, file: "src/lib/oauth.ts", atMs: 1200 });
  assert.deepEqual(tools[2], { name: "Grep", kind: "grep", kawn: false, file: "src/x.ts", atMs: 1500 });

  assert.ok(final, "a result event is captured");
  assert.equal(final!.is_error, false);
  assert.equal(final!.result, "Done. See src/lib/oauth.ts");
  assert.equal(final!.duration_ms, 1900);
  assert.equal(final!.num_turns, 3);
  assert.equal(final!.usage?.input_tokens, 100);
});

test("parseClaudeLines surfaces an API error result (auth wall) verbatim", () => {
  const lines = [
    line(10, { type: "result", subtype: "error", is_error: true, api_error_status: 401, result: "Invalid API key" }),
  ];
  const { tools, final } = parseClaudeLines(lines, CWD);
  assert.equal(tools.length, 0);
  assert.equal(final!.is_error, true);
  assert.equal(final!.api_error_status, 401);
});

test("parseClaudeLines returns no result when the stream is empty", () => {
  const { tools, final } = parseClaudeLines([], CWD);
  assert.equal(tools.length, 0);
  assert.equal(final, null);
});

// ---------------------------------------------------------------------------
// Codex JSONL parser — real thread/turn/item envelope schema (CLI 0.141.0)
// ---------------------------------------------------------------------------

test("parseCodexLines parses the real thread/turn/item envelope schema", () => {
  const lines = [
    { atMs: 1, text: "garbage-not-json" }, // tolerated, no crash
    line(2, { type: "thread.started", thread_id: "th_1" }),
    line(3, { type: "turn.started" }),
    line(10, { type: "item.completed", item: { id: "i0", type: "agent_message", text: "I'll inspect the files." } }),
    // a search via rg that ALSO opens a concrete file; arrives twice (start+done)
    line(20, { type: "item.started", item: { id: "i1", type: "command_execution", command: 'rg -n "^" src/lib/oauth.ts', status: "in_progress" } }),
    line(40, { type: "item.completed", item: { id: "i1", type: "command_execution", command: 'rg -n "^" src/lib/oauth.ts', exit_code: 0, status: "completed" } }),
    // a PowerShell Get-Content read DECLINED by the sandbox → credited no file
    line(50, { type: "item.completed", item: { id: "i2", type: "command_execution", command: `"C:\\\\powershell.exe" -Command "Get-Content -LiteralPath 'src/lib/merchantAuth.ts'"`, status: "declined" } }),
    // an KawnGraph MCP tool call
    line(60, { type: "item.completed", item: { id: "i3", type: "mcp_tool_call", server: "kawn", tool: "kawn_context", arguments: { task: "x" } } }),
    // final answer — last agent_message wins
    line(70, { type: "item.completed", item: { id: "i4", type: "agent_message", text: "Files: src/lib/oauth.ts" } }),
    line(80, { type: "turn.completed", usage: { input_tokens: 84143, cached_input_tokens: 71936, output_tokens: 1108, reasoning_output_tokens: 245 } }),
  ];

  const parsed = parseCodexLines(lines, CWD);

  assert.equal(parsed.sawAny, true);
  assert.equal(parsed.diag.threadId, "th_1");
  assert.equal(parsed.numTurns, 1);
  assert.equal(parsed.answer, "Files: src/lib/oauth.ts", "last agent_message wins");

  // usage, including reasoning tokens, captured from turn.completed
  assert.equal(parsed.tokens.input, 84143);
  assert.equal(parsed.tokens.output, 1108);
  assert.equal(parsed.tokens.cacheRead, 71936);
  assert.equal(parsed.tokens.reasoning, 245);

  // rg: a search that also opened the concrete file, dedup'd to ONE tool call,
  // timestamped when it BEGAN
  const rg = parsed.tools.filter((t) => t.kind === "grep");
  assert.equal(rg.length, 1, "command_execution emitted once despite start+completed");
  assert.equal(rg[0].file, "src/lib/oauth.ts");
  assert.equal(rg[0].atMs, 20, "timestamped at item.started");

  // declined Get-Content: counted, but credited no file
  assert.equal(parsed.diag.declinedCommands, 1);
  assert.ok(!parsed.tools.some((t) => t.file === "src/lib/merchantauth.ts"), "declined command opens no file");

  // kawn MCP call recognized and flagged
  assert.ok(parsed.tools.some((t) => t.kawn && t.name === "mcp__kawn__kawn_context"), "kawn MCP call");
});

test("parseCodexLines records unknown kinds as diagnostics (no crash, no false zero)", () => {
  const parsed = parseCodexLines(
    [
      line(0, { type: "thread.started", thread_id: "t" }),
      line(1, { type: "item.completed", item: { id: "x", type: "web_search", query: "foo" } }),
      line(2, { type: "some.future.event", foo: 1 }),
      line(3, { type: "turn.completed", usage: { input_tokens: 5, output_tokens: 2 } }),
    ],
    CWD,
  );
  assert.deepEqual(parsed.diag.unknownItemTypes, ["web_search"]);
  assert.deepEqual(parsed.diag.unknownEventTypes, ["some.future.event"]);
  assert.equal(parsed.tools.length, 0, "no tool fabricated from an unknown kind");
});

test("parseCodexLines tolerates a flat/legacy schema and a standalone usage event", () => {
  const parsed = parseCodexLines(
    [
      line(50, { type: "command_execution", command: ["cat", "src/a.ts"] }),
      line(120, { type: "mcp_tool_call", server: "kawn", tool: "kawn_context", arguments: { task: "x" } }),
      line(300, { type: "file_change", changes: [{ path: "src/b.ts" }] }),
      line(400, { type: "file_read", path: "src/c.ts" }),
      line(500, { type: "token_count", usage: { input_tokens: 50, output_tokens: 20 } }),
      line(600, { type: "agent_message", text: "final answer here" }),
    ],
    CWD,
  );
  assert.equal(parsed.answer, "final answer here");
  assert.equal(parsed.tokens.input, 50, "fallback usage when no turn.completed");
  assert.equal(parsed.tokens.output, 20);
  assert.ok(parsed.tools.some((t) => t.kind === "read" && t.file === "src/a.ts"), "cat → read of a file");
  assert.ok(parsed.tools.some((t) => t.kawn === true && t.name === "mcp__kawn__kawn_context"), "kawn MCP call");
  assert.ok(parsed.tools.some((t) => t.kind === "edit" && t.file === "src/b.ts"), "file change → edit");
  assert.ok(parsed.tools.some((t) => t.kind === "read" && t.file === "src/c.ts"), "file read");
});

test("parseCodexLines reports an auth error without throwing", () => {
  const parsed = parseCodexLines([line(0, { type: "error", error: "401 unauthorized: please login" })], CWD);
  assert.equal(parsed.sawAny, true);
  assert.ok(parsed.errorText && /401/.test(parsed.errorText), "error text captured");
});

// ---------------------------------------------------------------------------
// Shared normalization helpers (both adapters rely on these)
// ---------------------------------------------------------------------------

test("classifyTool maps native tool names to normalized families", () => {
  assert.equal(classifyTool("Read"), "read");
  assert.equal(classifyTool("Grep"), "grep");
  assert.equal(classifyTool("Glob"), "glob");
  assert.equal(classifyTool("Edit"), "edit");
  assert.equal(classifyTool("Write"), "write");
  assert.equal(classifyTool("Bash"), "bash");
  assert.equal(classifyTool("mcp__kawn__kawn_context"), "kawn");
  assert.equal(classifyTool("apply_patch"), "edit");
});

test("isKawnTool recognizes both the MCP-prefixed and bare kawn tool names", () => {
  assert.equal(isKawnTool("mcp__kawn__kawn_query"), true);
  assert.equal(isKawnTool("kawn_affected"), true);
  assert.equal(isKawnTool("Read"), false);
});

test("norm and relToRoot produce stable, comparable repo-relative paths", () => {
  assert.equal(norm("C:\\proj\\Src\\A.TS"), "proj/src/a.ts");
  assert.equal(relToRoot("/proj/src/x.ts", "/proj"), "src/x.ts");
  assert.equal(relToRoot("/other/y.ts", "/proj"), "other/y.ts");
});

test("toToolCall relativizes the touched file against the session cwd", () => {
  assert.deepEqual(toToolCall("Read", { file_path: "/proj/a.ts" }, "/proj", 5), {
    name: "Read",
    kind: "read",
    kawn: false,
    file: "a.ts",
    atMs: 5,
  });
});

// ---------------------------------------------------------------------------
// Subscription-only child env — the safety mechanism behind "no API key".
//
// Both adapters strip every API key from the child environment so a key present
// in the PARENT environment can never silently turn a "subscription" run into a
// metered API run (which would both bill the user and invalidate the A/B
// methodology). These pin that guarantee.
// ---------------------------------------------------------------------------

/** Run `fn` with the given env vars forced, restoring the prior values after. */
function withEnv(vars: Record<string, string>, fn: () => void): void {
  const prior: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    prior[k] = process.env[k];
    process.env[k] = vars[k];
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (prior[k] === undefined) delete process.env[k];
      else process.env[k] = prior[k];
    }
  }
}

test("claudeChildEnv strips every API key and never mutates process.env", () => {
  withEnv(
    { ANTHROPIC_API_KEY: "sk-ant-leak", ANTHROPIC_AUTH_TOKEN: "tok-leak", OPENAI_API_KEY: "sk-openai-leak", PATH: process.env.PATH ?? "" },
    () => {
      const env = claudeChildEnv();
      assert.equal(env.ANTHROPIC_API_KEY, undefined, "Anthropic API key is stripped from the session");
      assert.equal(env.ANTHROPIC_AUTH_TOKEN, undefined, "Anthropic auth token is stripped");
      assert.equal(env.OPENAI_API_KEY, undefined, "a stray OpenAI key is stripped too");
      assert.equal(env.PATH, process.env.PATH, "innocuous vars like PATH are preserved");
      // the real process env is untouched — only the child's copy is scrubbed
      assert.equal(process.env.ANTHROPIC_API_KEY, "sk-ant-leak", "process.env itself is not mutated");
    },
  );
});

test("codexChildEnv strips API keys, isolates CODEX_HOME, and never mutates process.env", () => {
  withEnv(
    { OPENAI_API_KEY: "sk-openai-leak", ANTHROPIC_API_KEY: "sk-ant-leak" },
    () => {
      const env = codexChildEnv("/tmp/iso-home");
      assert.equal(env.OPENAI_API_KEY, undefined, "OpenAI API key is stripped — Codex must use ChatGPT sign-in");
      assert.equal(env.ANTHROPIC_API_KEY, undefined, "a stray Anthropic key is stripped too");
      assert.equal(env.CODEX_HOME, "/tmp/iso-home", "the session is pointed at the isolated, throwaway home");
      assert.equal(process.env.OPENAI_API_KEY, "sk-openai-leak", "process.env itself is not mutated");
      assert.equal(process.env.CODEX_HOME, undefined, "the isolated home never leaks back to the parent");
    },
  );
});
