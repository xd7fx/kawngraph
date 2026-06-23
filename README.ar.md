<!-- KAWN-TRANSLATION
lang: ar
status: ai-assisted
canonical: README.md
canonical-sha: 378fe71dbff6e5a8bebc6ce9c8c96d427ad754aaaf43ef147000acf36ac4e022
-->

<div dir="rtl" align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="brand/logo-light.svg">
  <img src="brand/logo.svg" alt="KawnGraph — كون قراف" width="320">
</picture>

### كون السياق للوكلاء

**كونٌ واحد للمشروع. لكل وكيل برمجة.**

يحوّل KawnGraph الكودَ والوثائق والبيانات والاختبارات وتغييرات Git إلى **حِزَم
سياق** مدعومة بالأدلة، حتى يصل Claude وCodex وCursor إلى الملفات الصحيحة دون قراءة
المستودع بأكمله.

[English](README.md) · **العربية** · [حالة الترجمات](docs/i18n/STATUS.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-22C7A9.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518-4C8DFF.svg)](package.json)
[![Local-first](https://img.shields.io/badge/Local--first-no%20cloud-42D392.svg)](docs/PRIVACY.md)
[![No telemetry](https://img.shields.io/badge/Telemetry-none-42D392.svg)](docs/PRIVACY.md)

</div>

<div dir="rtl">

---

<div align="center">
<img src="docs/assets/context-pack-flow.svg" alt="مهمّة («إصلاح ردّ نداء OAuth الخاص بزد») تدخل إلى KawnGraph فيعيد حزمة سياق محدودة الميزانية: الملفات الواجب قراءتها، والوثائق والجداول والاختبارات والمخاطر، وقائمة المُستبعَد، ودرجة ثقة." width="860">
</div>

---

## لماذا KawnGraph؟

حين تُسنِد مهمّةً إلى وكيل برمجة، فإنه عادةً يبدأ بـ*القراءة* — كثيرًا. يفتح عشرات
الملفات، ويعيد استنتاج كيف تصل المسارات إلى قاعدة البيانات، ويبني النموذج الذهني
نفسه في كل طلب. هذا بطيء، ومكلّف بالـtokens، وغالبًا غير دقيق: يفوته الملف الوحيد
المهم ويغرق في خمسة ملفات لا تهم.

يمسح KawnGraph المستودع **مرّةً واحدة**، ويبني رسمًا بيانيًا طبقيًا مدعومًا بالأدلة
لكيفية ترابط الأشياء، ثم يجيب — لمهمّة محدّدة — بـ**الملفات القليلة المهمّة**،
إضافةً إلى الوثائق ذات الصلة، وجداول قاعدة البيانات المرتبطة، والاختبارات التي
يجب تشغيلها، والمخاطر التي يجب الانتباه لها. هذه الحزمة هي **حزمة السياق**. الرسم
البياني هو الأساس؛ وحزمة السياق هي المنتج.

> **اعطِ الإيجنت الخريطة، مو المشروع كامل.** — *Give agents the map, not the repo.*

---

## البدء السريع

> **تنبيه:** حزمة npm باسم `kawngraph` **لم تُنشَر بعد**، لذلك فإن `npx kawngraph …`
> **غير متاح اليوم**. استخدم المسار من المصدر أدناه؛ ومسار `npx` معروض **بعد
> النشر**.

**اليوم — من المصدر** (هذا المستودع، Node ≥ 18 مع [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**بعد نشر npm** (التجربة المقصودة بأمرٍ واحد):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

ثم افتح وكيلك واكتب وصف مهمّتك فحسب — سيسحب الملفات القليلة المهمّة من تلقاء نفسه.
بلا مفاتيح API، بلا تتبّع، بلا أي اتصال بالشبكة أثناء المسح أو الاسترجاع. جديد على
الأداة؟ ابدأ من **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)**.

---

## اربطه بوكيل البرمجة لديك

جوهر KawnGraph أن يصل الوكيل إلى الخريطة **تلقائيًا**. أمرٌ واحد يربط المشروع
بالوكلاء الذين تستخدمهم — دون تعديل `CLAUDE.md` أو `AGENTS.md`، وكل تغيير قابل
للتراجع:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

يكتشف `setup` كلًّا من **Claude Code** و**Codex** و**Cursor** ويثبّت **تكامل MCP
للقراءة فقط** محصورًا بالمشروع (`.mcp.json` أو `.cursor/mcp.json` أو
`.codex/config.toml`)، مع أخذ نسخة احتياطية لأي ملف يمسّه والتحقق من الخادم
بمصافحةٍ حيّة. العقد الكامل في **[docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md)**.

**خادم MCP** هو stdio JSON-RPC للقراءة فقط، بلا أي اعتماديات، وبأربع أدوات:

| الأداة | ما تفعله |
| ---- | ------------ |
| `kawn_context` | حزمة سياق محدودة الميزانية لمهمّة. |
| `kawn_query` | بحث مرتّب ومحصور بالنمط فوق الرسم البياني. |
| `kawn_affected` | الأثر العكسي: ما الذي يعتمد على رمزٍ ما. |
| `kawn_changes` | أثر مجموعة التغييرات الحالية (غير المُودَعة، أو فرع مقابل مرجع أساس). git محلي فقط. |

الخادم **يقرأ فقط** الرسم البياني — لا يمسح ولا يعيد البناء ولا يكتب (وينبّه حين يبدو
الرسم قديمًا ويشير إلى `kawn update`).

---

## كيف يعمل

المشروع ليس كودًا فقط. إنه كودٌ **و**وثائق **و**SQL **و**اختبارات **و**الإعدادات
التي تربطها. يُمثّل KawnGraph كلًّا منها بوصفه **طبقة** مستقلّة، فيطلب الاستعلام ما
يحتاجه بالضبط ولا شيء سواه — استعلام أثر الكود لا يجرّ وثائق التسويق؛ واستعلام
الوثائق لا يعيد رسوم النداء الخام إلا إذا طلبتها.

<div align="center">
<img src="docs/assets/architecture.svg" alt="يقرأ KawnGraph مستودعك بماسحات حتمية إلى رسمٍ بياني طبقي واحد في ‎.kawn/graph.json‎ (طبقات code وdata وconfig وdocs وtest)، يُقدَّم للقراءة فقط إلى واجهة kawn وخادم MCP والاستوديو. بلا شبكة، بلا LLM، بلا تتبّع." width="860">
</div>

| الطبقة | أمثلة |
| -------- | --------------------------------------------------- |
| `code`   | ملفات، دوال، أصناف، استيرادات، نداءات، مسارات |
| `data`   | جداول SQL، هجرات، مفاتيح أجنبية |
| `config` | حِزَم مساحة العمل، الاعتماديات |
| `docs`   | أقسام markdown، روابط، إشارات |
| `test`   | الاختبارات وما تغطّيه |

كل حافة تحمل **دليلًا** (مسار المصدر، مدى الأسطر، مقتطف) ودرجة ثقة؛ ولكل عقدة
**مُعرّف ثابت قابل للعنونة بالمحتوى** كي يبقى الرسم قابلًا للمقارنة بين عمليات
المسح. النموذج الأعمق في **[docs/GRAPH_MODEL.md](docs/GRAPH_MODEL.md)**.

### حزمة سياق، من البداية إلى النهاية

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

تتوفّر الحزمة نفسها بصيغة Markdown أو JSON أو **بروتوكول السياق الموحّد** المحايد
للوكلاء (`--format ucp` / `ucp-md`). المزيد في **[docs/CONTEXT_PACKS.md](docs/CONTEXT_PACKS.md)**.

---

## الاستوديو

يفتح `kawn map` **استوديو KawnGraph** — مستكشفًا محليًا **للقراءة فقط** يُقدَّم عبر
`127.0.0.1` يقرأ ملف `.kawn/graph.json` الموجود ولا يمسح ولا يعيد البناء ولا يكتب.
يوفّر رسمًا بيانيًا تفاعليًا ثنائي الأبعاد، وخريطة نجوم «كونية» ثلاثية الأبعاد قابلة
للتوسّع (محدودة الميزانية كي لا ترسم رسمًا كبيرًا كاملًا دفعةً واحدة)، وبانيَ حِزَم
سياق، والأثر العكسي، وعروض تغييرات Git، وعرضًا لقياس الأداء السلوكي. مبنيّ
بالإنجليزية والعربية (مع دعم الكتابة من اليمين لليسار). شغّله من المصدر بـ
`pnpm studio:build && pnpm kawn map`.

> ستُضاف لقطة شاشة ملتقَطة للاستوديو إلى `docs/assets/` بعد جولة الالتقاط البصري
> القادمة؛ وحتى ذلك الحين فإن الرسوم أعلاه هي العناصر البصرية المعتمدة.

---

## KawnGraph مقابل البحث العادي في المستودع

مقارنة محايدة لـ*المقاربات* (ليست هجومًا على منافس). كل خانة قابلة للدفاع عنها؛
و«يختلف» تعني أنها تعتمد على الأداة المحدّدة.

| القدرة | بحث عادي | RAG عام | عارض رسم عام | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| مسح محلي حتمي | ✅ | يختلف | ✅ | ✅ |
| علاقات على مستوى الرموز | ❌ | يختلف | ✅ | ✅ |
| طبقات docs / data / test | ❌ | يختلف | يختلف | ✅ |
| دليل على كل حافة | ❌ | ❌ | يختلف | ✅ |
| تحليل أثر محدود | ❌ | ❌ | يختلف | ✅ |
| سياق تغييرات Git | يختلف | ❌ | ❌ | ✅ |
| حِزَم سياق محدودة الميزانية | ❌ | يختلف | ❌ | ✅ |
| استرجاع MCP للقراءة فقط | ❌ | يختلف | يختلف | ✅ |
| لا يتطلّب LLM داخليًا | ✅ | ❌ | ✅ | ✅ |

مقارنة مؤرّخة وموثّقة المصادر بثلاثة أعمدة مع أداة رسم ناضجة (القدرات التي يتقدّم
فيها KawnGraph **و**التي لا يتقدّم فيها) موجودة في **[docs/COMPARISON.md](docs/COMPARISON.md)**.

---

## القياسات

يأتي KawnGraph مع **مِعمار A/B محلي** يشغّل *الوكيل نفسه* على *المهمّة نفسها*
**مع KawnGraph وبدونه** ويسجّل السلوك. النتائج صادقة و**تعتمد على المهمّة** —
بما في ذلك الحالات المحايدة والسلبية.

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

> KawnGraph is task-dependent. It can reduce repository exploration on unfamiliar multi-file work, while adding overhead on already-focused tasks. See the full methodology and limitations in [docs/BENCHMARKS.md](docs/BENCHMARKS.md).

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

Outcome labels (`Improved` / `Neutral` / `Regressed` / `Insufficient data`) are derived deterministically from tool-call and wall-time deltas; every cell is n=3/arm, so all are directional. Full per-metric tables: [benchmarks/published/campaign-2026-06-20.md](benchmarks/published/campaign-2026-06-20.md).

<!-- BENCH:END -->

المنهجية والبيئة وأحجام العيّنات والجداول التفصيلية والقيود في
**[docs/BENCHMARKS.md](docs/BENCHMARKS.md)** — مُولَّدة من الأثر المُتحقَّق منه
والمُودَع في [`benchmarks/published/`](benchmarks/published/).

---

## الماسحات والطبقات المدعومة

كل لغة/صيغة هي **إضافة ماسح** مُؤرَّخة الإصدار خلف سجلٍّ واحد (اكتشاف ← مسح ←
إنهاء): ترتيب حتمي، وعزل أعطال لكل ملف، وتسجيل صريح، وأحجام ملفات محدودة.

| اللغة / الصيغة | المُستخرَج |
| ----------------- | --------- |
| TypeScript / JS   | ملفات، دوال/أصناف عُليا، استيرادات، نداءات، مسارات Next.js، اختبارات |
| Python            | `def`/`async def`/`class` العُليا، المُزيِّنات، التوابع (كبيانات وصفية)، الاستيرادات، مسارات FastAPI/Flask، docstrings، اختبارات (عبر `@lezer/python` — JS صرف، متسامح مع الأخطاء) |
| SQL               | جداول (`CREATE`/`ALTER`)، علاقات المفاتيح الأجنبية |
| package.json      | حِزَم مساحة العمل والاعتماديات الداخلية |
| Markdown          | عناوين/أقسام مرتبطة بالكود وSQL والمسارات |

إغفالان متعمّدان في ماسحَي الكود: التوابع/الدوال المتداخلة ليست عقدًا مستقلّة أبدًا
(التابع يركب على صنفه كبيانات وصفية)، وملفات التصريح المُجرّدة (`.d.ts`، `.pyi`) لا
تُدّعى أبدًا. التفاصيل في **[docs/SCANNERS.md](docs/SCANNERS.md)**.

---

## الخصوصية والأمان

- **بلا شبكة افتراضيًا.** المسح والاسترجاع يقرآن مستودعك ويكتبان JSON تحت `.kawn/`.
  لا شيء يغادر الجهاز.
- **بلا LLM داخلي.** الكود والوثائق وSQL تُحلَّل بنيويًا؛ والإثراء بالذكاء الاصطناعي
  اختياري ومحلي أولًا.
- **بلا تتبّع. بلا تسجيل للاستعلامات افتراضيًا.**
- **MCP للقراءة فقط.** الخادم يقدّم الرسم؛ ولا يمسح ولا يعيد البناء ولا يكتب —
  ويرفض تقديم رسمٍ لا يثق بمخطّطه.
- **تكاملات قابلة للتراجع ومحصورة بالمشروع.** كتابات ذرّية، ونسخ احتياطية مؤرّخة،
  وتعديلات إعدادات بنيوية (لا استبدال نصوص)؛ لا يعدّل `CLAUDE.md` / `AGENTS.md`،
  ولا يمسّ الإعداد العام افتراضيًا.

النموذج الكامل في **[docs/PRIVACY.md](docs/PRIVACY.md)**. أبلِغ عن ثغرة بسرّية عبر
**[SECURITY.md](SECURITY.md)**.

---

## الحالة والقيود

KawnGraph قيد **التطوير النشط** (`v0.1.0`، لم يُنشَر بعد على npm). مبنيّ ومُختبَر
من طرفٍ إلى طرف: رسم code/data/config/docs/test، وروابط الوثائق-إلى-الكود،
والاستعلام المحصور بالنمط، وتحليل الأثر، وأثر Git/PR، وحِزَم السياق محدودة
الميزانية، وبروتوكول السياق الموحّد، وخادم MCP للقراءة فقط، وإعداد الوكلاء بأمرٍ
واحد (Claude Code / Codex / Cursor)، والاستوديو، ومِعمار قياس A/B.

**قيود صادقة.** القياس المنشور **استكشافي (n<5 لكل ذراع — توجيهي، غير دالّ
إحصائيًا)**. يساعد KawnGraph أكثر في الاكتشاف متعدّد الملفات غير المألوف، وقد يضيف
عبئًا على المهام المركّزة على ملفٍ واحد. لم يُبنَ بعد: الخطّافات الاختيارية
المقترِحة فقط، وطبقة المرئيات، والإثراء الدلالي/الذكي، وطبقة وقت التشغيل — وكلّها
اختيارية بالتصميم. راجع [PROJECT_PLAN.md](PROJECT_PLAN.md) ·
[ARCHITECTURE.md](ARCHITECTURE.md) · [docs/FAQ.md](docs/FAQ.md) ·
[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

## التوثيق

| الدليل | المحتوى |
| ----- | ------------- |
| [البدء](docs/GETTING_STARTED.md) | التثبيت والمسح وأول حزمة سياق |
| [تكامل الوكلاء](docs/AGENT_INTEGRATION.md) | عقد إعداد MCP وقابلية التراجع |
| [حِزَم السياق](docs/CONTEXT_PACKS.md) | الترتيب والميزانيات وصيغة UCP |
| [نموذج الرسم](docs/GRAPH_MODEL.md) | العقد والحواف والطبقات والأدلة والمُعرّفات |
| [الماسحات](docs/SCANNERS.md) | ما تستخرجه كل إضافة لغة |
| [القياسات](docs/BENCHMARKS.md) | المنهجية والبيئة والنتائج الكاملة |
| [المقارنة](docs/COMPARISON.md) | مقارنة قدرات مؤرّخة وموثّقة |
| [الخصوصية](docs/PRIVACY.md) | حدود البيانات لكل طبقة |
| [حلّ المشكلات](docs/TROUBLESHOOTING.md) · [الأسئلة الشائعة](docs/FAQ.md) | المشكلات والأسئلة الشائعة |

---

## المساهمة

المساهمات مُرحَّب بها. ابنِ من المصدر، شغّل المجموعة الاختبارية، واقرأ الدليل:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

راجع **[CONTRIBUTING.md](CONTRIBUTING.md)** للإعداد والاصطلاحات ومراجعة الخصوصية
التي يمرّ بها كل طلب دمج؛ و**[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** لتوقّعات
المجتمع؛ و**[docs/i18n/TRANSLATING.md](docs/i18n/TRANSLATING.md)** لإضافة لغة أو
مراجعتها؛ و**[SUPPORT.md](SUPPORT.md)** لمكان طرح الأسئلة.

---

## الرخصة والشكر

**[MIT](LICENSE)** © مساهمو KawnGraph.

**كَوْن** (بالعربية: *الكون، الوجود*) يعامل المستودع بوصفه كونًا حيًّا من المعرفة؛
و**Graph** هو رسم سياق الوكيل المدعوم بالأدلة في جوهره. مبنيّ بـ
[TypeScript](https://www.typescriptlang.org/) و[Vite](https://vitejs.dev/) و
[React](https://react.dev/) و[React Flow](https://reactflow.dev/) و
[Three.js](https://threejs.org/) و[`@lezer/python`](https://lezer.codemirror.net/).

</div>
