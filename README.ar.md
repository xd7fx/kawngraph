# KawnGraph — كون قراف

[English](README.md) · **العربية**

**كون السياق للوكلاء (The Agent Context Universe).** كونٌ واحد لكل مشروع. ولكل وكيل برمجة.

> اعطِ الوكيل الخريطة، لا المستودع كله.
> Give agents the map, not the repo.

يربط KawnGraph شيفرتك ووثائقك ومرئياتك وقراراتك وإعداداتك في رسمٍ بيانيّ واحدٍ
متعدّد الطبقات، ثم يحوّل ذلك الرسم إلى **حِزَم سياق (context packs)** صغيرة
وموفّرة للـ tokens، لوكلاء البرمجة بالذكاء الاصطناعي مثل Claude Code وCodex
وCursor.

يجمع الاسم فكرتين. **كَوْن** (بالعربية **كَوْن** — *الكون، الوجود*) يعامل
المستودع كأنّه كونٌ حيٌّ من المعرفة؛ و**Graph** (الرسم البياني) هو رسم سياق
الوكيل المُسنَد بالأدلّة في صميمه. المشروع كون: الملفات والوثائق والجداول
**أجرام**، والاعتماديات هي **الجاذبية** التي تشدّها، وكل علاقة **مدار** خلفه
دليل.

---

## ابدأ بأمرٍ واحد

```bash
npx kawngraph setup
```

يفحص هذا الأمر مشروعك، ويربط وكلاء البرمجة الذين تستخدمهم أصلاً (Claude Code
وCodex وCursor) عبر تكاملٍ **للقراءة فقط**، ثم يتحقّق من أن الاسترجاع يعمل. بعدها
افتح وكيلك وصِف مهمّتك فحسب — وسيسحب الملفات القليلة المهمّة من تلقاء نفسه. بلا
مفاتيح API، بلا تتبّع (telemetry)، بلا أي اتصالٍ بالشبكة.

> نزّل KawnGraph، ثم اكتب `kawn`. — *Install KawnGraph, then type `kawn`.*

كل أمرٍ للمبتدئين له اسمٌ لطيفٌ مرادف: `kawn ask` (ملفات مهمّةٍ لمهمّة)، و`kawn
impact` (ما الذي ينكسر إن غيّرت رمزاً)، و`kawn changes` (ما الذي يمسّه تغييرك)،
و`kawn map` (المستكشف المرئي)، و`kawn check` (الصحّة)، و`kawn bench` (قِس الفرق).
أمّا الأسماء التقنية — `context` و`affected` و`diff`/`pr-impact` و`studio`
و`doctor`/`status` و`benchmark` — فتبقى مدعومةً بالكامل؛ شغّل `kawn help` للاطلاع
على الواجهة الكاملة.

---

## لماذا يحتاج وكيل ذكاءٍ اصطناعيّ إلى خريطة؟

حين تُسنِد مهمّةً إلى وكيل برمجة، يبدأ عادةً بـ*القراءة*. كثيراً. يفتح عشرات
الملفات، ويمسح الوثائق، ويعيد استنتاج كيف ترتبط المسارات بقاعدة البيانات، ويبني
النموذج الذهني نفسه من جديد مع كل طلبٍ على حدة. هذا بطيء، ومكلِّف بالـ tokens،
وغالباً غير دقيق — فقد يفوت الوكيلَ الملفُّ الوحيد الذي يهمّ فعلاً، ويغرق في خمسةٍ
لا تهمّ.

يقلب KawnGraph المعادلة. يفحص المستودع **مرّةً واحدة**، ويبني رسماً بيانياً
لكيفية ترابط الأشياء، ثم يجيب عن أسئلة مثل:

- *ما الذي يربط مسار أحداث المتجر بمنطق الترتيب؟*
- *إن غيّرت `getMerchantContext()`، فما الذي ينكسر؟*
- *أيّ الملفات والوثائق أحتاجها فعلاً لإصلاح ردّ نداء OAuth؟*

بدلاً من قراءة 100 ملف، يقرأ الوكيل **الخمسة المهمّة** — إضافةً إلى الوثيقتين
ذواتَي الصلة، وجداول قاعدة البيانات المرتبطة، والاختبارات التي ينبغي تشغيلها.

```
Task: Fix Zid OAuth callback

KawnGraph returns:
- apps/web/app/api/zid/oauth/callback/route.ts   (entry route)
- packages/zid/src/oauth.ts                       (token exchange)
- packages/db/.../storeTokens.ts                  (writes store_tokens)
- docs/zid-oauth-core.md#callback-flow            (expected behaviour)
- tests: oauth.test.ts
- risks: token encryption, tenant isolation
```

تلك الحزمة هي **حزمة سياق (context pack)**. وهي المنتج الحقيقي. الرسم البياني هو
الأساس؛ وحزمة السياق هي ما يستهلكه الوكيل.

---

## طبقات، لا خليط

المشروع ليس شيفرةً فقط. إنه شيفرة **و**وثائق **و**لقطات شاشة **و**SQL **و**القرارات
التي تقف خلفها كلّها. يُنمذِج KawnGraph كلّاً من هذه بوصفه **طبقة** منفصلة، فيستطيع
الاستعلام أن يطلب ما يحتاجه بالضبط، ولا شيء لا يحتاجه.

| الطبقة     | أمثلة                                                  |
| ---------- | ----------------------------------------------------- |
| `code`     | ملفات، دوال، أصناف، استيرادات، نداءات، مسارات          |
| `data`     | جداول SQL، ترحيلات (migrations)، مفاتيح أجنبية         |
| `config`   | حِزَم، اعتماديات، مفاتيح بيئة (env)                    |
| `docs`     | أقسام Markdown، روابط، إشارات                          |
| `visual`   | لقطات شاشة، مخطّطات، بيانات وصفية للصور *(مخطّط له)*   |
| `decision` | قرارات معمارية وما أدخلَته                             |
| `test`     | اختبارات وما تغطّيه                                    |
| `runtime`  | سجلّات، تتبّعات *(مستقبلاً)*                           |

كل شيء مدعوم. ولا شيء يُخلَط على عماية. استعلام أثرٍ على الشيفرة لا يجرّ معه لقطات
شاشةٍ تسويقية أبداً؛ واستعلام وثائق لا يُرجِع رسوم نداءات خام ما لم تطلبها.

```bash
kawn query "what calls getMerchantContext" --mode code   # code only
kawn query "where is OAuth documented?"     --mode docs   # docs only
kawn context "fix OAuth callback" --budget 8000           # smart mix, budgeted
```

---

## المبادئ

KawnGraph مبنيٌّ ليكون أساساً جديراً بثقة الوكلاء. وهذا يعني:

- **لا نموذج لغويّ افتراضياً.** تُحلَّل الشيفرة والوثائق وSQL بنيوياً. والإثراء
  بالذكاء الاصطناعي اختياريّ ويُشغَّل محلّياً أولاً.
- **لا خطّافات (hooks) افتراضياً.** لا يُقحِم KawnGraph نفسه في سير عملك دون
  دعوة. الخطّافات تأتي لاحقاً، واختيارية بحتة، وتقترح فقط.
- **لا تتبّع. ولا اتصالات شبكة افتراضياً.** يقرأ KawnGraph مستودعك ويكتب JSON.
  هذا كل شيء.
- **لكل حافّة دليل.** تسجّل كل علاقة *من أين* أتت — ملف، ومدى أسطر، ومقتطف —
  ومستوى ثقة (`extracted`، `linked`، `semantic`، `manual`). ولا يُؤكَّد شيء بلا
  مصدر.
- **معرّفات ثابتة.** تُعنوَن العُقَد بما هي عليه، لا بموضعها على سطر، فيبقى الرسم
  البياني قابلاً للمقارنة (diff) عبر عمليات الفحص.

---

## بمَ يختلف هذا عن عارض رسومٍ بيانيّة عام؟

الأدوات التي تصوّر "الملف A يستورد الملف B" مفيدة لكنها تقف عند الطبقة
الميكانيكية. يضيف KawnGraph **المعنى**: وثيقة *تشرح* مساراً، ولقطة شاشة *تصوّر*
صفحة، وقرار *أدخل* ميزة، وترحيل *يعرّف* جدولاً. والهدف ليس صورةً جميلة — بل
**الاسترجاع**: إنتاج السياق الأدنى والصحيح الذي يحتاجه الوكيل لمهمّةٍ بعينها، ضمن
ميزانية tokens. والتصوير (KawnGraph Universe) موجودٌ لـ*يشرح* ذلك الاسترجاع، لا
ليحلّ محلّه.

لا نحاول أن نتفوّق في الرسم على مستكشفات الرسوم متعدّدة الوسائط. نحاول أن نجعل
الوكلاء أرخص وأذكى على قواعد شيفرةٍ حقيقية.

---

## الحالة

KawnGraph قيد التطوير النشط. الرسم البياني، وحِزَم السياق، وخادم MCP — مُنفَّذة
ومُختبَرة من الطرف إلى الطرف:

- ✅ **رسم الشيفرة (Code graph)** — ملفات TypeScript/JavaScript **وPython**،
  والاستيرادات، والدوال/الأصناف، والنداءات (Python عبر قواعد `@lezer/python`
  الناضجة — محلّل بنيويّ حقيقي، لا regex أبداً). وتحمل Python عمقاً بنيوياً: أسماء
  المُزخرِفات (decorators)، ومنهجيات الصنف الخاصة به (مع السطر/async/المزخرفات)
  بوصفها بياناتٍ وصفيةً غنيةً بالأدلّة، وdocstring الوحدة — كل ذلك دون اختلاق عُقَد
- ✅ **طبقة الاختبارات (Test layer)** — الملفات التي تتبع أعراف الاختبار
  (`*.test.*`/`*.spec.*`، و`test_*.py`/`*_test.py`/`conftest.py`، أو أي شيء داخل
  مجلّد `tests`/`__tests__`) ورموزها العليا تُوضَع في طبقة/نوع `test` المخصّص،
  فتفرزها حزمة السياق ويستطيع `--mode tests` أن يقصُر عليها — ومع ذلك يبقى
  الاختبار مشاركاً في رسم النداءات (تظلّ استيراداته ونداءاته قابلةً للحل)
- ✅ **كشف المسارات (Route detection)** — معالِجات Next.js App Router، إضافةً إلى
  مُزخرِفات FastAPI/APIRouter وFlask (`@app.get`، `@router.post`،
  `@app.route(methods=[…])`)
- ✅ **رسم البيانات (Data graph)** — جداول SQL والمفاتيح الأجنبية (لا تُتجاهَل
  أبداً)
- ✅ **رسم الإعدادات (Config graph)** — حِزَم مساحة العمل والاعتماديات الداخلية
- ✅ **ماسحات قابلة للتوسعة (Extensible scanners)** — كل لغة/صيغة هي **إضافة ماسح
  (scanner plugin)** مُؤرّخة الإصدار خلف سجلٍّ واحد (detect ← scan ← finalize):
  ترتيب حتميّ، و**عزل الأعطال** لكل ملف (الإضافة التي ترمي استثناءً *أو* تُنتج
  خرجاً مشوَّهاً تُختزَل إلى تشخيص، ولا توقف الفحص أبداً)، وتسجيل صريح (بلا تحميل
  تلقائي)، و**قدرات** مُعلَنة يُتحقَّق منها مقابل الخرج الفعلي، وأحجام ملفات محدودة
- ✅ **طبقة الوثائق (Docs layer)** — عناوين/أقسام Markdown مربوطة بالشيفرة وSQL
  والمسارات بأدلّة (`documents`، `explains`، `mentions`)، دون نموذج لغوي
- ✅ **حِزَم السياق (Context packs)** — `kawn context "<task>" --budget N`: شيفرة
  واجبة القراءة، ووثائق ذات صلة، وجداول، واختبارات، ومخاطر، وقائمة استبعاد صريحة،
  كلّها ضمن ميزانية tokens، وبشكل حتميّ، دون نموذج لغوي
- ✅ **بروتوكول السياق العالمي (Universal Context Protocol — UCP)** — `kawn
  context … --format ucp` (أو `ucp-md`): صيغة نقلٍ محايدة تجاه الوكيل ومُؤرّخة
  الإصدار، يستهلكها أيّ وكيل برمجة دون معرفة دواخل KawnGraph. أقسامٌ موسومة
  بالأدوار؛ وكل عنصر يشرح **سببه / طبقته / دليله / رتبته**؛ والمنتِج يُعلن قدراته.
  JSON قانونيّ (قابل للبصم، بلا فقدان) أو Markdown جاهز للإدراج. يستطيع المستهلك
  أن **يتفاوض (`negotiate`)** على القدرات/الإصدار مسبقاً (بدل التخمين)، ثم يشغّل
  **مدقّقاً (validator)** بنيوياً مُحصَّناً يفحص كل ضمان — توافق البروتوكول،
  والتعدادات ضمن المدى (mode، role، نوع العقدة، الطبقة، المخاطر)، والأرقام السليمة
  (الميزانيات/الـ tokens ≥ 0، والرتب التي تبدأ من 1)، ودليل غير فارغ لكل عنصر
- ✅ **استعلام مقصور على النمط (Mode-scoped query)** — `kawn query "<q>" --mode
  code|docs|all`
- ✅ **تحليل الأثر (Impact analysis)** — `kawn affected <symbol>` (بلوغٌ عكسيّ
  عبر النداءات / الاستيرادات / المراجع / **`depends_on` للحِزَم**، فتغييرُ حزمةٍ
  في مساحة العمل يُعلِّم الحِزَم التي تعتمد عليها)
- ✅ **أثر Git وطلبات الدمج (Git & PR impact)** — `kawn diff` و`kawn pr-impact`
  و`kawn pr-context` تُسقِط الملفات التي غيّرتها (غير المُودَعة، أو فرعاً مقابل
  `--base`) على الرسم البياني، ثم تُظهِر نطاق الانفجار، والملفات الواجب إعادة
  فحصها، وحزمةً مُقيَّدة بميزانية للعمل عليها. **إعادة التسمية تُكتشَف حتمياً**
  (بمعزل عن إعداد `diff.renames` لديك) وتُحَلّ إلى عُقَد الملف القديم؛ وعمليات
  الحذف تظلّ تُظهِر مُعتمِديها. **Git محلّي فقط — بلا شبكة، بلا واجهة GitHub**
- ✅ **خادم MCP** — JSON-RPC عبر stdio للقراءة فقط، بلا أي اعتماديات؛ الأدوات
  `kawn_context`، `kawn_query`، `kawn_affected`، `kawn_changes`
- ✅ **KawnGraph Universe** — مستكشف رسمٍ بيانيّ محلّي **للقراءة فقط** (`kawn
  studio`): رسمٌ ثنائيُّ الأبعاد تفاعليّ، وخريطة نجومٍ ثلاثيةُ الأبعاد "كونية"
  قابلة للتوسّع (مُقيَّدة بميزانية فلا ترسم رسماً ضخماً كاملاً دفعةً واحدة)، وبنّاء
  حِزَم السياق، وتتبّع الأثر والتدفّق، وعروض الوثائق/البيانات. يُبقي العرض ثلاثيّ
  الأبعاد كلَّ عقدة في **نداء رسمٍ واحد (one draw call)**، ومع ذلك يُظهِر نوع كل
  عقدة بلمحة عبر **نموذج سماويّ** — الحزمة = نظام شمسيّ، والملف = كوكب، والرمز =
  قمر، والجدول = كوكب بحلقات، والاختبار = قمر صناعيّ بدرع — بحجمٍ لكل نقطة داخل
  الـ shader. يُعيد استعمال المحرّكات ذاتها ولا يقرأ سوى `.kawn/graph.json` — لا
  يفحص ولا يكتب أبداً (انظر [apps/studio/README.md](apps/studio/README.md))
- ✅ **إعداد الوكلاء بأمرٍ واحد** — `kawn setup` يكتشف Claude Code / Codex /
  Cursor ويُثبّت تكاملات MCP قابلة للعكس ومقصورة على المشروع، ثم يتحقّق من
  الاسترجاع بمصافحة MCP حيّة. قابل للعكس (`kawn disconnect`)، ذرّيّ مع نسخٍ
  احتياطية، ولا يعدّل `CLAUDE.md`/`AGENTS.md` أبداً (انظر
  [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md))
- ✅ **تكامل Claude Code** — أوامر شَرطة (slash commands)، ومهارة (skill)، ووكيل
  فرعيّ (subagent) تستدعي واجهات KawnGraph الحقيقية (انظر أدناه)
- ✅ الخرج: `.kawn/graph.json` + تقرير `.kawn/report.md` مقروء للبشر
- ✅ مُختبَر بمُشغّل اختبارات Node المدمج (`pnpm test`) — المعرّفات الثابتة،
  والخرج الحتميّ، وفرض ميزانية الـ tokens، وربط الوثائق بالشيفرة، ونقل MCP —
  كلّها مُغطّاة

لم يُبنَ بعد فعلاً: الخطّافات الاختيارية، والطبقة المرئية، والإثراء الدلالي/بالذكاء
الاصطناعي، وطبقة وقت التشغيل (runtime). انظر [PROJECT_PLAN.md](PROJECT_PLAN.md)
و[ARCHITECTURE.md](ARCHITECTURE.md).

---

## دعم اللغات

كل لغة هي **إضافة ماسح (scanner plugin)** مُؤرّخة الإصدار (انظر *ماسحات قابلة
للتوسعة* أعلاه). إليك ما يستخرجه كل ماسح مدمج اليوم:

| اللغة             | ما يُستخرَج                                                                                                  | ما لا يُستخرَج (بعد)                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| TypeScript / JS   | ملفات، دوال/أصناف عليا، استيرادات (نسبية + حِزَم مساحة العمل)، نداءات، مسارات Next.js، اختبارات              | تصريحات `.d.ts` المحيطة؛ رسم الأنواع فقط؛ المنهجيات كعُقَد       |
| Python            | ملفات، `def`/`async def`/`class` عليا، مُزخرِفات، منهجيات الصنف الخاصة (بيانات وصفية)، استيرادات (مطلقة/نسبية/`__init__`)، نداءات، مسارات FastAPI/Flask، docstrings الوحدات، اختبارات | كعوب `.pyi` (محيطة، مثل `.d.ts`)؛ المنهجيات/التعريفات المتداخلة كعُقَد؛ استيرادات ديناميكية/`importlib`؛ توسيع استيراد النجمة |
| SQL               | جداول، أعمدة، مفاتيح أجنبية                                                                                  | الإجراءات المخزّنة؛ العروض (views)                              |
| package.json      | حِزَم مساحة العمل والاعتماديات الداخلية                                                                       | —                                                               |
| Markdown          | عناوين/أقسام مربوطة بالشيفرة وSQL والمسارات                                                                   | —                                                               |

ثمّة إغفالان مقصودان يتشاركهما ماسحا الشيفرة معاً: **المنهجيات والدوال المتداخلة
ليست عُقَداً منفصلة أبداً** (الرموز العليا وحدها كذلك — فالمنهجية تركب على صنفها
بوصفها بياناتٍ وصفية)، و**ملفات التصريحات المحيطة** (`.d.ts`، `.pyi`) لا
يُطالَب بها أبداً لأنها أنواع، لا مصدر.

**لماذا `@lezer/python` لا tree-sitter؟** كلاهما محلّل بنيويّ حقيقي (لا regex).
لكن `@lezer/python` هو **JavaScript خالص**، و**متسامح مع الأخطاء** (الملف
المشوَّه يُنتِج شجرةً جزئية، لا استثناءً أبداً)، و**متزامن (synchronous)** —
فيندرج في عقد `scan()` الحتميّ المتزامن للماسح دون أي ارتباطات أصلية (native) أو
WASM أو تهيئة لا-متزامنة. أمّا tree-sitter فيضيف خطوات بناءٍ أصلية/WASM وتهيئةً
لا-متزامنة لا يسمح بها عقد الماسح لكل ملف، مقابل دقّةٍ لا نحتاجها هنا. فالخيار
يشتري إمكان إعادة الإنتاج عبر المنصّات (خصوصاً على Windows) دون أي كلفةٍ في
الصحّة.

---

## البناء من المصدر

أتساهم أو تشغّل هذا المستودع الأحاديّ (monorepo) مباشرةً؟ استخدم سكربتات مساحة
العمل (الحزمة المنشورة هي ما يشغّله `npx kawngraph` أعلاه):

```bash
# install workspace deps and build
pnpm install
pnpm build

# scan a project (creates .kawn/graph.json and .kawn/report.md)
pnpm kawn scan ./path/to/your/project

# or try the bundled example
pnpm scan:example

# build a token-budgeted context pack for a task
pnpm kawn context "fix the OAuth callback that writes store tokens" --budget 8000

# emit the same pack in the agent-neutral Universal Context Protocol
# (--format ucp = canonical JSON · ucp-md = drop-in Markdown for a prompt)
pnpm kawn context "fix the OAuth callback" --format ucp-md --budget 8000

# ask a mode-scoped question (code only / docs only / everything)
pnpm kawn query "store tokens" --mode code
pnpm kawn query "where is OAuth documented?" --mode docs

# see what depends on a symbol before you change it
pnpm kawn affected getMerchantContext

# run the test suite (Node's built-in runner, no extra deps)
pnpm test

# connect this project to your coding agents in one command
# (scans if needed, installs reversible MCP integrations, verifies retrieval)
pnpm kawn setup --agent all --yes

# explore the graph in the local, read-only Studio
# (build the UI once — dist/ is gitignored — then serve it)
pnpm studio:build
pnpm studio examples/nextjs-supabase --port 4199
```

لا يلمس الفحص الشبكة أبداً، ولا يستدعي نموذجاً لغوياً، ولا يكتب شيئاً خارج
`.kawn/`. تُتجاهَل `node_modules` و`dist` وأمثالها؛ أمّا SQL فلا يُتجاهَل أبداً.

---

## اربطه بوكيل البرمجة لديك

جوهر KawnGraph أن يمدّ الوكيل يده إلى الخريطة **تلقائياً**. أمرٌ واحد يصل المشروع
بالوكلاء الذين تستخدمهم — دون تعديل `CLAUDE.md` أو `AGENTS.md`، وكل تغييرٍ قابلٌ
للعكس:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn doctor                 # read-only health check (exits non-zero on FAIL)
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

يكتشف `setup` كلّاً من Claude Code وCodex وCursor، ويُثبّت **تكامل MCP للقراءة
فقط** مقصوراً على المشروع — `.mcp.json` أو `.cursor/mcp.json` أو
`.codex/config.toml` — مع نسخٍ احتياطيّ لكل ما يمسّه، والتحقّق من الخادم بمصافحةٍ
حيّة. أمّا الملفات بالضبط، وصِيَغ الإعداد المُتحقَّق منها (مع المصادر والتواريخ)،
والسلوك التلقائي أثناء الجلسة، وضمانات قابلية العكس، فموثّقة في
**[docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md)**.

**خادم MCP** — خادم stdio للقراءة فقط فوق `.kawn/graph.json` الموجود، يسجّله
`setup`. يكشف أربع أدوات:

| الأداة | وظيفتها |
| ---- | ------------ |
| `kawn_context` | حزمة سياق مُقيَّدة بميزانية tokens لمهمّة. |
| `kawn_query` | بحثٌ مُرتَّب ومقصور على النمط فوق الرسم البياني. |
| `kawn_affected` | الأثر العكسي: ما الذي يعتمد على رمز. |
| `kawn_changes` | أثر مجموعة التغييرات الحالية (غير مُودَعة، أو فرعٌ مقابل مرجعٍ أساس). Git محلّي فقط — بلا شبكة، بلا واجهة GitHub. |

الخادم **يقرأ فقط** الرسم البياني — لا يفحص ولا يعيد بناءه أبداً (وسيحذّر حين يبدو
الرسم قديماً ويرشدك إلى `kawn update`). ابنِ الرسم أولاً بـ `kawn scan`. انظر
[packages/mcp/README.md](packages/mcp/README.md).

**أوامر الشَّرطة والمهارة والوكيل الفرعي** (تحت `.claude/`، مُشارَكة في هذا
المستودع):

- `/kawn-scan`، `/kawn-context`، `/kawn-query` — أغلفة رقيقة فوق واجهة الأوامر
- مهارة `kawn-context` — إرشادٌ لسحب حزمةٍ قبل التحرير
- وكيل `kawn-explorer` الفرعي — يستكشف المستودع عبر KawnGraph، لا بالقراءة الخام

إعدادات Claude الشخصية (`launch.json`، `settings.local.json`) تبقى محلّية
ومُستثناة من git.

---

## بنية المستودع

```
kawn/
  packages/
    shared/           # types, logger, path + id helpers, errors
    scanner-sdk/      # the scanner plugin contract + registry (detect → scan → finalize)
    scanners/         # built-in scanner plugins: code (TS/JS), Python, SQL, package.json, markdown
    context-protocol/ # the Universal Context Protocol: agent-neutral pack schema, validate, json, markdown
    core/             # repo walker, graph builder/store, report, impact, context packs, flow, freshness
    cli/              # the `kawn` command
    mcp/              # read-only MCP server over .kawn/graph.json
    agents/           # agent-session integration: adapters + safe config IO (setup/connect/disconnect/doctor)
    studio-server/    # local, read-only HTTP API over .kawn/graph.json
    benchmark/        # local-only A/B harness (agents WITH vs WITHOUT KawnGraph)
  apps/
    studio/        # KawnGraph Universe — Vite + React graph explorer (read-only)
  examples/
    nextjs-supabase/   # sample project to scan
  scripts/      # pack-check.mjs — packaging audit (pnpm pack:check)
  tests/        # node:test suite (graph, context, docs links, MCP, agents, freshness)
  .claude/      # shared slash commands, skill, subagent
  .mcp.json     # registers the KawnGraph MCP server
  docs/
    AGENT_INTEGRATION.md   # the one-command agent setup contract
```

## الترخيص

MIT — انظر [LICENSE](LICENSE).
