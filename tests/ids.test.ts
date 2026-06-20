import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fileId,
  functionId,
  classId,
  routeId,
  tableId,
  docId,
  sectionId,
  edgeId,
  toPosix,
  posixJoin,
  posixDirname,
} from "@athar/shared";

test("ids are stable and content-addressable (no line numbers)", () => {
  assert.equal(fileId("src/a.ts"), "file:src/a.ts");
  assert.equal(functionId("src/a.ts", "foo"), "function:src/a.ts#foo");
  assert.equal(classId("src/a.ts", "Foo"), "class:src/a.ts#Foo");
  assert.equal(sectionId("docs/x.md", "intro"), "section:docs/x.md#intro");
  assert.equal(docId("docs/x.md"), "doc:docs/x.md");
});

test("ids normalize windows separators to posix so they are cross-platform", () => {
  assert.equal(fileId("src\\a\\b.ts"), "file:src/a/b.ts");
  assert.equal(functionId("src\\a.ts", "foo"), "function:src/a.ts#foo");
});

test("routeId upper-cases the method; tableId lower-cases the name", () => {
  assert.equal(routeId("/api/x", "get"), "route:/api/x#GET");
  assert.equal(tableId("Store_Tokens"), "table:store_tokens");
});

test("edgeId is deterministic so re-scans dedupe rather than duplicate", () => {
  const a = edgeId("calls", "function:src/a.ts#foo", "function:src/b.ts#bar");
  const b = edgeId("calls", "function:src/a.ts#foo", "function:src/b.ts#bar");
  assert.equal(a, b);
  assert.notEqual(a, edgeId("imports", "function:src/a.ts#foo", "function:src/b.ts#bar"));
});

test("path helpers are posix and collapse . / ..", () => {
  assert.equal(toPosix("a\\b\\c"), "a/b/c");
  assert.equal(posixDirname("a/b/c.ts"), "a/b");
  assert.equal(posixJoin("a/b", "../c"), "a/c");
  assert.equal(posixJoin("a/b", "./c"), "a/b/c");
});
