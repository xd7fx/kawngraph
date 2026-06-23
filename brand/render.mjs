#!/usr/bin/env node
/*
 * Reproducible raster export for KawnGraph brand assets.
 *
 * SVG is the single source of truth. This script renders DERIVED PNGs into
 * brand/dist/ (gitignored — none are committed):
 *   - a small, fixed set of square PNG icons (favicons, app-store / PWA icons), and
 *   - the social preview card at 1280×640 (brand/dist/social-card.png), for the
 *     one-time GitHub "Social preview" upload (Settings → General → Social preview).
 *
 * The committed brand asset is brand/social-card.svg; the PNG is generated on
 * demand and is NOT tracked in git.
 *
 * Usage (pnpm; `sharp` is a peer tool, intentionally not in the manifest):
 *   pnpm add -Dw sharp && node brand/render.mjs   # then optionally: pnpm remove -w sharp
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, "dist");

/** square icons → brand/dist/ (derived, gitignored) */
const SQUARE = [
  { src: "icons/favicon.svg", base: "favicon", sizes: [16, 32, 48] },
  { src: "icons/app-icon.svg", base: "app-icon", sizes: [180, 192, 512, 1024] },
  { src: "mark.svg", base: "mark", sizes: [64, 128, 256] },
];

/** non-square derived asset(s) → brand/dist/ (gitignored, not committed) */
const FIXED = [{ src: "social-card.svg", out: join(distDir, "social-card.png"), w: 1280, h: 640 }];

async function main() {
  let sharp;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    console.error(
      "[brand] `sharp` is not installed. Install it first (pnpm):\n" +
        "  pnpm add -Dw sharp && node brand/render.mjs   # then optionally: pnpm remove -w sharp\n" +
        "SVGs remain the source of truth; PNGs are derived, gitignored assets.",
    );
    process.exit(1);
  }

  await mkdir(distDir, { recursive: true });

  for (const { src, base, sizes } of SQUARE) {
    const svg = await readFile(join(here, src));
    for (const size of sizes) {
      const out = join(distDir, `${base}-${size}.png`);
      const png = await sharp(svg, { density: 384 })
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      await writeFile(out, png);
      console.log(`[brand] wrote ${out} (${png.length} bytes)`);
    }
  }

  for (const { src, out, w, h } of FIXED) {
    const svg = await readFile(join(here, src));
    const png = await sharp(svg, { density: 192 }).resize(w, h, { fit: "fill" }).png().toBuffer();
    await writeFile(out, png);
    console.log(`[brand] wrote ${out} (${png.length} bytes, ${w}x${h})`);
  }

  console.log("[brand] done. All outputs are in brand/dist/ (gitignored); nothing is committed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
