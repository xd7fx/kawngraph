#!/usr/bin/env node
/*
 * Reproducible raster export for KawnGraph brand assets.
 *
 * SVG is the single source of truth. This script renders a small, fixed set of
 * PNG sizes into brand/dist/ (gitignored) for places that cannot consume SVG
 * (favicons, app-store / PWA icons). The PNGs are derived artifacts — do not
 * commit them.
 *
 * Usage:
 *   node brand/render.mjs
 *
 * Requires `sharp` (peer, not a repo dependency):
 *   npm i -g sharp     # or: npx --yes sharp-cli ... per asset
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "dist");

/** source SVG (relative to brand/) → list of square PNG sizes */
const TARGETS = [
  { src: "icons/favicon.svg", base: "favicon", sizes: [16, 32] },
  { src: "icons/app-icon.svg", base: "app-icon", sizes: [180, 512, 1024] },
];

async function main() {
  let sharp;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    console.error(
      "[brand] `sharp` is not installed. Install it first:\n" +
        "  npm i -g sharp\n" +
        "SVGs remain the source of truth; PNGs are optional derived assets.",
    );
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });
  const { readFile } = await import("node:fs/promises");

  for (const { src, base, sizes } of TARGETS) {
    const svg = await readFile(join(here, src));
    for (const size of sizes) {
      const out = join(outDir, `${base}-${size}.png`);
      const png = await sharp(svg, { density: 384 })
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      await writeFile(out, png);
      console.log(`[brand] wrote ${out} (${png.length} bytes)`);
    }
  }
  console.log("[brand] done. dist/ is gitignored — do not commit PNGs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
