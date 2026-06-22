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

The mark expresses this literally: a central **ringed project planet** linked by
**graph edges** to three **orbiting planets** — code, docs, and data — crossed by
two restrained **orbital paths**.

---

## 3. The mark

- Construction: one central **project planet** (Kawn Teal) with a thin ring; three
  smaller planets in orbit — **code** (Context Blue), **docs** (Signal Amber), and
  **data** (Success Green); two tilted orbital ellipses; and three subtle teal
  graph edges from the centre to each planet.
- **Flat fills only** — no gradients, no blur, no animation, no dense star field.
- It is pure geometry: **no embedded raster, no external assets, no font
  dependency**. The central planet and three planets stay recognizable at 16px;
  the orbits/edges are restrained detail that reads from ~24px up.
- It deliberately shares **nothing** with a generic letter-K mark.

**Do not** rebuild the mark from a raster image, recolor it arbitrarily, stretch
it, add gradients/shadows/glows, or drop the ring that distinguishes the central
project planet.

---

## 4. Logo system (`brand/`)

| File              | Use                                                                |
| ----------------- | ------------------------------------------------------------------ |
| `mark.svg`        | Standalone universe mark, transparent (app, avatar, favicon source).|
| `mark-light.svg`  | Mark on a light tile.                                              |
| `mark-dark.svg`   | Mark on a dark tile.                                               |
| `logo.svg`        | Primary wordmark: mark + “KawnGraph”, 260×64, for headers.         |
| `logo-light.svg`  | Wordmark for light backgrounds (dark type).                        |
| `logo-dark.svg`   | Wordmark for dark backgrounds (light type).                        |
| `social-card.svg` | 1280×640 social / Open Graph source (`social-card.png` is committed).|

**Clear space:** keep padding of at least one central-planet diameter around any
lockup. **Minimum size:** mark 16px; wordmark ~140px wide. **Backgrounds:** swap
`logo-dark.svg` / `logo-light.svg` by theme (e.g. `<picture>` +
`prefers-color-scheme`); the planet colors read on either.

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

SVG is the **single source of truth**. Generate PNGs via the reproducible script:

```
node brand/render.mjs        # square icons → brand/dist/; social-card.png → brand/
```

`brand/dist/` is gitignored — **never commit those PNGs**. The only committed
raster is `brand/social-card.png`, which GitHub's social-preview upload requires.
