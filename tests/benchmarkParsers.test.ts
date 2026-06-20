import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseClaudeLines,
  parseCodexLines,
  classifyTool,
  isAtharTool,
  norm,
  relToRoot,
  toToolCall,
} from "@athar/benchmark";

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
      message: { content: [{ type: "tool_use", name: "mcp__athar__athar_context", input: { task: "x" } }] },
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
  assert.deepEqual(tools[0], { name: "mcp__athar__athar_context", kind: "athar", athar: true, file: undefined, atMs: 100 });
  assert.deepEqual(tools[1], { name: "Read", kind: "read", athar: false, file: "src/lib/oauth.ts", atMs: 1200 });
  assert.deepEqual(tools[2], { name: "Grep", kind: "grep", athar: false, file: "src/x.ts", atMs: 1500 });

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
// Codex JSON/JSONL parser (best-effort, tolerant)
// ---------------------------------------------------------------------------

test("parseCodexLines normalizes shell, mcp, file-change, file-read, answer, and usage", () => {
  const lines = [
    { atMs: 1, text: "garbage-not-json" }, // tolerated
    line(2, { type: "unknown_event", foo: 1 }), // unknown shape, no crash
    line(50, { type: "command_execution", command: ["cat", "src/a.ts"] }),
    line(120, { type: "mcp_tool_call", server: "athar", tool: "athar_context", arguments: { task: "x" } }),
    line(300, { type: "file_change", changes: [{ path: "src/b.ts" }] }),
    line(400, { type: "file_read", path: "src/c.ts" }),
    line(500, { type: "token_count", usage: { input_tokens: 50, output_tokens: 20 } }),
    line(600, { type: "agent_message", text: "final answer here" }),
  ];

  const parsed = parseCodexLines(lines, CWD);

  assert.equal(parsed.sawAny, true);
  assert.equal(parsed.answer, "final answer here");
  assert.equal(parsed.tokens.input, 50);
  assert.equal(parsed.tokens.output, 20);

  assert.ok(parsed.tools.some((t) => t.kind === "bash" && t.file === "src/a.ts"), "shell read of a file");
  assert.ok(parsed.tools.some((t) => t.athar === true && t.name === "mcp__athar__athar_context"), "athar MCP call");
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
  assert.equal(classifyTool("mcp__athar__athar_context"), "athar");
  assert.equal(classifyTool("apply_patch"), "edit");
});

test("isAtharTool recognizes both the MCP-prefixed and bare athar tool names", () => {
  assert.equal(isAtharTool("mcp__athar__athar_query"), true);
  assert.equal(isAtharTool("athar_affected"), true);
  assert.equal(isAtharTool("Read"), false);
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
    athar: false,
    file: "a.ts",
    atMs: 5,
  });
});
