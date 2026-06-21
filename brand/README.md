# KawnGraph Brand Assets

**كون قراف** · The Agent Context Universe
**One project universe. Every coding agent.**

This folder holds the complete KawnGraph identity. **SVG is the source of truth**;
PNGs are generated on demand and never committed.

See [`identity.md`](./identity.md) for the full system (concept, color, type,
usage rules).

## Layout

```
brand/
├── README.md          ← you are here
├── identity.md        ← canonical identity system
├── render.mjs         ← reproducible SVG → PNG export (gitignored output)
├── logo/
│   ├── kawngraph-mark.svg          standalone mark (pure geometry)
│   ├── kawngraph-horizontal.svg    primary lockup
│   ├── kawngraph-stacked.svg       vertical lockup + category line
│   ├── kawngraph-arabic.svg        Arabic lockup (كون قراف, RTL)
│   ├── kawngraph-monochrome.svg    single-color lockup (any background)
│   └── construction.svg            geometry sheet (reference)
├── icons/
│   ├── favicon.svg     16px-optimized mark on a rounded square
│   ├── app-icon.svg    512px app / PWA icon
│   ├── mcp-icon.svg    mark + connector badge (read-only MCP server)
│   └── cli-icon.svg    terminal prompt glyph + mark
├── social/
│   └── og-card.svg     1200×630 social / Open Graph card
└── tokens/
    ├── colors.css      CSS custom properties (dark + light)
    ├── colors.json     machine-readable color tokens
    └── typography.css  font stacks, scale, weights
```

## Quick use

- **App / repo avatar:** `icons/app-icon.svg`
- **Favicon:** `icons/favicon.svg` (also at `apps/studio/public/favicon.svg`)
- **README / docs header:** `logo/kawngraph-horizontal.svg`
- **On light or photographic backgrounds:** `logo/kawngraph-monochrome.svg`
  (set the ink with CSS `color`)
- **In code:** import tokens from `tokens/colors.css` + `tokens/typography.css`

## Generating PNGs

```
node brand/render.mjs   # → brand/dist/*.png  (16, 32, 180, 512, 1024)
```

Requires `sharp`. Output lands in `brand/dist/`, which is gitignored — do not
commit raster duplicates.

## Rules of thumb

- Don't rebuild the mark from raster, recolor it arbitrarily, stretch, or skew it.
- Keep clear space ≥ one anchor-node diameter around any lockup.
- Never alter the Arabic letterforms or direction; it is always right-to-left.
- Layer colors must stay distinct and be paired with a label — never color alone.
