#!/usr/bin/env node
/*
 * readme-benchmark.mjs — regenerate the benchmark block in every README from the
 * published, validated artifact so the numbers can never drift from the campaign
 * that produced them.
 *
 * The block is delimited by <!-- BENCH:START --> … <!-- BENCH:END --> in:
 *   - README.md             (canonical, English prose, root-relative links)
 *   - README.ar.md          (Arabic prose, root-relative links)
 *   - docs/i18n/README.*.md (English prose [machine-assisted tier], i18n links)
 *
 * The NUMBERS are identical in every file (translation rule: never silently
 * change benchmark numbers). README.ar.md translates the human-facing prose,
 * headers, metric labels, and outcome labels into Arabic while keeping every
 * number, command, file path, and technical identifier unchanged — so the numeric
 * token sequence matches the canonical block exactly.
 *
 * Modes:
 *   node scripts/readme-benchmark.mjs            # rewrite the block everywhere
 *   node scripts/readme-benchmark.mjs --check    # exit 1 if any file is stale
 *   node scripts/readme-benchmark.mjs --print    # print the canonical (en) block
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUMMARY = join(ROOT, "benchmarks", "published", "campaign-2026-06-20.summary.json");
const START = "<!-- BENCH:START -->";
const END = "<!-- BENCH:END -->";

const argv = process.argv.slice(2);
const mode = argv.includes("--check") ? "check" : argv.includes("--print") ? "print" : "write";

const summary = JSON.parse(readFileSync(SUMMARY, "utf8"));
const DATE = summary.createdAt.slice(0, 10);

// ---- formatting (numbers — identical across languages) ---------------------
function fmt(kind, x) {
  if (x == null) return "n/a";
  if (kind === "rate") return `${Math.round(x * 100)}%`;
  if (kind === "ms") {
    const sec = x / 1000;
    return sec >= 1 ? `${(Math.round(sec * 10) / 10).toString()} s` : `${Math.round(x)} ms`;
  }
  if (kind === "tok") return Math.round(x).toLocaleString("en-US");
  return (Math.round(x * 10) / 10).toString();
}
function fmtDelta(kind, m) {
  if (m.deltaAbs == null) return "n/a";
  const sign = (v) => (v > 0 ? "+" : "") + v;
  if (kind === "rate") return `${sign(Math.round(m.deltaAbs * 100))} pp`;
  if (kind === "ms") {
    const sec = m.deltaAbs / 1000;
    return Math.abs(sec) >= 1 ? `${sign(Math.round(sec * 10) / 10)} s` : `${sign(Math.round(m.deltaAbs))} ms`;
  }
  if (kind === "tok") return sign(Math.round(m.deltaAbs));
  return sign(Math.round(m.deltaAbs * 10) / 10);
}

const HEADLINE_ROWS = [
  "successRate", "kawnAutoInvoked", "filesFound", "openedPrecision",
  "filesOpened", "toolCalls", "timeToFirstRelevantMs", "wallMs", "outputTokens",
];

// Arabic metric labels (by metric key) and outcome labels. Technical terms
// (recall, precision, wall, tokens) are kept in parentheses by design.
const AR_LABELS = {
  successRate: "صحة المهمّة",
  kawnAutoInvoked: "استدعاء KawnGraph تلقائيًا",
  filesFound: "الملفات ذات الصلة المُكتشَفة (recall)",
  openedPrecision: "دقّة الملفات المفتوحة (precision)",
  filesOpened: "عدد الملفات المفتوحة المتمايزة",
  toolCalls: "عدد نداءات الأدوات",
  timeToFirstRelevantMs: "الزمن حتى أول ملف ذي صلة",
  wallMs: "الزمن الكلي (wall)",
  outputTokens: "tokens الخرج",
};
const AR_OUTCOME = { Improved: "محسّن", Neutral: "محايد", Regressed: "متراجع", "Insufficient data": "بيانات غير كافية" };
const AR_GOLDVAL = { "all retained runs have a valid gold reference": "جميع الجلسات المُحتفَظ بها لها مرجع ذهبي صالح" };

function agentTable(cell, lang) {
  const header =
    lang === "ar"
      ? ["| المقياس | بدون KawnGraph | مع KawnGraph | الفرق |", "| --- | --- | --- | --- |"]
      : ["| Metric | Without KawnGraph | With KawnGraph | Difference |", "| --- | --- | --- | --- |"];
  const L = [...header];
  for (const key of HEADLINE_ROWS) {
    const m = cell.metrics[key];
    if (!m) continue;
    const label = lang === "ar" ? AR_LABELS[key] ?? m.label : m.label;
    L.push(`| ${label} | ${fmt(m.kind, m.without)} | ${fmt(m.kind, m.with)} | ${fmtDelta(m.kind, m)} |`);
  }
  return L.join("\n");
}

// link targets differ by file location (root vs docs/i18n)
function links(i18n) {
  return i18n
    ? { bench: "../BENCHMARKS.md", artifact: `../../benchmarks/published/campaign-${DATE}.md` }
    : { bench: "docs/BENCHMARKS.md", artifact: `benchmarks/published/campaign-${DATE}.md` };
}

function renderBlock(s, { i18n = false, lang = "en" } = {}) {
  const ln = links(i18n);
  const claude = s.cells.find((c) => c.agent === "claude" && c.headline);
  const codex = s.cells.find((c) => c.agent === "codex" && c.headline);
  const ht = s.headlineTask;
  const v = s.validation;
  const ar = lang === "ar";
  const goldVal = ar ? AR_GOLDVAL[v.goldValidation] ?? v.goldValidation : v.goldValidation;
  const excl = v.excludedRuns
    ? ar
      ? ` استُبعدت ${v.excludedRuns} من ${v.totalRuns} جلسة لأسباب تتعلّق بأصل المرجع الذهبي (انظر الأثر).`
      : ` ${v.excludedRuns} of ${v.totalRuns} sessions were excluded for gold provenance (see the artifact).`
    : "";
  const L = [];
  L.push(START);
  L.push("");
  L.push(`<!-- Generated by scripts/readme-benchmark.mjs from benchmarks/published/campaign-${DATE}.summary.json — do not edit by hand. -->`);
  L.push("");
  if (ar) {
    L.push(
      `مِعمار A/B محلي: شُغِّلت ${v.totalRuns} جلسة، منها ${v.usableRuns} صالحة عبر ${s.cells.length} خلايا مهام، ` +
        `seed ${s.seed}، ${s.repeat} تكرارات لكل ذراع (${v.minSamplePerArm}/ذراع بعد التجميع — **استكشافي، n<5، توجيهي فقط**). ` +
        `نفس الوكيل، ونفس المهمّة، ونفس لقطة المستودع؛ A = بدون KawnGraph، B = معه. Δ = B − A.${excl} ` +
        `التحقّق من المرجع الذهبي: ${goldVal}.`,
    );
  } else {
    L.push(
      `Local A/B harness: ${v.totalRuns} sessions run, ${v.usableRuns} usable across ${s.cells.length} task cells, ` +
        `seed ${s.seed}, ${s.repeat} repeats per arm (${v.minSamplePerArm}/arm after grouping — **exploratory, n<5, directional only**). ` +
        `Same agent, same task, same repository snapshot; A = without KawnGraph, B = with. Δ = B − A.${excl} ` +
        `Gold validation: ${goldVal}.`,
    );
  }
  L.push("");
  L.push(
    ar
      ? `**المهمّة الرئيسية — \`${ht.taskId}\` (${ht.mode}) على \`${ht.projectId}\`:**`
      : `**Headline task — \`${ht.taskId}\` (${ht.mode}) on \`${ht.projectId}\`:**`,
  );
  L.push("");
  L.push(
    ar
      ? `*Claude Code — نفس المهمّة، نفس المستودع، نفس النموذج (النموذج غير مثبّت في الأثر):*`
      : `*Claude Code — same task, same repository, same model (model not pinned in artifact):*`,
  );
  L.push("");
  L.push(agentTable(claude, lang));
  L.push("");
  L.push(
    ar
      ? `*Codex — نفس المهمّة، نفس المستودع، نفس النموذج (النموذج غير مثبّت في الأثر):*`
      : `*Codex — same task, same repository, same model (model not pinned in artifact):*`,
  );
  L.push("");
  L.push(agentTable(codex, lang));
  L.push("");
  L.push(
    ar
      ? `> KawnGraph يعتمد على المهمّة. قد يقلّل استكشاف المستودع في الأعمال متعددة الملفات غير المألوفة، بينما يضيف عبئًا على المهام المركّزة أصلًا. انظر المنهجية الكاملة والقيود في [docs/BENCHMARKS.md](${ln.bench}).`
      : `> KawnGraph is task-dependent. It can reduce repository exploration on unfamiliar multi-file work, while adding overhead on already-focused tasks. See the full methodology and limitations in [docs/BENCHMARKS.md](${ln.bench}).`,
  );
  L.push("");
  L.push(
    ar
      ? `**أين ساعد، وأين كان محايدًا، وأين أضرّ (كل الـ${s.cells.length} خلايا مهام):**`
      : `**Where it helped, was neutral, or hurt (all ${s.cells.length} task cells):**`,
  );
  L.push("");
  L.push(
    ar
      ? `| عائلة المهمّة | الوكيل | النمط | النتيجة | Δ نداءات الأدوات | Δ الزمن |`
      : `| Task family | Agent | Mode | Outcome | Tool-call Δ | Time Δ |`,
  );
  L.push(`| --- | --- | --- | --- | --- | --- |`);
  for (const c of s.cells) {
    const outcome = ar ? AR_OUTCOME[c.outcome] ?? c.outcome : c.outcome;
    L.push(`| ${c.taskId} | ${c.agent} | ${c.mode} | ${outcome} | ${fmtDelta("num", c.metrics.toolCalls)} | ${fmtDelta("ms", c.metrics.wallMs)} |`);
  }
  L.push("");
  L.push(
    ar
      ? `تُشتقّ تسميات النتيجة (\`Improved\` محسّن / \`Neutral\` محايد / \`Regressed\` متراجع / \`Insufficient data\` بيانات غير كافية) حتميًا من فروق نداءات الأدوات والزمن؛ وكل خلية n=${v.minSamplePerArm}/ذراع، فجميعها توجيهية. الجداول الكاملة لكل مقياس: [benchmarks/published/campaign-${DATE}.md](${ln.artifact}).`
      : `Outcome labels (\`Improved\` / \`Neutral\` / \`Regressed\` / \`Insufficient data\`) are derived ` +
          `deterministically from tool-call and wall-time deltas; every cell is n=${v.minSamplePerArm}/arm, so all are directional. ` +
          `Full per-metric tables: [benchmarks/published/campaign-${DATE}.md](${ln.artifact}).`,
  );
  L.push("");
  L.push(END);
  return L.join("\n");
}

if (mode === "print") {
  process.stdout.write(renderBlock(summary, { i18n: false, lang: "en" }) + "\n");
  process.exit(0);
}

// ---- targets ---------------------------------------------------------------
const targets = [
  { file: join(ROOT, "README.md"), i18n: false, lang: "en" },
  { file: join(ROOT, "README.ar.md"), i18n: false, lang: "ar" },
];
const i18nDir = join(ROOT, "docs", "i18n");
for (const f of readdirSync(i18nDir)) {
  if (/^README\..+\.md$/.test(f)) targets.push({ file: join(i18nDir, f), i18n: true, lang: "en" });
}

let drift = false;
for (const { file, i18n, lang } of targets) {
  if (!existsSync(file)) { if (mode !== "check") console.error(`[readme-benchmark] skip (missing): ${file}`); continue; }
  const src = readFileSync(file, "utf8");
  const si = src.indexOf(START), ei = src.indexOf(END);
  if (si < 0 || ei < 0) { console.error(`[readme-benchmark] no BENCH markers in ${file}`); drift = true; continue; }
  const next = src.slice(0, si) + renderBlock(summary, { i18n, lang }) + src.slice(ei + END.length);
  if (next === src) { if (mode !== "check") console.log(`[readme-benchmark] up to date: ${file.replace(ROOT, ".")}`); continue; }
  if (mode === "check") { console.error(`[readme-benchmark] OUT OF DATE: ${file.replace(ROOT, ".")}`); drift = true; }
  else { writeFileSync(file, next, "utf8"); console.log(`[readme-benchmark] updated: ${file.replace(ROOT, ".")}`); }
}
process.exit(drift ? 1 : 0);
