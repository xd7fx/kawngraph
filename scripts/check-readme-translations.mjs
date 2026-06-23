#!/usr/bin/env node
/*
 * check-readme-translations.mjs — guard AND generate the README translation
 * system from a single source of truth: docs/i18n/languages.json.
 *
 * 31 languages: English (canonical) + Arabic (ai-assisted, owner review pending)
 * + 29 machine-assisted (human review needed).
 *
 * The manifest drives:
 *   - the README.md language bar (between <!-- LANGBAR:START/END -->),
 *   - docs/i18n/STATUS.md,
 *   - each translation's metadata `status:` (must equal its manifest tier),
 *   - the recorded `canonical-sha:` in each translation (stamped to README.md's
 *     current hash so drift surfaces as "stale").
 *
 * Per-translation parity (vs canonical README.md) is also enforced:
 *   - same heading COUNT (text may differ),
 *   - byte-identical fenced code blocks (commands stay English),
 *   - identical benchmark NUMBERS (never silently changed),
 *   - RTL languages wrap content in dir="rtl".
 *
 * Modes:
 *   node scripts/check-readme-translations.mjs           # verify everything
 *   node scripts/check-readme-translations.mjs --write   # regen bar + STATUS, stamp sha
 *   node scripts/check-readme-translations.mjs --json
 *   node scripts/check-readme-translations.mjs --list
 *
 * Run AFTER scripts/readme-benchmark.mjs so the benchmark block (and thus the
 * canonical hash) is final before stamping.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { posix as pp } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL = join(ROOT, "README.md");
const MANIFEST = join(ROOT, "docs", "i18n", "languages.json");
const STATUS_FILE = join(ROOT, "docs", "i18n", "STATUS.md");
const LANGBAR_START = "<!-- LANGBAR:START -->";
const LANGBAR_END = "<!-- LANGBAR:END -->";

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const LANGS = manifest.languages;
const VALID_STATUS = new Set(["ai-assisted", "machine-assisted"]);
const TIER_STATUS = { "ai-assisted": "ai-assisted", "machine-assisted": "machine-assisted" };

// ---- helpers ---------------------------------------------------------------
// Hash over LF-normalized content so the canonical-sha is identical on LF (CI /
// Linux) and CRLF (Windows checkouts) — otherwise a stamped sha would falsely
// read as "stale" on the other platform.
const sha256 = (s) => createHash("sha256").update(s.replace(/\r\n/g, "\n"), "utf8").digest("hex");
const headingCount = (md) => (md.match(/^#{1,6}\s+\S/gm) || []).length;
function codeBlocks(md) {
  const out = [];
  let inside = false, buf = [];
  for (const line of md.split("\n")) {
    if (/^```/.test(line.trim())) {
      if (inside) { out.push(buf.join("\n")); buf = []; inside = false; } else inside = true;
      continue;
    }
    if (inside) buf.push(line);
  }
  return out;
}
function benchNumbers(md) {
  const si = md.indexOf("<!-- BENCH:START -->");
  const ei = md.indexOf("<!-- BENCH:END -->");
  if (si < 0 || ei < 0) return null;
  return (md.slice(si, ei).match(/[+-]?\d+(?:\.\d+)?/g) || []).join(" ");
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

// ---- generators (manifest -> artifacts) ------------------------------------
function genLangbar() {
  const parts = LANGS.map((l) =>
    l.tier === "canonical" ? `**${l.name}**` : `[${l.name}](${l.file})`,
  );
  const ar = LANGS.find((l) => l.code === "ar");
  const machine = LANGS.filter((l) => l.tier === "machine-assisted").length;
  const note =
    `<sub>English is canonical · العربية is ${ar.statusLabel} · the other ${machine} languages are ` +
    `machine-assisted (human review needed) — see [translation status](docs/i18n/STATUS.md).</sub>`;
  return `${parts.join(" ·\n")}\n\n${note}`;
}

function genStatus() {
  const L = [];
  L.push(`# Translation status`);
  L.push("");
  L.push(
    `**English ([\`README.md\`](../../README.md)) is canonical.** This index is generated from ` +
      `[\`languages.json\`](languages.json) by ` +
      `[\`scripts/check-readme-translations.mjs\`](../../scripts/check-readme-translations.mjs) ` +
      `(run in CI) — do not edit by hand. See [TRANSLATING.md](TRANSLATING.md) to contribute.`,
  );
  L.push("");
  L.push(`- **canonical** — the source of truth.`);
  L.push(`- **ai-assisted** — drafted with AI; **owner review pending** (currently العربية).`);
  L.push(`- **machine-assisted** — drafted with machine assistance; **human review needed**. Accuracy is not guaranteed; when in doubt, read the canonical English.`);
  L.push("");
  L.push(`| Language | Code | File | Tier | Status |`);
  L.push(`| -------- | ---- | ---- | ---- | ------ |`);
  for (const l of LANGS) {
    const rel = pp.relative("docs/i18n", l.file.split("\\").join("/")) || l.file;
    L.push(`| ${l.name} | \`${l.code}\` | [\`${pp.basename(l.file)}\`](${rel}) | ${l.tier} | ${l.statusLabel} |`);
  }
  L.push("");
  L.push(
    `> Want your language promoted? A fluent human review moves a file from ` +
      `machine-assisted/ai-assisted toward owner-approved — read [TRANSLATING.md](TRANSLATING.md) and open a PR.`,
  );
  L.push("");
  return L.join("\n");
}

function replaceBetween(src, start, end, body) {
  const si = src.indexOf(start);
  const ei = src.indexOf(end);
  if (si < 0 || ei < 0) return null;
  return src.slice(0, si) + start + "\n\n" + body + "\n\n" + end + src.slice(ei + end.length);
}

// ---- run -------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.includes("--list")) {
  for (const l of LANGS) console.log(`${l.code.padEnd(6)} ${l.tier.padEnd(15)} ${l.file}  (${l.name})`);
  process.exit(0);
}

const mode = argv.includes("--write") ? "write" : "check";

if (mode === "write") {
  // 1) README language bar
  let readme = readFileSync(CANONICAL, "utf8");
  const next = replaceBetween(readme, LANGBAR_START, LANGBAR_END, genLangbar());
  if (!next) {
    console.error(`README.md is missing ${LANGBAR_START} … ${LANGBAR_END} markers`);
    process.exit(1);
  }
  if (next !== readme) { writeFileSync(CANONICAL, next, "utf8"); readme = next; }
  // 2) STATUS.md
  writeFileSync(STATUS_FILE, genStatus(), "utf8");
  // 3) stamp canonical-sha into each translation (README.md is now final)
  const csha = sha256(readFileSync(CANONICAL, "utf8"));
  for (const l of LANGS) {
    if (l.tier === "canonical") continue;
    const abs = join(ROOT, l.file);
    if (!existsSync(abs)) continue;
    const md = readFileSync(abs, "utf8");
    const stamped = md.replace(/(canonical-sha:\s*)\S+/i, `$1${csha}`);
    if (stamped !== md) writeFileSync(abs, stamped, "utf8");
  }
  console.log(`[i18n] wrote README language bar, STATUS.md, and stamped canonical-sha (${csha.slice(0, 12)}…) into ${LANGS.length - 1} files`);
  process.exit(0);
}

// ---- check -----------------------------------------------------------------
// Read LF-normalized so a CRLF (Windows) checkout compares equal to the LF the
// generators emit (CI runs on LF). The generators (genLangbar/genStatus) emit LF.
const readLF = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const canonical = readLF(CANONICAL);
const canonicalSha = sha256(canonical);
const ref = { headings: headingCount(canonical), blocks: codeBlocks(canonical), bench: benchNumbers(canonical) };
const problems = [];
const report = [];

// README language bar matches the manifest-generated bar
{
  const si = canonical.indexOf(LANGBAR_START), ei = canonical.indexOf(LANGBAR_END);
  if (si < 0 || ei < 0) problems.push("README.md missing LANGBAR markers");
  else {
    const got = canonical.slice(si + LANGBAR_START.length, ei).trim();
    if (got !== genLangbar().trim()) problems.push("README.md language bar is out of sync with docs/i18n/languages.json (run --write)");
  }
}
// STATUS.md matches the manifest-generated content
if (!existsSync(STATUS_FILE) || readLF(STATUS_FILE) !== genStatus()) {
  problems.push("docs/i18n/STATUS.md is out of sync with docs/i18n/languages.json (run --write)");
}

for (const lang of LANGS) {
  if (lang.tier === "canonical") continue;
  const abs = join(ROOT, lang.file);
  const row = { code: lang.code, file: lang.file, tier: lang.tier, status: null, ok: true, notes: [] };
  if (!existsSync(abs)) {
    row.ok = false; row.notes.push("missing file"); problems.push(`${lang.code}: missing ${lang.file}`); report.push(row); continue;
  }
  const md = readLF(abs);
  const m = meta(md);
  if (!m) { row.ok = false; row.notes.push("no metadata header"); problems.push(`${lang.code}: missing KAWN-TRANSLATION header`); }
  else {
    row.status = m.status;
    if (!VALID_STATUS.has(m.status)) { row.ok = false; row.notes.push(`invalid status "${m.status}"`); problems.push(`${lang.code}: invalid status "${m.status}"`); }
    else if (m.status !== TIER_STATUS[lang.tier]) { row.ok = false; row.notes.push(`status "${m.status}" != manifest tier "${lang.tier}"`); problems.push(`${lang.code}: status "${m.status}" does not match manifest tier "${lang.tier}"`); }
    if (!m["canonical-sha"]) { row.ok = false; row.notes.push("no canonical-sha"); problems.push(`${lang.code}: no canonical-sha recorded`); }
    else if (m["canonical-sha"] !== canonicalSha) { row.ok = false; row.notes.push("stale canonical-sha"); problems.push(`${lang.code}: stale (canonical-sha != current README.md — run --write after readme-benchmark)`); }
  }
  const h = headingCount(md);
  if (h !== ref.headings) { row.ok = false; row.notes.push(`headings ${h} != ${ref.headings}`); problems.push(`${lang.code}: heading count ${h} != canonical ${ref.headings}`); }
  const b = codeBlocks(md);
  if (b.length !== ref.blocks.length) { row.ok = false; row.notes.push(`code blocks ${b.length} != ${ref.blocks.length}`); problems.push(`${lang.code}: code-block count ${b.length} != canonical ${ref.blocks.length}`); }
  else for (let i = 0; i < b.length; i++) if (b[i] !== ref.blocks[i]) { row.ok = false; row.notes.push(`code block #${i + 1} differs`); problems.push(`${lang.code}: code block #${i + 1} not byte-identical to canonical`); break; }
  if (benchNumbers(md) !== ref.bench) { row.ok = false; row.notes.push("benchmark numbers differ"); problems.push(`${lang.code}: benchmark numbers differ from canonical`); }
  if (lang.rtl && !/dir=["']rtl["']/i.test(md)) { row.ok = false; row.notes.push('RTL file without dir="rtl"'); problems.push(`${lang.code}: RTL language without a dir="rtl" wrapper`); }
  report.push(row);
}

if (argv.includes("--json")) {
  console.log(JSON.stringify({ canonicalSha, problems, report }, null, 2));
} else {
  for (const r of report) console.log(`${r.ok ? "ok " : "FAIL"} ${r.code.padEnd(6)} ${(r.status || "-").padEnd(16)} ${r.file}${r.notes.length ? "  — " + r.notes.join("; ") : ""}`);
  console.log("");
  if (problems.length) console.error(`check-readme-translations: ${problems.length} problem(s).`);
  else console.log(`check-readme-translations: all ${report.length} translations + bar + STATUS pass (manifest-driven).`);
}
process.exit(problems.length ? 1 : 0);
