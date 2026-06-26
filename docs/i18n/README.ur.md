<!-- KAWN-TRANSLATION
lang: ur
status: machine-assisted
canonical: README.md
canonical-sha: 3abf5a40e951f30aa3a3038e3d8696a9df1e5881002022bbda543f87204f9f64
-->

<div dir="rtl">

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../brand/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../../brand/logo-light.svg">
  <img src="../../brand/logo.svg" alt="KawnGraph" width="320">
</picture>

### ایجنٹ کانٹیکسٹ کائنات (The Agent Context Universe)

**ایک پروجیکٹ کائنات۔ ہر کوڈنگ ایجنٹ۔**

KawnGraph کوڈ، دستاویزات (docs)، ڈیٹا، ٹیسٹ اور Git تبدیلیوں کو شواہد پر مبنی
**Context Packs** میں نقشہ بند کرتا ہے، تاکہ Claude، Codex اور Cursor پوری
ریپازٹری پڑھے بغیر درست فائلوں تک پہنچ سکیں۔

[![License: MIT](https://img.shields.io/badge/License-MIT-22C7A9.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518-4C8DFF.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-4C8DFF.svg)](tsconfig.base.json)
[![Local-first](https://img.shields.io/badge/Local--first-no%20cloud-42D392.svg)](docs/PRIVACY.md)
[![No telemetry](https://img.shields.io/badge/Telemetry-none-42D392.svg)](docs/PRIVACY.md)
[![Support](https://img.shields.io/badge/Support-get%20help-4C8DFF.svg)](SUPPORT.md)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Abdulrahman%20Alnashri-0A66C2.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)
[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA.svg?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/xd7fx)

<!-- LANGBAR:START -->

[English](../../README.md) ·
[العربية](../../README.ar.md) ·
[Español](README.es.md) ·
[Français](README.fr.md) ·
[Deutsch](README.de.md) ·
[Português (BR)](README.pt-BR.md) ·
[简体中文](README.zh-CN.md) ·
[繁體中文](README.zh-TW.md) ·
[日本語](README.ja.md) ·
[한국어](README.ko.md) ·
[हिन्दी](README.hi.md) ·
[Bahasa Indonesia](README.id.md) ·
[Türkçe](README.tr.md) ·
[Русский](README.ru.md) ·
[Italiano](README.it.md) ·
[فارسی](README.fa.md) ·
**اردو** ·
[Polski](README.pl.md) ·
[Nederlands](README.nl.md) ·
[Українська](README.uk.md) ·
[Tiếng Việt](README.vi.md) ·
[ภาษาไทย](README.th.md) ·
[Svenska](README.sv.md) ·
[Ελληνικά](README.el.md) ·
[Română](README.ro.md) ·
[Čeština](README.cs.md) ·
[Suomi](README.fi.md) ·
[Dansk](README.da.md) ·
[Norsk](README.no.md) ·
[Magyar](README.hu.md) ·
[עברית](README.he.md)

<sub>English is canonical · العربية is AI-assisted · owner review pending · the other 29 languages are machine-assisted (human review needed) — see [translation status](STATUS.md).</sub>

<!-- LANGBAR:END -->

> یہ ترجمہ مشینی معاونت سے کیا گیا (machine-assisted) ہے اور اس میں غلطیاں ہو سکتی
> ہیں۔ مستند (canonical) انگریزی نسخہ [README.md](../../README.md) ہے؛ ترجمے کی
> حالت کے لیے [STATUS.md](STATUS.md) دیکھیں۔

**[فوری آغاز](#quick-start)** ·
**[یہ کیسے کام کرتا ہے](#how-it-works)** ·
**[Studio](#studio)** ·
**[بینچ مارکس](#benchmarks)** ·
**[دستاویزات](#documentation)** ·
**[تعاون](#contributing)**

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="ایک ٹاسک ('Fix the Zid OAuth callback') KawnGraph میں جاتا ہے، جو ایک ٹوکن-بجٹ والا Context Pack واپس کرتا ہے: لازمی پڑھنے والی فائلیں، متعلقہ دستاویزات، ٹیبلز، ٹیسٹ، خطرات، خارج شدہ فہرست، اور ایک اعتماد اسکور۔" width="860">
</div>

---

## KawnGraph کیوں؟

جب آپ کسی کوڈنگ ایجنٹ کو کوئی ٹاسک دیتے ہیں، تو وہ عموماً *پڑھنے* سے شروع کرتا ہے —
بہت کچھ۔ وہ درجنوں فائلیں کھولتا ہے، دوبارہ اخذ کرتا ہے کہ روٹس ڈیٹابیس تک کیسے
پہنچتے ہیں، اور ہر درخواست پر وہی ذہنی نقشہ نئے سرے سے بناتا ہے۔ یہ سست ہے، ٹوکن کے
لحاظ سے مہنگا ہے، اور اکثر غیر درست بھی: ایجنٹ اس ایک فائل کو نظرانداز کر دیتا ہے جو
اہم ہے اور پانچ ایسی فائلوں میں ڈوب جاتا ہے جو اہم نہیں ہیں۔

KawnGraph ریپازٹری کو **ایک بار** اسکین کرتا ہے، اس بات کا ایک تہہ دار، شواہد پر
مبنی گراف بناتا ہے کہ چیزیں کیسے ایک دوسرے سے جڑی ہیں، پھر کسی مخصوص ٹاسک کے لیے
**اُن چند فائلوں** کے ساتھ جواب دیتا ہے جو اہم ہیں — ساتھ ہی متعلقہ دستاویزات،
متعلقہ ڈیٹابیس ٹیبلز، چلانے کے لیے ٹیسٹ، اور دھیان رکھنے کے قابل خطرات۔ یہ بنڈل ایک
**Context Pack** ہے۔ گراف بنیاد ہے؛ Context Pack مصنوعہ (product) ہے۔

> **ایجنٹس کو نقشہ دیں، پورا ریپو نہیں۔** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## فوری آغاز (Quick Start)

KawnGraph کو **ایک ہی کمانڈ** سے انسٹال اور چلائیں — `npx` اسے لے آتا ہے، کلون کرنے
کی کوئی ضرورت نہیں (Node ≥ 18):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

**یا سورس سے** (یہ monorepo، تعاون کنندگان کے لیے — [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

پھر اپنا ایجنٹ کھولیں اور بس اپنا ٹاسک بیان کریں — وہ خود ہی اُن چند فائلوں کو کھینچ
لیتا ہے جو اہم ہیں۔ کوئی API کیز نہیں، کوئی ٹیلیمیٹری نہیں، اسکین یا بازیافت کے دوران
کوئی نیٹ ورک کال نہیں۔ نئے ہیں؟ **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**
سے شروع کریں۔

---

## اسے اپنے کوڈنگ ایجنٹ سے جوڑیں

KawnGraph کا مقصد یہ ہے کہ ایجنٹ نقشے تک **خودکار طور پر** پہنچے۔ ایک کمانڈ کسی
پروجیکٹ کو اُن ایجنٹس سے جوڑ دیتی ہے جنہیں آپ استعمال کرتے ہیں — `CLAUDE.md` یا
`AGENTS.md` میں ترمیم کیے بغیر، اور ہر تبدیلی قابلِ واپسی ہے:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` آپ کے کوڈنگ ایجنٹس کا پتہ لگاتا ہے — **Claude Code**، **Codex**، **Cursor**،
**Copilot**، **Gemini CLI**، اور **Aider** (ساتھ ہی ایک `generic` Markdown/JSON ایکسپورٹ
اور ایک اختیاری **مقامی LLM**) — اور پروجیکٹ کے دائرے میں محدود ایک **read-only انضمام**
انسٹال کرتا ہے (`.mcp.json`، `.cursor/mcp.json`، `.codex/config.toml`،
`.vscode/mcp.json`، `.gemini/settings.json`، یا ایک Aider کانٹیکسٹ فائل)، جس چیز کو
بھی چھوتا ہے اس کا بیک اپ لیتا ہے اور ہر MCP سرور کی ایک لائیو ہینڈشیک سے تصدیق کرتا
ہے۔ مکمل معاہدہ: **[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**۔

**MCP سرور** ایک read-only stdio JSON-RPC لوپ ہے جس میں **کوئی MCP SDK نہیں** (ہاتھ سے
لکھا گیا) اور چار ٹولز ہیں:

| ٹول | یہ کیا کرتا ہے |
| ---- | ------------ |
| `kawn_context` | کسی ٹاسک کے لیے ٹوکن-بجٹ والا Context Pack۔ |
| `kawn_query` | گراف پر درجہ بند، موڈ کے دائرے میں محدود تلاش۔ |
| `kawn_affected` | الٹا اثر: کسی symbol پر کیا انحصار کرتا ہے۔ |
| `kawn_changes` | موجودہ تبدیلیوں کے سیٹ کا اثر (غیر کمٹ شدہ، یا کسی برانچ بمقابلہ بیس ref)۔ صرف مقامی git۔ |

یہ گراف کو **صرف پڑھتا ہے** — یہ کبھی اسکین، دوبارہ تعمیر، یا تحریر نہیں کرتا (جب
گراف پرانا لگے تو یہ خبردار کرتا ہے اور `kawn update` کی طرف اشارہ کرتا ہے)۔

---

## یہ کیسے کام کرتا ہے

ایک پروجیکٹ صرف کوڈ نہیں ہوتا۔ یہ کوڈ **اور** دستاویزات **اور** SQL **اور** ٹیسٹ
**اور** وہ کنفیگریشن ہے جو انہیں آپس میں باندھتی ہے۔ KawnGraph ہر ایک کو ایک الگ
**تہہ (layer)** کے طور پر ماڈل کرتا ہے، تاکہ کوئی کیوری بالکل وہی مانگے جس کی اسے
ضرورت ہے اور وہ نہیں جو اسے نہیں چاہیے — ایک code-impact کیوری کبھی مارکیٹنگ
دستاویزات نہیں کھینچتی؛ ایک docs کیوری اُس وقت تک خام call graphs واپس نہیں کرتی جب
تک آپ نہ مانگیں۔

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph آپ کی ریپو کو deterministic اسکینرز کے ساتھ پڑھ کر .kawn/graph.json پر ایک تہہ دار گراف بناتا ہے (code, data, config, docs, test تہیں)، جو kawn CLI، MCP سرور، اور Studio کو read-only پیش کیا جاتا ہے۔ کوئی نیٹ ورک نہیں، کوئی LLM نہیں، کوئی ٹیلیمیٹری نہیں۔" width="860">
</div>

| تہہ      | مثالیں                                              |
| -------- | --------------------------------------------------- |
| `code`   | فائلیں، فنکشنز، کلاسز، imports، calls، routes        |
| `data`   | SQL ٹیبلز، migrations، foreign keys                 |
| `config` | workspace پیکیجز، انحصارات (dependencies)           |
| `docs`   | markdown سیکشنز، links، mentions                    |
| `test`   | ٹیسٹ اور وہ کیا کور کرتے ہیں                          |

ہر edge **شواہد** (سورس پاتھ، لائن رینج، snippet) اور ایک اعتماد سطح رکھتا ہے —
میکانکی طور پر اخذ کیا گیا جہاں اسکینر اسے منسلک کر سکے؛ ہر node کا ایک **مستحکم،
content-addressable ID** ہوتا ہے تاکہ گراف اسکینز کے درمیان diffable رہے۔ گہرا ماڈل:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**۔

### ایک Context Pack، شروع تا آخر

```text
$ kawn ask "fix the Zid OAuth callback that writes store tokens"

Must-read
  app/api/zid/oauth/callback/route.ts     entry route
  packages/zid/src/oauth.ts               token exchange
  packages/db/.../storeTokens.ts          writes store_tokens
Docs
  docs/zid-oauth-core.md#callback-flow     expected behaviour
Tables
  store_tokens (written) · merchants (fk)
Tests        oauth.test.ts
Risks        token encryption · tenant isolation
Excluded     unrelated UI components (over budget)   ·   confidence 0.6
```

یہی pack مارک ڈاؤن، JSON، یا ایجنٹ-غیر جانبدار **Universal Context Protocol**
(`--format ucp` / `ucp-md`) کے طور پر دستیاب ہے۔ مزید:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**۔

---

## Studio

`kawn map` **KawnGraph Studio** کھولتا ہے — ایک مقامی، **read-only** ایکسپلورر جو
`127.0.0.1` پر پیش کیا جاتا ہے، موجودہ `.kawn/graph.json` کو پڑھتا ہے اور کبھی
اسکین، دوبارہ تعمیر، یا تحریر نہیں کرتا۔ یہ ایک تعاملی 2D گراف، ایک قابلِ توسیع 3D
"Universe" ستارہ-نقشہ (اس طرح بجٹ کیا گیا کہ یہ کبھی پورا بڑا گراف ایک ساتھ نہیں
کھینچتا)، ایک Context-Pack بلڈر، الٹا اثر (reverse-impact)، Git تبدیلیوں کے
ویوز، اور ایک طرزِ عمل بینچ مارک ویو پیش کرتا ہے۔ انگریزی اور عربی میں بنایا گیا
(RTL-aware)۔ اسے سورس سے چلائیں: `pnpm studio:build && pnpm kawn map`۔

<div align="center">
<img src="../assets/studio-universe.webp" alt="KawnGraph Studio — اس ریپازٹری کے اپنے گراف کا read-only 3D 'Universe' ویو: 1,261 nodes جو تہہ کے لحاظ سے جمع کیے گئے ہیں (Code 815، Docs 430، Config 13، Data 3) کنکشن لائنوں کے ساتھ، نیز فی-تہہ/قسم/edge فلٹرز۔" width="860">
<br><sub>3D <b>Universe</b> ویو — اس ریپازٹری کا اپنا گراف (1,261 nodes)، read-only۔</sub>
</div>

<div align="center">
<img src="../assets/studio-map.webp" alt="KawnGraph Studio — بنڈل شدہ مثالی پروجیکٹ کا 2D گراف ویو: فائلیں، فنکشنز، routes، ٹیبلز، اور دستاویزات بطور nodes جن پر لیبل والے شواہد پر مبنی edges ہیں (imports، calls، defines، mentions، explains)، نیز تہہ/قسم/edge فلٹرز۔" width="860">
<br><sub>2D <b>گراف</b> ویو — بنڈل شدہ مثالی پروجیکٹ، تہہ / قسم / edge فلٹرز کے ساتھ۔</sub>
</div>

---

## KawnGraph بمقابلہ سادہ ریپازٹری تلاش

*طریقوں* کا ایک غیر جانبدار موازنہ (کسی حریف پر حملہ نہیں)۔ ہر خانہ قابلِ دفاع ہے؛
"varies" کا مطلب ہے کہ یہ مخصوص ٹول پر منحصر ہے۔

| صلاحیت | سادہ تلاش | عمومی RAG | عام graph viewer | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministic مقامی اسکین | ✅ | varies | ✅ | ✅ |
| Symbol-سطح کے تعلقات | ❌ | varies | ✅ | ✅ |
| Docs / data / test تہیں | ❌ | varies | varies | ✅ |
| edges پر شواہد | ❌ | ❌ | varies | ✅ |
| محدود اثر تجزیہ | ❌ | ❌ | varies | ✅ |
| Git-تبدیلی کا کانٹیکسٹ | varies | ❌ | ❌ | ✅ |
| ٹوکن-بجٹ والے Context Packs | ❌ | varies | ❌ | ✅ |
| Read-only MCP بازیافت | ❌ | varies | varies | ✅ |
| کوئی اندرونی LLM درکار نہیں | ✅ | ❌ | ✅ | ✅ |

ایک پختہ graph ٹول کے مقابلے میں ایک تاریخ شدہ، ماخذ کے ساتھ، تین-کالم موازنہ (وہ
صلاحیتیں جن میں KawnGraph آگے ہے **اور** وہ جن میں نہیں) یہاں موجود ہے:
**[docs/COMPARISON.md](../COMPARISON.md)**۔

---

## بینچ مارکس (Benchmarks)

KawnGraph ایک **مقامی A/B harness** کے ساتھ آتا ہے جو *وہی* ایجنٹ *اسی* ٹاسک پر
KawnGraph **کے ساتھ بمقابلہ بغیر** چلاتا ہے اور طرزِ عمل ریکارڈ کرتا ہے۔ نتائج
ایماندار اور **ٹاسک پر منحصر** ہیں — بشمول غیر جانبدار اور منفی صورتیں۔

<!-- BENCH:START -->

<!-- Generated by scripts/readme-benchmark.mjs from benchmarks/published/campaign-2026-06-20.summary.json — do not edit by hand. -->

Local A/B harness: 72 sessions run, 60 usable across 10 task cells, seed 1, 3 repeats per arm (3/arm after grouping — **exploratory, n<5, directional only**). Same agent, same task, same repository snapshot; A = without KawnGraph, B = with. Δ = B − A. 12 of 72 sessions were excluded for gold provenance (see the artifact). Gold validation: all retained runs have a valid gold reference.

**Headline task — `zid-oauth` (retrieval) on `nextjs-supabase`:**

*Claude Code — same task, same repository, same model (model not pinned in artifact):*

| Metric | Without KawnGraph | With KawnGraph | Difference |
| --- | --- | --- | --- |
| task correctness | 100% | 100% | 0 pp |
| automatic KawnGraph invocation | 0% | 100% | +100 pp |
| relevant files found (recall) | 100% | 93% | -7 pp |
| opened-file precision | 83% | 89% | +6 pp |
| distinct files opened | 6 | 5.3 | -0.7 |
| tool calls | 8.3 | 8.7 | +0.3 |
| time to first relevant file | 20.7 s | 22.4 s | +1.7 s |
| total wall time | 54.6 s | 61.9 s | +7.3 s |
| output tokens | 2,867 | 3,130 | +262 |

*Codex — same task, same repository, same model (model not pinned in artifact):*

| Metric | Without KawnGraph | With KawnGraph | Difference |
| --- | --- | --- | --- |
| task correctness | 100% | 100% | 0 pp |
| automatic KawnGraph invocation | 0% | 0% | 0 pp |
| relevant files found (recall) | 80% | 87% | +7 pp |
| opened-file precision | 25% | 61% | +36 pp |
| distinct files opened | 1 | 4.3 | +3.3 |
| tool calls | 2.7 | 8 | +5.3 |
| time to first relevant file | 18.7 s | 17.8 s | -884 ms |
| total wall time | 36.4 s | 41 s | +4.5 s |
| output tokens | 822 | 1,082 | +260 |

> KawnGraph is task-dependent. It can reduce repository exploration on unfamiliar multi-file work, while adding overhead on already-focused tasks. See the full methodology and limitations in [docs/BENCHMARKS.md](../BENCHMARKS.md).

**Where it helped, was neutral, or hurt (all 10 task cells):**

| Task family | Agent | Mode | Outcome | Tool-call Δ | Time Δ |
| --- | --- | --- | --- | --- | --- |
| context-pack-ranking | claude | retrieval | Neutral | -0.3 | +6.2 s |
| docs-to-code-linking | claude | retrieval | Neutral | -0.3 | +9.6 s |
| freshness-gate | claude | retrieval | Improved | -9.7 | -54.6 s |
| oauth-code-guard | claude | e2e | Neutral | -0.3 | +5.9 s |
| zid-oauth | claude | retrieval | Regressed | +0.3 | +7.3 s |
| context-pack-ranking | codex | retrieval | Regressed | +4 | +33.3 s |
| docs-to-code-linking | codex | retrieval | Improved | -0.7 | -4.6 s |
| freshness-gate | codex | retrieval | Neutral | 0 | -2.1 s |
| oauth-code-guard | codex | e2e | Regressed | 0 | +1.5 s |
| zid-oauth | codex | retrieval | Regressed | +5.3 | +4.5 s |

Outcome labels (`Improved` / `Neutral` / `Regressed` / `Insufficient data`) are derived deterministically from tool-call and wall-time deltas; every cell is n=3/arm, so all are directional. Full per-metric tables: [benchmarks/published/campaign-2026-06-20.md](../../benchmarks/published/campaign-2026-06-20.md).

<!-- BENCH:END -->

طریقہ کار، ماحول، نمونے کے سائز، فی-میٹرک ٹیبلز، اور حدود:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — کمٹ شدہ، تصدیق شدہ آرٹیفیکٹ سے تیار کیا
گیا جو [`benchmarks/published/`](../../benchmarks/published/) میں ہے۔

---

## معاون اسکینرز اور تہیں

ہر زبان/فارمیٹ ایک ورژن شدہ **scanner plugin** ہے جو ایک ہی رجسٹری کے پیچھے ہے
(detect → scan → finalize): deterministic ترتیب، فی-فائل ناکامی کی علیحدگی، واضح
رجسٹریشن، اور محدود فائل سائز۔

| زبان / فارمیٹ | نکالا گیا |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

دونوں code اسکینرز میں دو دانستہ اخراج: methods/nested functions کبھی الگ nodes
نہیں ہوتے (ایک method اپنی class پر بطور metadata سوار ہوتا ہے)، اور ambient
declaration files (`.d.ts`, `.pyi`) کبھی دعویٰ نہیں کی جاتیں۔ تفصیلات:
**[docs/SCANNERS.md](../SCANNERS.md)**۔

---

## رازداری اور سیکیورٹی

- **ڈیفالٹ کے طور پر کوئی نیٹ ورک نہیں۔** اسکین اور بازیافت آپ کی ریپو کو پڑھتے ہیں
  اور `.kawn/` کے تحت JSON لکھتے ہیں۔ کچھ بھی مشین سے باہر نہیں جاتا۔
- **کوئی اندرونی LLM نہیں۔** کوڈ، دستاویزات، اور SQL کو ساختی طور پر پارس کیا جاتا
  ہے؛ AI افزودگی اختیاری اور local-first ہے۔
- **کوئی ٹیلیمیٹری نہیں۔ ڈیفالٹ کے طور پر کوئی کیوری لاگنگ نہیں۔**
- **Read-only MCP۔** سرور گراف پیش کرتا ہے؛ یہ کبھی اسکین، دوبارہ تعمیر، یا تحریر
  نہیں کرتا — اور ایسے گراف کو پیش کرنے سے انکار کرتا ہے جس کے schema پر وہ بھروسہ
  نہ کر سکے۔
- **قابلِ واپسی، پروجیکٹ کے دائرے میں محدود انضمام۔** Atomic تحریریں، ٹائم اسٹیمپ
  شدہ بیک اپس، ساختی (نہ کہ string) config ترمیمات؛ کبھی `CLAUDE.md` /
  `AGENTS.md` میں ترمیم نہیں کرتا، ڈیفالٹ کے طور پر کبھی global config کو نہیں
  چھوتا۔

مکمل ماڈل: **[docs/PRIVACY.md](../PRIVACY.md)**۔ کسی کمزوری کی نجی طور پر اطلاع
**[SECURITY.md](../../SECURITY.md)** کے ذریعے دیں۔

---

## حالت اور حدود

KawnGraph **فعال ترقی** میں ہے (`v0.1.0`، ابھی npm پر شائع نہیں ہوا)۔ شروع تا آخر
بنایا اور آزمایا گیا: code/data/config/docs/test گراف، docs-to-code links،
موڈ کے دائرے والی کیوری، اثر تجزیہ، Git/PR اثر، ٹوکن-بجٹ والے Context Packs،
Universal Context Protocol، read-only MCP سرور، ایک-کمانڈ ایجنٹ سیٹ اپ
(Claude Code، Codex، Cursor، Copilot، Gemini، Aider، generic ایکسپورٹ، مقامی LLM)،
Studio، اور A/B بینچ مارک harness۔

**ایماندار حدود۔** شائع شدہ بینچ مارک **اکتشافی (exploratory) ہے (n<5 فی arm —
سمتی، بامعنی نہیں)**۔ KawnGraph سب سے زیادہ غیر مانوس کثیر-فائل دریافت میں مدد کرتا
ہے اور پہلے سے مرتکز سنگل-فائل ٹاسکس پر اوور ہیڈ بڑھا سکتا ہے۔ ابھی نہیں بنایا گیا:
اختیاری suggest-only hooks، بصری تہہ، semantic/AI افزودگی، اور ایک runtime تہہ —
یہ سب ڈیزائن کے لحاظ سے اختیاری ہیں۔ دیکھیں
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md)۔

---

## دستاویزات

| گائیڈ | اندر کیا ہے |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | انسٹال، اسکین، پہلا Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | MCP سیٹ اپ معاہدہ، قابلِ واپسی |
| [Context Packs](../CONTEXT_PACKS.md) | درجہ بندی، بجٹ، UCP wire format |
| [Graph model](../GRAPH_MODEL.md) | Nodes، edges، layers، شواہد، IDs |
| [Scanners](../SCANNERS.md) | ہر زبان plugin کیا نکالتا ہے |
| [Benchmarks](../BENCHMARKS.md) | طریقہ کار، ماحول، مکمل نتائج |
| [Comparison](../COMPARISON.md) | تاریخ شدہ، ماخذ کے ساتھ صلاحیتوں کا موازنہ |
| [Privacy](../PRIVACY.md) | فی تہہ ڈیٹا کی حدود |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | عام مسائل اور سوالات |

---

## تعاون (Contributing)

تعاون خوش آئند ہے۔ سورس سے بنائیں، سویٹ چلائیں، اور گائیڈ پڑھیں:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

سیٹ اپ، روایات، اور وہ رازداری جائزہ جس سے ہر PR گزرتا ہے کے لیے
**[CONTRIBUTING.md](../../CONTRIBUTING.md)** دیکھیں؛ کمیونٹی توقعات کے لیے
**[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)**؛ کوئی زبان شامل کرنے یا اس کا
جائزہ لینے کے لیے **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**؛ اور جہاں سوالات
پوچھے جا سکتے ہیں اس کے لیے **[SUPPORT.md](../../SUPPORT.md)**۔

---

## لائسنس اور اعترافات

**[MIT](../../LICENSE)** © KawnGraph تعاون کنندگان۔

تخلیق اور دیکھ بھال **[Abdulrahman Alnashri](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)** کی طرف سے۔

**Kawn** (عربی **كَوْن** — *کائنات، عالم، وجود*) ایک ریپازٹری کو علم کی ایک زندہ
کائنات کے طور پر دیکھتا ہے؛ **Graph** اس کے مرکز میں موجود شواہد پر مبنی Agent
Context Graph ہے۔ [TypeScript](https://www.typescriptlang.org/)،
[Vite](https://vitejs.dev/)، [React](https://react.dev/)،
[React Flow](https://reactflow.dev/)، [Three.js](https://threejs.org/)، اور
[`@lezer/python`](https://lezer.codemirror.net/) کے ساتھ بنایا گیا۔

</div>
