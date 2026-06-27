#!/usr/bin/env node
/*
 * version-packages — bump every KawnGraph package to one consistent version.
 *
 *   pnpm version:packages 0.1.3
 *
 * Updates: all package.json (root + packages/*), the KAWN_VERSION constant (the
 * source of truth for `kawn version` and the npx MCP launch pin), and the
 * illustrative version in launch.ts's doc-comment. CHANGELOG.md is editorial —
 * update it by hand. Does NOT publish, tag, or build.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2];
if (!target || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(target)) {
  console.error("usage: node scripts/version-packages.mjs <semver>   e.g. 0.1.3");
  process.exit(1);
}

const oldVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

// 1) every package.json (root + packages/*)
const dirs = ["."].concat(fs.readdirSync(path.join(ROOT, "packages")).map((d) => "packages/" + d));
let bumped = 0;
for (const d of dirs) {
  const p = path.join(ROOT, d, "package.json");
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  if (j.version !== target) {
    j.version = target;
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
    bumped++;
  }
}

// 2) KAWN_VERSION constant
const sharedPath = path.join(ROOT, "packages/shared/src/index.ts");
const shared = fs.readFileSync(sharedPath, "utf8");
const KAWN_RE = /(export const KAWN_VERSION = ")[^"]+(")/;
if (!KAWN_RE.test(shared)) throw new Error("KAWN_VERSION not found in packages/shared/src/index.ts");
fs.writeFileSync(sharedPath, shared.replace(KAWN_RE, `$1${target}$2`)); // idempotent: a no-op when already at target

// 3) illustrative version in launch.ts doc-comment (kept in sync; non-functional)
if (oldVersion && oldVersion !== target) {
  const launchPath = path.join(ROOT, "packages/agents/src/launch.ts");
  const launch = fs.readFileSync(launchPath, "utf8");
  fs.writeFileSync(launchPath, launch.split(`@kawngraph/mcp@${oldVersion}`).join(`@kawngraph/mcp@${target}`));
}

console.log(`version:packages → ${target}  (bumped ${bumped} package.json + KAWN_VERSION; was ${oldVersion})`);
console.log("reminder: add a CHANGELOG.md entry for this version.");
