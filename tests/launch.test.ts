import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMcpLaunch, publishedNpxLaunch } from "@kawngraph/agents";
import { KAWN_VERSION } from "@kawngraph/shared";

/**
 * The MCP launch written into a user's agent config must be PORTABLE — it must not
 * depend on a global `kawn-mcp` binary being on PATH (it frequently is not, e.g. on
 * Windows). Published installs use `npx -y @kawngraph/mcp@<version>`; only a
 * monorepo checkout launches the built server with `node`. (Regression guard for the
 * `spawn kawn-mcp ENOENT` post-publish bug.)
 */

test("publishedNpxLaunch is portable: npx -y @kawngraph/mcp@<version>, never a bare kawn-mcp", () => {
  const l = publishedNpxLaunch("/repo/root");
  assert.equal(l.command, "npx");
  assert.deepEqual(l.args, ["-y", `@kawngraph/mcp@${KAWN_VERSION}`, "--root", "/repo/root"]);
  assert.equal(l.source, "npx");
  assert.equal(l.portable, true);
  assert.ok(!JSON.stringify(l).includes("kawn-mcp"), "must not reference a global kawn-mcp binary");
});

test("publishedNpxLaunch pins the server to this CLI's version, and honors an explicit version", () => {
  assert.ok(publishedNpxLaunch("/r").args.includes(`@kawngraph/mcp@${KAWN_VERSION}`));
  assert.deepEqual(publishedNpxLaunch("/r", "@kawngraph/mcp@9.9.9").args, [
    "-y",
    "@kawngraph/mcp@9.9.9",
    "--root",
    "/r",
  ]);
});

test("resolveMcpLaunch from the monorepo launches the built server with node (not kawn-mcp)", () => {
  const l = resolveMcpLaunch("/some/root");
  assert.equal(l.command, "node");
  assert.equal(l.source, "local-node");
  assert.ok(
    l.serverEntry && /packages[\\/]mcp[\\/]dist[\\/]index\.js$/.test(l.serverEntry),
    "serverEntry points at the monorepo MCP build",
  );
  assert.deepEqual(l.args, [l.serverEntry, "--root", "/some/root"]);
  assert.ok(!JSON.stringify(l).includes("kawn-mcp"), "no bare kawn-mcp anywhere");
});

test("a root path with spaces stays a single, separate argument (Windows-safe)", () => {
  const root = "C:\\Users\\Abdul Rahman\\My Repo";
  const l = resolveMcpLaunch(root);
  assert.equal(l.args[l.args.length - 1], root, "spaced root is one arg, not split or joined");
});

test("an explicit launch override wins over resolution", () => {
  const l = resolveMcpLaunch("/r", { command: "node", source: "npx", portable: true });
  assert.equal(l.command, "node");
  assert.equal(l.source, "npx");
  assert.equal(l.portable, true);
});
