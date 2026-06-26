#!/usr/bin/env node
// Copy the built Studio frontend into the publishable CLI package so a user who
// installs `kawngraph` from npm gets a working `kawn map` (not an API-only server).
//
// The CLI's findStaticDir() prefers packages/cli/studio-dist/ (this copy) over the
// in-repo apps/studio/dist. Run by the CLI's `prepack` and by pack:check before
// packing, so every tarball ships the UI. studio-dist/ is generated (gitignored).
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "apps", "studio", "dist");
const DEST = path.join(ROOT, "packages", "cli", "studio-dist");

function log(m) {
  process.stdout.write(`bundle-studio: ${m}\n`);
}

// Build the Studio UI if it is missing (Vite build — not part of `tsc -b`).
if (!fs.existsSync(path.join(SRC, "index.html"))) {
  log("apps/studio/dist not found — building the Studio UI…");
  execFileSync("pnpm", ["--filter", "@kawngraph/studio", "build"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
}
if (!fs.existsSync(path.join(SRC, "index.html"))) {
  throw new Error("bundle-studio: Studio build did not produce apps/studio/dist/index.html");
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.cpSync(SRC, DEST, { recursive: true });

const files = fs.readdirSync(DEST);
if (!files.includes("index.html")) throw new Error("bundle-studio: copy failed — no index.html in studio-dist");
log(`copied ${SRC} -> ${DEST} (${files.length} entries)`);
