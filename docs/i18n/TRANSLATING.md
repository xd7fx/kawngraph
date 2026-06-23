# Translating KawnGraph

Thank you for helping make KawnGraph readable in your language.

**English ([`README.md`](../../README.md)) is canonical.** Every translation
mirrors its structure and is validated automatically by
[`scripts/check-readme-translations.mjs`](../../scripts/check-readme-translations.mjs).

## Tiers

| Tier | Meaning |
| ---- | ------- |
| **canonical** | `README.md` — the source of truth. |
| **reviewed** | Translated **and** reviewed by a fluent human (currently: العربية, [`README.ar.md`](../../README.ar.md)). |
| **machine-assisted** | Drafted with machine assistance; **needs human review**. The current `docs/i18n/README.*.md` set. |

A translation is **never** treated as reviewed without explicit metadata. Don't
mark a file `status: reviewed` unless a fluent speaker has actually reviewed it.

## File layout & metadata header

- Arabic lives at the repo root: `README.ar.md`.
- All other languages live here: `docs/i18n/README.<code>.md` (e.g.
  `README.es.md`, `README.pt-BR.md`, `README.zh-CN.md`).

Every translation **must** begin with this metadata header so the checker can
detect staleness and review status:

```text
<!-- KAWN-TRANSLATION
lang: es
status: machine-assisted        # reviewed | machine-assisted | needs-review
canonical: README.md
canonical-sha: <sha256 of README.md at translation time>
-->
```

Get the current canonical hash with:

```bash
node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('README.md','utf8'),'utf8').digest('hex'))"
```

## Rules (enforced by the checker)

1. **Same structure.** Keep the same number of headings as the canonical README
   (translate the heading *text*, not the count).
2. **Code blocks stay byte-identical.** Commands, flags, JSON keys, paths,
   package names, and identifiers are **English everywhere** — do not translate
   anything inside a fenced code block.
3. **Benchmark numbers never change.** The block between `<!-- BENCH:START -->`
   and `<!-- BENCH:END -->` keeps the exact numbers from the canonical README
   (it's fine to leave that table in English).
4. **Record the canonical hash.** If `canonical-sha` no longer matches the
   current `README.md`, the checker flags the file as **stale** — re-translate
   the changed parts and update the hash.
5. **Don't duplicate deep docs.** Link to the canonical technical docs in
   `docs/` rather than translating fast-moving architecture content.
6. **RTL languages** (Arabic, Persian, Urdu, Hebrew) must wrap content so it
   renders right-to-left (e.g. a `<div dir="rtl">` … `</div>` wrapper) and must
   be inspected visually — never trust an image model to render the script.

## Workflow

```bash
# 1. copy the canonical README as a starting point
cp README.md docs/i18n/README.<code>.md
# 2. add the metadata header, translate prose (NOT code blocks / bench numbers)
# 3. validate
node scripts/check-readme-translations.mjs
```

Open a PR. CI runs the same check. To add a brand-new language, also add an entry
to the `LANGS` registry in
[`scripts/check-readme-translations.mjs`](../../scripts/check-readme-translations.mjs)
and a row in [`STATUS.md`](STATUS.md), and link it from the language bar in
`README.md`.
