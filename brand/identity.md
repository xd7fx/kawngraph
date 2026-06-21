# KawnGraph — Brand Identity

**كون قراف** · *The Agent Context Universe*
**One project universe. Every coding agent.**

This is the canonical identity system for KawnGraph. `brand/README.md` is the
quick index; this file is the source of truth for the concept, names, color, and
type. Design tokens live in `brand/tokens/`.

---

## 1. Name

**KawnGraph** pairs two ideas:

- **Kawn** (Arabic **كَوْن** — *cosmos / universe / existence*): the product treats
  a repository as a living universe of knowledge.
- **Graph**: the evidence-backed Agent Context Graph at the core.

Bare "Kawn" collides with existing entities (Kawn LLC; Kawn AI by Misraj AI), so
the brand is always the compound **KawnGraph** — unique, available, and
descriptive. The Arabic lockup is **كون قراف** (exact spelling and order; always
right-to-left).

| Surface            | Value         |
| ------------------ | ------------- |
| Brand name         | KawnGraph     |
| Arabic wordmark    | كون قراف      |
| CLI command        | `kawn`        |
| npm package        | `kawngraph`   |
| Local data dir     | `.kawn`       |
| MCP server id      | `kawn`        |

**Mantra:** نزّل KawnGraph، ثم اكتب `kawn`. — *Install KawnGraph, then type `kawn`.*

---

## 2. Concept

A project is a **universe**. Files, docs, and database tables are **bodies**;
dependencies are the **gravity** that binds them; every relationship is an
**orbit** with **evidence** behind it. Instead of scanning the whole tree, an
agent navigates this universe to the few bodies that matter.

The mark expresses this: a geometric **K** built from connected **orbital nodes**
around one central **anchor**, with a single highlighted **evidence path**.

---

## 3. The mark

- Construction: five orbital nodes form a **K** — a vertical spine (three nodes,
  the middle one the larger **anchor**) plus two diagonals to an upper-right and
  a lower-right node.
- The **upper diagonal is the evidence path**, drawn in Signal Amber, ending in
  an amber node. Everything else uses the teal→blue identity gradient.
- It is pure geometry: **no embedded raster, no external assets, no font
  dependency**. It reads at 16px and works on light or dark backgrounds.
- See `logo/construction.svg` for the geometry sheet (30-unit grid).

**Do not** rebuild the mark from a raster image, recolor it arbitrarily, stretch
it, add shadows/glows to the standalone mark, or remove the evidence path.

---

## 4. Logo system (`brand/logo/`)

| File                          | Use                                                            |
| ----------------------------- | ------------------------------------------------------------- |
| `kawngraph-mark.svg`          | Standalone mark (app, avatar, favicon source).                |
| `kawngraph-horizontal.svg`    | Primary lockup: mark + wordmark, for headers/wide spaces.     |
| `kawngraph-stacked.svg`       | Vertical lockup with category line, for square/centered uses. |
| `kawngraph-arabic.svg`        | Arabic lockup **كون قراف** (RTL).                             |
| `kawngraph-monochrome.svg`    | Single-color lockup; set ink via CSS `color`. Any background. |
| `construction.svg`            | Geometry/construction sheet (reference only).                 |

**Clear space:** keep padding of at least one anchor-node diameter around any
lockup. **Minimum size:** mark 16px; horizontal lockup ~120px wide.
**Backgrounds:** color lockups are dark-first (Deep Space / Cosmic Black). On
light or photographic backgrounds use `kawngraph-monochrome.svg`.

**Arabic:** never alter letterforms, joining, or direction. The wordmark is
always right-to-left and must be inspected visually — do not trust an image model
to render Arabic.

---

## 5. Color system

Dark-first ("the Universe"), with a restrained light theme for documentation.
Tokens: `brand/tokens/colors.css` (CSS variables) and `colors.json` (data).
Text pairings target **WCAG AA**.

### Foundation (cosmic)

| Token             | Hex       | Use                          |
| ----------------- | --------- | ---------------------------- |
| Cosmic Black      | `#070A0F` | Base canvas / deepest bg.    |
| Deep Space        | `#0B1118` | Default app background.      |
| Orbit Surface     | `#111923` | Cards, panels.               |
| Elevated Surface  | `#17212D` | Popovers, raised elements.   |
| Primary Text      | `#F4F7FB` | Body/heading text on dark.   |
| Secondary Text    | `#A9B6C5` | Muted text, labels.          |

### Core identity

| Token         | Hex       | Use                                       |
| ------------- | --------- | ----------------------------------------- |
| Kawn Teal     | `#22C7A9` | Primary brand accent.                     |
| Context Blue  | `#4C8DFF` | Secondary accent, links, focus.           |
| Signal Amber  | `#F6C85F` | Evidence, attention, the evidence path.   |
| Risk Red      | `#FF6B6B` | Risk flags, destructive intents.          |
| Success Green | `#42D392` | Success, healthy state.                   |

### Functional layer colors

Layers must **stay distinguishable** — never collapse the graph into one hue, and
never rely on color alone (always pair with a label/shape). Dark values are
tuned for dark surfaces; light values are darkened for AA on white.

| Layer     | Dark      | Light     |
| --------- | --------- | --------- |
| code      | `#4C8DFF` | `#2563EB` |
| docs      | `#34D399` | `#059669` |
| data      | `#F2A341` | `#B45309` |
| test      | `#2DD4BF` | `#0D9488` |
| config    | `#94A3B8` | `#475569` |
| decision  | `#A78BFA` | `#7C3AED` |
| visual    | `#F472B6` | `#BE185D` |
| runtime   | `#FB7185` | `#DC2626` |
| changes   | `#38BDF8` | `#0284C7` |
| risk      | `#FF6B6B` | `#DC2626` |

---

## 6. Typography

One coherent, openly-licensed (SIL OFL) system. Tokens in
`brand/tokens/typography.css`.

| Role               | Typeface                                   |
| ------------------ | ------------------------------------------ |
| Display / headings | **Inter** (alt: IBM Plex Sans, Geist)      |
| Body / UI / labels | **Inter**                                  |
| Code / CLI         | **IBM Plex Mono**                          |
| Arabic             | **IBM Plex Sans Arabic** (alt: Noto Sans Arabic) |

Headings use tight tracking (`-0.02em`); eyebrow labels are tracked out
(`0.18em`) and uppercase. Code and CLI examples are always monospace.

---

## 7. Voice

Precise, calm, evidence-first. We talk about *context*, *evidence*, *universe*,
*orbits*, and *agents* — not hype. Bilingual by default (English + Arabic); the
Arabic must be correct and natural, never machine-mangled.

---

## 8. Accessibility

- Target **WCAG AA** for text; dark-first with a light docs theme.
- Never encode meaning in color alone — pair layer colors with labels/icons.
- Arabic is always RTL; verify direction and letter order visually.
- Respect `prefers-reduced-motion`; do not animate the mark gratuitously.

---

## 9. Derived assets

SVG is the **single source of truth**. Generate PNGs (favicons, app icons) only
via the reproducible script:

```
node brand/render.mjs        # writes 16/32/180/512/1024 px PNGs to brand/dist/
```

`brand/dist/` is gitignored — **never commit generated PNGs** or duplicate
assets.
