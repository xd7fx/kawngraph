#!/usr/bin/env node
/*
 * check-readme-translations.mjs — guard the README translation system.
 *
 * Canonical source: README.md (English). Reviewed first-class: README.ar.md.
 * Machine-assisted set: docs/i18n/README.<lang>.md.
 *
 * For every translation this checks:
 *   1. the file exists;
 *   2. it declares a metadata header (lang, status, canonical, canonical-sha);
 *   3. status is one of: reviewed | machine-assisted | needs-review
 *      (a translation is NEVER treated as reviewed without explicit metadata);
 *   4. the recorded canonical-sha matches the CURRENT README.md hash
 *      (so a drifted canonical surfaces as "stale", not silently wrong);
 *   5. heading COUNT matches canonical (structure aligned; text may differ);
 *   6. fenced code-block COUNT and the exact code INSIDE each fence match
 *      canonical (commands stay byte-identical across languages);
 *   7. the benchmark block's NUMBERS match canonical exactly
 *      (benchmark numbers are never silently changed in a translation).
 * It also checks that every language link in README.md resolves to a file.
 *
 * Usage:
 *   node scripts/check-readme-translations.mjs            # verify
 *   node scripts/check-readme-translations.mjs --json     # machine-readable
 *   node scripts/check-readme-translations.mjs --list     # print the registry
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL = join(ROOT, "README.md");

// lang code -> { name (native), file (relative to repo root), tier }
// tier: "canonical" | "reviewed" | "machine"
export const LANGS = [
  { code: "en", name: "English", file: "README.md", tier: "canonical" },
  { code: "ar", name: "العربية", file: "README.ar.md", tier: "reviewed" },
  { code: "es", name: "Español", file: "docs/i18n/README.es.md", tier: "machine" },
  { code: "fr", name: "Français", file: "docs/i18n/README.fr.md", tier: "machine" },
  { code: "de", name: "Deutsch", file: "docs/i18n/README.de.md", tier: "machine" },
  { code: "pt-BR", name: "Português (BR)", file: "docs/i18n/README.pt-BR.md", tier: "machine" },
  { code: "zh-CN", name: "简体中文", file: "docs/i18n/README.zh-CN.md", tier: "machine" },
  { code: "zh-TW", name: "繁體中文", file: "docs/i18n/README.zh-TW.md", tier: "machine" },
  { code: "ja", name: "日本語", file: "docs/i18n/README.ja.md", tier: "machine" },
  { code: "ko", name: "한국어", file: "docs/i18n/README.ko.md", tier: "machine" },
  { code: "hi", name: "हिन्दी", file: "docs/i18n/README.hi.md", tier: "machine" },
  { code: "id", name: "Bahasa Indonesia", file: "docs/i18n/README.id.md", tier: "machine" },
  { code: "tr", name: "Türkçe", file: "docs/i18n/README.tr.md", tier: "machine" },
  { code: "ru", name: "Русский", file: "docs/i18n/README.ru.md", tier: "machine" },
  { code: "it", name: "Italiano", file: "docs/i18n/README.it.md", tier: "machine" },
  { code: "fa", name: "فارسی", file: "docs/i18n/README.fa.md", tier: "machine" },
  { code: "ur", name: "اردو", file: "docs/i18n/README.ur.md", tier: "machine" },
  { code: "pl", name: "Polski", file: "docs/i18n/README.pl.md", tier: "machine" },
  { code: "nl", name: "Nederlands", file: "docs/i18n/README.nl.md", tier: "machine" },
  { code: "uk", name: "Українська", file: "docs/i18n/README.uk.md", tier: "machine" },
  { code: "vi", name: "Tiếng Việt", file: "docs/i18n/README.vi.md", tier: "machine" },
  { code: "th", name: "ภาษาไทย", file: "docs/i18n/README.th.md", tier: "machine" },
  { code: "sv", name: "Svenska", file: "docs/i18n/README.sv.md", tier: "machine" },
  { code: "el", name: "Ελληνικά", file: "docs/i18n/README.el.md", tier: "machine" },
  { code: "ro", name: "Română", file: "docs/i18n/README.ro.md", tier: "machine" },
  { code: "cs", name: "Čeština", file: "docs/i18n/README.cs.md", tier: "machine" },
  { code: "fi", name: "Suomi", file: "docs/i18n/README.fi.md", tier: "machine" },
  { code: "da", name: "Dansk", file: "docs/i18n/README.da.md", tier: "machine" },
  { code: "no", name: "Norsk", file: "docs/i18n/README.no.md", tier: "machine" },
  { code: "hu", name: "Magyar", file: "docs/i18n/README.hu.md", tier: "machine" },
  { code: "he", name: "עברית", file: "docs/i18n/README.he.md", tier: "machine" },
];

const VALID_STATUS = new Set(["reviewed", "machine-assisted", "needs-review"]);
const RTL = new Set(["ar", "fa", "ur", "he"]);

// ---- parsing helpers -------------------------------------------------------
function sha256(s) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
function headingCount(md) {
  return (md.match(/^#{1,6}\s+\S/gm) || []).length;
}
function codeBlocks(md) {
  // returns array of inner code-block text (between ``` fences), in order
  const lines = md.split("\n");
  const blocks = [];
  let inside = false;
  let buf = [];
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      if (inside) {
        blocks.push(buf.join("\n"));
        buf = [];
        inside = false;
      } else {
        inside = true;
      }
      continue;
    }
    if (inside) buf.push(line);
  }
  return blocks;
}
function benchNumbers(md) {
  const si = md.indexOf("<!-- BENCH:START -->");
  const ei = md.indexOf("<!-- BENCH:END -->");
  if (si < 0 || ei < 0) return null;
  const block = md.slice(si, ei);
  // numeric tokens (ints, decimals, percentages, signed) in stable order
  return (block.match(/[+-]?\d+(?:\.\d+)?/g) || []).join(" ");
}
function meta(md) {
  const m = md.match(/<!--\s*KAWN-TRANSLATION([\s\S]*?)-->/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^\s*([a-z-]+)\s*:\s*(.+?)\s*$/i);
    if (kv) out[kv[1].toLowerCase()] = kv[2];
  }
  return out;
}

// ---- run -------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.includes("--list")) {
  for (const l of LANGS) console.log(`${l.code.padEnd(6)} ${l.tier.padEnd(10)} ${l.file}  (${l.name})`);
  process.exit(0);
}

const canonical = readFileSync(CANONICAL, "utf8");
const canonicalSha = sha256(canonical);
const ref = {
  headings: headingCount(canonical),
  blocks: codeBlocks(canonical),
  bench: benchNumbers(canonical),
};

const problems = [];
const report = [];

// 1) language links in README.md resolve
const barLinks = [...canonical.matchAll(/\]\((README\.ar\.md|docs\/i18n\/README\.[\w-]+\.md)\)/g)].map((m) => m[1]);
for (const rel of barLinks) {
  if (!existsSync(join(ROOT, rel))) problems.push(`README language bar links to missing file: ${rel}`);
}

// 2) each translation
for (const lang of LANGS) {
  if (lang.tier === "canonical") continue;
  const abs = join(ROOT, lang.file);
  const row = { code: lang.code, file: lang.file, tier: lang.tier, status: null, ok: true, notes: [] };
  if (!existsSync(abs)) {
    row.ok = false;
    row.notes.push("missing file");
    problems.push(`${lang.code}: missing ${lang.file}`);
    report.push(row);
    continue;
  }
  const md = readFileSync(abs, "utf8");
  const m = meta(md);
  if (!m) {
    row.ok = false;
    row.notes.push("no KAWN-TRANSLATION metadata header");
    problems.push(`${lang.code}: missing metadata header`);
  } else {
    row.status = m.status;
    if (!VALID_STATUS.has(m.status)) {
      row.ok = false;
      row.notes.push(`invalid status "${m.status}"`);
      problems.push(`${lang.code}: invalid status "${m.status}"`);
    }
    if (lang.tier === "machine" && m.status === "reviewed") {
      row.ok = false;
      row.notes.push("machine tier cannot self-declare reviewed");
      problems.push(`${lang.code}: machine-tier file claims status: reviewed`);
    }
    if (m["canonical-sha"] && m["canonical-sha"] !== canonicalSha) {
      row.ok = false;
      row.notes.push("stale: canonical-sha != current README.md");
      problems.push(`${lang.code}: stale (canonical-sha mismatch — re-translate from current README.md)`);
    }
    if (!m["canonical-sha"]) {
      row.ok = false;
      row.notes.push("no canonical-sha recorded");
      problems.push(`${lang.code}: no canonical-sha recorded`);
    }
  }

  const h = headingCount(md);
  if (h !== ref.headings) {
    row.ok = false;
    row.notes.push(`headings ${h} != ${ref.headings}`);
    problems.push(`${lang.code}: heading count ${h} != canonical ${ref.headings}`);
  }
  const b = codeBlocks(md);
  if (b.length !== ref.blocks.length) {
    row.ok = false;
    row.notes.push(`code blocks ${b.length} != ${ref.blocks.length}`);
    problems.push(`${lang.code}: code-block count ${b.length} != canonical ${ref.blocks.length}`);
  } else {
    for (let i = 0; i < b.length; i++) {
      if (b[i] !== ref.blocks[i]) {
        row.ok = false;
        row.notes.push(`code block #${i + 1} differs from canonical`);
        problems.push(`${lang.code}: code block #${i + 1} is not byte-identical to canonical (commands must match)`);
        break;
      }
    }
  }
  const bn = benchNumbers(md);
  if (bn !== ref.bench) {
    row.ok = false;
    row.notes.push("benchmark numbers differ from canonical");
    problems.push(`${lang.code}: benchmark numbers differ from canonical (numbers must not change in translation)`);
  }
  if (RTL.has(lang.code) && !/dir=["']rtl["']/i.test(md)) {
    row.notes.push("RTL language without an explicit dir=\"rtl\" wrapper (recommended)");
  }
  report.push(row);
}

if (argv.includes("--json")) {
  console.log(JSON.stringify({ canonicalSha, problems, report }, null, 2));
} else {
  for (const r of report) {
    console.log(`${r.ok ? "ok " : "FAIL"} ${r.code.padEnd(6)} ${(r.status || "-").padEnd(15)} ${r.file}${r.notes.length ? "  — " + r.notes.join("; ") : ""}`);
  }
  console.log("");
  if (problems.length) {
    console.error(`check-readme-translations: ${problems.length} problem(s).`);
  } else {
    console.log(`check-readme-translations: all ${report.length} translations pass.`);
  }
}

process.exit(problems.length ? 1 : 0);
