# Release Assets

Every visual asset KawnGraph ships, its source, and how to regenerate it. All are
**real** — rendered from committed sources or captured from the actual Studio. No
mockups or placeholders.

## Brand

Committed sources live in `brand/` (SVG). Raster derivatives are generated into
`brand/dist/` — **gitignored, never committed** — and produced on demand.

| Asset | Source (committed) | Generated | Dimensions |
| --- | --- | --- | --- |
| Logo (light/dark/default) | `brand/logo.svg`, `logo-light.svg`, `logo-dark.svg` | used as SVG in READMEs | vector |
| Mark / favicon | `brand/mark.svg`, `apps/studio` favicons | — | vector |
| Arabic diagrams | `brand/architecture.ar.svg`, `brand/context-pack-flow.ar.svg` | used as SVG in `README.ar.md` | vector |
| **Social preview card** | `brand/social-card.svg` | `brand/dist/social-card.png` | **1280×640** |
| Icon PNGs | square brand SVGs | `brand/dist/<name>-<size>.png` | per size |

**Regenerate** (requires `sharp` as a one-off dev tool — not a repo dependency):

```bash
node brand/render.mjs        # writes brand/dist/*.png from brand/*.svg
```

**Social preview** is the only PNG a maintainer must act on: after rendering,
upload `brand/dist/social-card.png` under **GitHub → Settings → General → Social
preview**. (GitHub stores its own copy; it is not served from the repo.)

## Studio screenshots

Captured from the **real** read-only Studio (`kawn map`) via `puppeteer-core`
driving system Chrome (no bundled browser download), encoded to WebP with `sharp`.

| Asset | What it shows | Source | Dimensions |
| --- | --- | --- | --- |
| `docs/assets/studio-universe.webp` | 3D "Universe" star-map of this repo (~1,261 nodes) | `kawn map` → Universe view | 1600×1000 |
| `docs/assets/studio-map.webp` | 2D graph of the `examples/nextjs-supabase` project | `kawn map` → Map view | 1600×1000 |

Both are committed and referenced by `README.md` and `README.ar.md`. Regenerate
only if the UI changes materially, from a built Studio (`pnpm studio:build`) using
the same headless capture; keep the dimensions stable so the README layout holds.

## What is NOT committed (by design)

- `brand/dist/**` — all rendered PNGs/icons, including `social-card.png`.
- These are reproducible from committed SVGs via `node brand/render.mjs`.
