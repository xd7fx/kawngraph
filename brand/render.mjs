#!/usr/bin/env node
/*
 * Reproducible raster export for KawnGraph brand assets.
 *
 * SVG is the single source of truth. This script renders:
 *   - a small, fixed set of square PNG icons into brand/dist/ (gitignored) for
 *     places that cannot consume SVG (favicons, app-store / PWA icons), and
 *   - the social preview card brand/social-card.png at 1280×640, which IS
 *     committed (GitHub's social-preview upload needs a raster).
 *
 * Usage:
 *   node brand/render.mjs
 *
 * Requires `sharp` (peer, not a repo dependency — kept out of the manifest so a
 * normal install stays lean):
 *   npm i -g sharp        # or run once with: npm i sharp && node brand/render.mjs
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

/** non-square committed asset(s) → brand/ root (real raster, not gitignored) */
const FIXED = [{ src: "social-card.svg", out: join(here, "social-card.png"), w: 1280, h: 640 }];

async function main() {
  let sharp;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    console.error(
      "[brand] `sharp` is not installed. Install it first:\n" +
        "  npm i -g sharp     (or: npm i sharp && node brand/render.mjs)\n" +
        "SVGs remain the source of truth; PNGs are derived assets.",
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

  console.log("[brand] done. dist/ is gitignored; social-card.png is committed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
