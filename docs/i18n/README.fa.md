<!-- KAWN-TRANSLATION
lang: fa
status: machine-assisted
canonical: README.md
canonical-sha: 0bb15f5b2c5f88091d6bab4790ba6fb35c715b08dae4fceb9b54f7e15626992e
-->

<div dir="rtl">

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### جهانِ بافتارِ ایجنت‌ها

**یک جهانِ پروژه. هر ایجنتِ کدنویسی.**

KawnGraph کد، مستندات، داده‌ها، تست‌ها و تغییرات Git را به **Context Pack**‌های
مبتنی‌بر شواهد نگاشت می‌کند تا Claude، Codex و Cursor بتوانند بدون خواندنِ تمام
مخزن (repository) به فایل‌های درست برسند.

[English](../../README.md) · [العربية](../../README.ar.md) · [فارسی] (فعلی) · [translation status](STATUS.md)

</div>

> **توجه:** این ترجمه ماشینی‌یار (machine-assisted) است و ممکن است خطا داشته باشد.
> مرجع رسمی، نسخهٔ انگلیسی [README.md](../../README.md) است. وضعیتِ ترجمه‌ها را در
> [STATUS.md](STATUS.md) ببینید.

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="یک وظیفه («رفعِ ایرادِ callbackِ OAuthِ Zid») وارد KawnGraph می‌شود و یک Context Pack با بودجهٔ توکن بازمی‌گرداند: فایل‌های ضروری برای خواندن، مستندات مرتبط، جدول‌ها، تست‌ها، ریسک‌ها، فهرستی از موارد کنارگذاشته‌شده و یک امتیازِ اطمینان." width="860">
</div>

---

## چرا KawnGraph؟

وقتی به یک ایجنتِ کدنویسی وظیفه‌ای می‌دهید، معمولاً کار را با *خواندن* آغاز
می‌کند — آن هم زیاد. ده‌ها فایل را باز می‌کند، دوباره استنتاج می‌کند که مسیرها
(routes) چگونه به پایگاه‌داده می‌رسند، و در هر درخواست همان مدلِ ذهنی را از نو
می‌سازد. این کار کُند، از نظر توکن پُرهزینه، و اغلب نادرست است: ایجنت همان یک
فایلی را که اهمیت دارد از دست می‌دهد و در پنج فایلی که اهمیتی ندارند غرق می‌شود.

KawnGraph مخزن را **یک بار** اسکن می‌کند، گرافی لایه‌بندی‌شده و مبتنی‌بر شواهد از
نحوهٔ ارتباطِ چیزها می‌سازد، و سپس برای یک وظیفهٔ مشخص با **آن چند فایلی که اهمیت
دارند** پاسخ می‌دهد — به‌علاوهٔ مستنداتِ مرتبط، جدول‌های مرتبطِ پایگاه‌داده،
تست‌هایی که باید اجرا شوند و ریسک‌هایی که باید زیر نظر باشند. این بسته یک
**Context Pack** است. گراف بسترِ کار است؛ Context Pack محصول است.

> **به ایجنت‌ها نقشه را بدهید، نه کل مخزن را.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## شروعِ سریع

> **هشدار:** بستهٔ npm با نام `kawngraph` **هنوز منتشر نشده** است، بنابراین
> `npx kawngraph …` امروز در دسترس *نیست*. از مسیرِ ساخت‌ازمنبعِ زیر استفاده کنید؛
> جریانِ `npx` برای **پس از انتشار** نشان داده شده است.

**امروز — از منبع** (همین monorepo، Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**پس از انتشار در npm** (تجربهٔ موردنظرِ تک‌فرمانی):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

سپس ایجنتِ خود را باز کنید و فقط وظیفه‌تان را توصیف کنید — خودش آن چند فایلی را که
اهمیت دارند بیرون می‌کشد. بدون کلیدِ API، بدون تله‌متری، و بدون هیچ فراخوانیِ
شبکه‌ای در حین اسکن یا بازیابی. تازه‌کارید؟ از
**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)** شروع کنید.

---

## آن را به ایجنتِ کدنویسی‌تان متصل کنید

نکتهٔ اصلیِ KawnGraph این است که ایجنت **به‌طور خودکار** به‌سراغِ نقشه می‌رود. یک
فرمان، یک پروژه را به ایجنت‌هایی که استفاده می‌کنید سیم‌کشی می‌کند — بدون ویرایشِ
`CLAUDE.md` یا `AGENTS.md`، و هر تغییری برگشت‌پذیر است:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` به‌طور خودکار **Claude Code**، **Codex** و **Cursor** را تشخیص می‌دهد و
یک **یکپارچه‌سازیِ MCPِ فقط‌خواندنی (read-only)** را که به پروژه محدود شده است نصب
می‌کند (`.mcp.json`، `.cursor/mcp.json`، یا `.codex/config.toml`)، از هر چیزی که
لمس می‌کند پشتیبان می‌گیرد و سرور را با یک دست‌دادنِ (handshake) زنده تأیید می‌کند.
قراردادِ کامل: **[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**سرورِ MCP** یک stdio JSON-RPCِ فقط‌خواندنی بدون هیچ وابستگی و دارای چهار ابزار است:

| ابزار | چه می‌کند |
| ---- | ------------ |
| `kawn_context` | Context Pack با بودجهٔ توکن برای یک وظیفه. |
| `kawn_query` | جست‌وجوی رتبه‌بندی‌شده و محدود به حالت (mode) روی گراف. |
| `kawn_affected` | اثرِ معکوس: اینکه چه چیزی به یک نماد (symbol) وابسته است. |
| `kawn_changes` | اثرِ مجموعه‌تغییراتِ فعلی (commit‌نشده، یا یک شاخه در برابرِ یک ارجاعِ پایه). فقط Gitِ محلی. |

این سرور فقط گراف را **می‌خواند** — هرگز آن را اسکن، بازسازی یا بازنویسی نمی‌کند
(وقتی گراف کهنه به‌نظر برسد هشدار می‌دهد و به `kawn update` اشاره می‌کند).

---

## چگونه کار می‌کند

یک پروژه فقط کد نیست. کد است **و** مستندات است **و** SQL است **و** تست است **و**
پیکربندی‌ای که همه را به هم گره می‌زند. KawnGraph هر کدام را به‌عنوان یک **لایهٔ
(layer)** مجزا مدل می‌کند، تا یک پرس‌وجو دقیقاً همان چیزی را که نیاز دارد بخواهد و
نه چیزی بیشتر — یک پرس‌وجوی اثرِ کد هرگز مستنداتِ بازاریابی را به میان نمی‌کشد؛ یک
پرس‌وجوی مستندات هرگز گرافِ فراخوانیِ خام را بازنمی‌گرداند، مگر آنکه درخواست کنید.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph مخزنِ شما را با اسکنرهای قطعی به یک گرافِ لایه‌بندی‌شده در .kawn/graph.json می‌خواند (لایه‌های code، data، config، docs، test) و آن را به‌صورت فقط‌خواندنی به CLIِ kawn، سرورِ MCP و Studio عرضه می‌کند. بدون شبکه، بدون LLM، بدون تله‌متری." width="860">
</div>

| لایه     | نمونه‌ها                                            |
| -------- | --------------------------------------------------- |
| `code`   | files, functions, classes, imports, calls, routes   |
| `data`   | SQL tables, migrations, foreign keys                |
| `config` | workspace packages, dependencies                    |
| `docs`   | markdown sections, links, mentions                  |
| `test`   | tests and what they cover                           |

هر یال (edge) حاملِ **شواهد** است (مسیرِ منبع، بازهٔ خطوط، قطعه‌کد) و یک سطحِ
اطمینان؛ هر گره (node) یک **شناسهٔ پایدارِ محتوامحور (content-addressable)** دارد
تا گراف در طولِ اسکن‌ها قابلِ مقایسه (diffable) بماند. مدلِ عمیق‌تر:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### یک Context Pack، از ابتدا تا انتها

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

همان بسته به‌صورت Markdown، JSON، یا **Universal Context Protocol** که نسبت به
ایجنت بی‌طرف است در دسترس است (`--format ucp` / `ucp-md`). بیشتر:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` ابزارِ **KawnGraph Studio** را باز می‌کند — یک کاوشگرِ محلیِ
**فقط‌خواندنی** که روی `127.0.0.1` عرضه می‌شود، فایلِ موجودِ `.kawn/graph.json` را
می‌خواند و هرگز اسکن، بازسازی یا بازنویسی نمی‌کند. این ابزار یک گرافِ تعاملیِ دوبعدی،
یک نقشهٔ ستاره‌ایِ سه‌بعدیِ مقیاس‌پذیر با نامِ «Universe» (با بودجه، تا هرگز یک گرافِ
بزرگ را یکجا ترسیم نکند)، یک سازندهٔ Context Pack، اثرِ معکوس، نماهای تغییراتِ Git، و
یک نمای محک (benchmark) رفتاری را ارائه می‌دهد. به انگلیسی و عربی ساخته شده
(با آگاهی از RTL). آن را از منبع با `pnpm studio:build &&
pnpm kawn map` اجرا کنید.

> یک تصویرِ گرفته‌شده از Studio پس از گذرِ بعدیِ ثبتِ تصویر به `docs/assets/` افزوده
> خواهد شد؛ تا آن زمان نمودارهای بالا تصاویرِ رسمی هستند.

---

## KawnGraph در برابرِ جست‌وجوی سادهٔ مخزن

یک مقایسهٔ بی‌طرف از *رویکردها* (نه حمله به رقیب). هر سلول قابل‌دفاع است؛ «varies»
یعنی به ابزارِ مشخص بستگی دارد.

| توانایی | Plain search | General RAG | Generic graph viewer | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| اسکنِ محلیِ قطعی | ✅ | varies | ✅ | ✅ |
| روابط در سطحِ نماد | ❌ | varies | ✅ | ✅ |
| لایه‌های مستندات / داده / تست | ❌ | varies | varies | ✅ |
| شواهد روی هر یال | ❌ | ❌ | varies | ✅ |
| تحلیلِ اثرِ کران‌دار | ❌ | ❌ | varies | ✅ |
| بافتارِ تغییراتِ Git | varies | ❌ | ❌ | ✅ |
| Context Pack با بودجهٔ توکن | ❌ | varies | ❌ | ✅ |
| بازیابیِ MCPِ فقط‌خواندنی | ❌ | varies | varies | ✅ |
| بدون نیاز به LLMِ داخلی | ✅ | ❌ | ✅ | ✅ |

یک مقایسهٔ سه‌ستونهٔ تاریخ‌دار و منبع‌دار در برابرِ یک ابزارِ گرافیِ بالغ (توانایی‌هایی
که KawnGraph در آن‌ها پیشتاز است **و** توانایی‌هایی که نیست) در
**[docs/COMPARISON.md](../COMPARISON.md)** آمده است.

---

## محک‌ها (Benchmarks)

KawnGraph یک **مهارِ (harness) A/Bِ محلی** ارائه می‌دهد که *همان* ایجنت را روی
*همان* وظیفه **با و بدونِ** KawnGraph اجرا می‌کند و رفتار را ثبت می‌کند. نتایج
صادقانه و **وابسته‌به‌وظیفه** هستند — از جمله موارد خنثی و منفی.

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

روش‌شناسی، محیط، اندازهٔ نمونه‌ها، جدول‌های هر-معیار و محدودیت‌ها:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — تولیدشده از آرتیفکتِ commit‌شده و
تأییدشده در [`benchmarks/published/`](../../benchmarks/published/).

---

## اسکنرها و لایه‌های پشتیبانی‌شده

هر زبان/قالب یک **افزونهٔ اسکنرِ (scanner plugin) نسخه‌بندی‌شده** پشتِ یک رجیستریِ
واحد است (detect → scan → finalize): ترتیبِ قطعی، جداسازیِ خطا در سطحِ هر فایل،
ثبتِ صریح، و اندازهٔ فایلِ کران‌دار.

| زبان / قالب | استخراج‌شده |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

دو حذفِ آگاهانه در هر دو اسکنرِ کد: متدها/توابعِ تودرتو هرگز گره‌های جداگانه نیستند
(یک متد به‌عنوان متادیتا روی کلاسِ خود سوار می‌شود)، و فایل‌های اعلانِ محیطی
(`.d.ts`، `.pyi`) هرگز ادعا (claim) نمی‌شوند. جزئیات:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## حریمِ خصوصی و امنیت

- **به‌طور پیش‌فرض بدون شبکه.** اسکن و بازیابی مخزنِ شما را می‌خوانند و JSON را زیرِ
  `.kawn/` می‌نویسند. هیچ چیزی از دستگاه خارج نمی‌شود.
- **بدون LLMِ داخلی.** کد، مستندات و SQL به‌صورت ساختاری تجزیه (parse) می‌شوند؛
  غنی‌سازیِ هوش‌مصنوعی اختیاری (opt-in) و محلی-اول (local-first) است.
- **بدون تله‌متری. به‌طور پیش‌فرض بدون ثبتِ پرس‌وجو.**
- **MCPِ فقط‌خواندنی.** سرور گراف را عرضه می‌کند؛ هرگز آن را اسکن، بازسازی یا
  بازنویسی نمی‌کند — و از عرضهٔ گرافی که نتواند به طرح‌وارهٔ (schema) آن اعتماد کند
  سر باز می‌زند.
- **یکپارچه‌سازی‌های برگشت‌پذیر و محدود به پروژه.** نوشتن‌های اتمیک، پشتیبان‌های
  زمان‌مهرخورده (timestamped)، ویرایش‌های پیکربندیِ ساختاریافته (نه رشته‌ای)؛ هرگز
  `CLAUDE.md` / `AGENTS.md` را ویرایش نمی‌کند و به‌طور پیش‌فرض هرگز پیکربندیِ سراسری
  (global) را لمس نمی‌کند.

مدلِ کامل: **[docs/PRIVACY.md](../PRIVACY.md)**. یک آسیب‌پذیری را به‌صورت محرمانه از
طریقِ **[SECURITY.md](../../SECURITY.md)** گزارش دهید.

---

## وضعیت و محدودیت‌ها

KawnGraph در **توسعهٔ فعال** است (`v0.1.0`، هنوز در npm منتشر نشده). به‌صورتِ
سرتاسری (end-to-end) ساخته و آزموده شده است: گرافِ code/data/config/docs/test،
پیوندهای مستندات-به-کد، پرس‌وجوی محدود به حالت، تحلیلِ اثر، اثرِ Git/PR، Context
Pack با بودجهٔ توکن، Universal Context Protocol، سرورِ MCPِ فقط‌خواندنی، راه‌اندازیِ
تک‌فرمانیِ ایجنت (Claude Code / Codex / Cursor)، Studio، و مهارِ محکِ A/B.

**محدودیت‌های صادقانه.** محکِ منتشرشده **اکتشافی (n<5 در هر بازو — جهت‌نما، نه
معنادار)** است. KawnGraph بیشترین کمک را در کشفِ چندفایلیِ ناآشنا می‌کند و می‌تواند
در وظایفِ تک‌فایلیِ از پیش‌متمرکز سربار اضافه کند. هنوز ساخته نشده: هوک‌های اختیاریِ
فقط-پیشنهاددهنده، لایهٔ بصری، غنی‌سازیِ معنایی/هوش‌مصنوعی، و یک لایهٔ زمانِ‌اجرا
(runtime) — همگی به‌صورتِ اختیاری در طراحی. ببینید
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## مستندات

| راهنما | درونِ آن چیست |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | نصب، اسکن، اولین Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | قراردادِ راه‌اندازیِ MCP، برگشت‌پذیری |
| [Context Packs](../CONTEXT_PACKS.md) | رتبه‌بندی، بودجه‌ها، قالبِ سیمیِ (wire) UCP |
| [Graph model](../GRAPH_MODEL.md) | گره‌ها، یال‌ها، لایه‌ها، شواهد، شناسه‌ها |
| [Scanners](../SCANNERS.md) | اینکه هر افزونهٔ زبان چه استخراج می‌کند |
| [Benchmarks](../BENCHMARKS.md) | روش‌شناسی، محیط، نتایجِ کامل |
| [Comparison](../COMPARISON.md) | مقایسهٔ توانمندیِ تاریخ‌دار و منبع‌دار |
| [Privacy](../PRIVACY.md) | مرزهای داده در هر لایه |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | مشکلات و پرسش‌های رایج |

---

## مشارکت

مشارکت‌ها خوش‌آمدند. از منبع بسازید، مجموعهٔ تست را اجرا کنید و راهنما را بخوانید:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

برای راه‌اندازی، قراردادها و بازبینیِ حریمِ خصوصی که هر PR از آن می‌گذرد
**[CONTRIBUTING.md](../../CONTRIBUTING.md)** را ببینید؛ برای انتظاراتِ جامعه
**[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)**؛ برای افزودن یا بازبینیِ یک زبان
**[docs/i18n/TRANSLATING.md](TRANSLATING.md)**؛ و برای اینکه کجا پرسش کنید
**[SUPPORT.md](../../SUPPORT.md)**.

---

## مجوز و سپاسگزاری‌ها

**[MIT](../../LICENSE)** © مشارکت‌کنندگانِ KawnGraph.

**Kawn** (عربی **كَوْن** — *کیهان، جهان، هستی*) یک مخزن را همچون جهانی زنده از دانش
می‌نگرد؛ **Graph** همان Agent Context Graphِ مبتنی‌بر شواهد در هستهٔ آن است. ساخته
شده با [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/),
[React](https://react.dev/), [React Flow](https://reactflow.dev/),
[Three.js](https://threejs.org/), و
[`@lezer/python`](https://lezer.codemirror.net/).

</div>
