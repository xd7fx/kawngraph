<!-- KAWN-TRANSLATION
lang: he
status: machine-assisted
canonical: README.md
canonical-sha: ab7d13ed267d0a841de534a293213dc0b66856849dac2fd92e1c6af204679af8
-->

<div dir="rtl">

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### יקום ההקשר של הסוכן

**יקום פרויקט אחד. כל סוכן קוד.**

KawnGraph ממפה קוד, מסמכים, נתונים, בדיקות ושינויי Git ל-**Context Packs**
מבוססי-ראיות, כדי ש-Claude, Codex ו-Cursor יוכלו להגיע אל הקבצים הנכונים מבלי
לקרוא את כל המאגר (repository).

[English](../../README.md) · [العربية](../../README.ar.md) · [עברית] (נוכחי) · [translation status](STATUS.md)

</div>

> **שים לב:** תרגום זה הוא בסיוע-מכונה (machine-assisted) ועלול להכיל שגיאות.
> המקור הקנוני הוא הגרסה האנגלית [README.md](../../README.md). את מצב התרגומים
> ניתן לראות ב-[STATUS.md](STATUS.md).

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="משימה (« תיקון ה-callback של Zid OAuth שכותב אסימוני חנות ») זורמת אל KawnGraph, שמחזיר Context Pack בתקציב טוקנים: קבצים שחובה לקרוא, מסמכים קשורים, טבלאות, בדיקות, סיכונים, רשימה של פריטים שהוחרגו, וציון ביטחון." width="860">
</div>

---

## למה KawnGraph?

כשנותנים לסוכן קוד משימה, הוא בדרך כלל מתחיל ב*קריאה* — והרבה. הוא פותח עשרות
קבצים, מסיק מחדש כיצד המסלולים (routes) מגיעים אל מסד הנתונים, ובונה מחדש את אותו
מודל מנטלי בכל בקשה. זה איטי, יקר מבחינת טוקנים, ולעיתים קרובות לא מדויק: הסוכן
מפספס את הקובץ האחד שחשוב וטובע בחמישה שאינם.

KawnGraph סורק את המאגר **פעם אחת**, בונה גרף שכבתי ומבוסס-ראיות של אופן הקשרים בין
הדברים, ואז עונה, עבור משימה מסוימת, עם **אותם מעט קבצים שחשובים** — בנוסף למסמכים
הרלוונטיים, טבלאות מסד הנתונים הקשורות, הבדיקות שצריך להריץ, והסיכונים שיש לעקוב
אחריהם. החבילה הזו היא **Context Pack**. הגרף הוא התשתית; ה-Context Pack הוא המוצר.

> **תנו לסוכנים את המפה, לא את כל המאגר.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## התחלה מהירה

> **לתשומת לבכם:** חבילת ה-npm בשם `kawngraph` **טרם פורסמה**, ולכן
> `npx kawngraph …` *אינה* זמינה היום. השתמשו בנתיב הבנייה-מהמקור שלהלן; זרימת
> ה-`npx` מוצגת עבור **לאחר הפרסום**.

**היום — מהמקור** (אותו monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**לאחר הפרסום ב-npm** (חוויית הפקודה-האחת המיועדת):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

לאחר מכן פתחו את הסוכן שלכם ופשוט תארו את המשימה — הוא ימשוך בעצמו את אותם מעט
קבצים שחשובים. ללא מפתחות API, ללא טלמטריה, ללא קריאות רשת במהלך סריקה או אחזור.
חדשים בנושא? התחילו ב-**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## חברו אותו לסוכן הקוד שלכם

עיקר העניין ב-KawnGraph הוא שהסוכן פונה אל המפה **באופן אוטומטי**. פקודה אחת מחווטת
פרויקט אל הסוכנים שאתם משתמשים בהם — מבלי לערוך את `CLAUDE.md` או `AGENTS.md`, וכל
שינוי הפיך:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` מזהה את **Claude Code**, **Codex** ו-**Cursor** ומתקין **אינטגרציית MCP
לקריאה-בלבד (read-only)** המוגבלת לפרויקט (`.mcp.json`, `.cursor/mcp.json`, או
`.codex/config.toml`), מגבה כל דבר שהוא נוגע בו ומאמת את השרת בלחיצת-יד (handshake)
חיה. החוזה המלא: **[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**שרת ה-MCP** הוא stdio JSON-RPC לקריאה-בלבד ללא תלויות וכולל ארבעה כלים:

| כלי | מה הוא עושה |
| ---- | ------------ |
| `kawn_context` | Context Pack בתקציב טוקנים עבור משימה. |
| `kawn_query` | חיפוש מדורג ומוגבל-מצב (mode) על פני הגרף. |
| `kawn_affected` | השפעה הפוכה: מה תלוי בסמל (symbol). |
| `kawn_changes` | השפעה של מערך השינויים הנוכחי (לא-מקומיט, או ענף מול ייחוס בסיס). Git מקומי בלבד. |

הוא **רק קורא** את הגרף — לעולם אינו סורק, בונה מחדש או כותב אותו (הוא מתריע כאשר
הגרף נראה מיושן ומפנה אל `kawn update`).

---

## איך זה עובד

פרויקט אינו רק קוד. הוא קוד **וגם** מסמכים **וגם** SQL **וגם** בדיקות **וגם**
הקונפיגורציה שקושרת ביניהם. KawnGraph ממדל כל אחד מהם כ**שכבה (layer)** נפרדת, כך
ששאילתה מבקשת בדיוק את מה שהיא צריכה ולא דבר שאינה צריכה — שאילתת השפעת-קוד לעולם לא
גוררת פנימה מסמכי שיווק; שאילתת מסמכים לעולם לא מחזירה גרפי קריאה גולמיים אלא אם
ביקשתם.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph קורא את המאגר שלכם עם סורקים דטרמיניסטיים לגרף שכבתי אחד ב-.kawn/graph.json (שכבות code, data, config, docs, test), ומגיש אותו לקריאה-בלבד אל ה-CLI של kawn, שרת ה-MCP ו-Studio. ללא רשת, ללא LLM, ללא טלמטריה." width="860">
</div>

| שכבה     | דוגמאות                                            |
| -------- | --------------------------------------------------- |
| `code`   | files, functions, classes, imports, calls, routes   |
| `data`   | SQL tables, migrations, foreign keys                |
| `config` | workspace packages, dependencies                    |
| `docs`   | markdown sections, links, mentions                  |
| `test`   | tests and what they cover                           |

כל קשת (edge) נושאת **ראיות** (נתיב מקור, טווח שורות, קטע קוד) ורמת ביטחון; לכל
צומת (node) יש **מזהה יציב וממוען-תוכן (content-addressable)** כך שהגרף נשאר בר-השוואה
(diffable) בין סריקות. מודל מעמיק יותר:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Context Pack, מקצה לקצה

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

אותה חבילה זמינה כ-Markdown, JSON, או כ-**Universal Context Protocol** הנייטרלי
ביחס לסוכן (`--format ucp` / `ucp-md`). עוד:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` פותח את **KawnGraph Studio** — סייר מקומי **לקריאה-בלבד** המוגש דרך
`127.0.0.1`, שקורא את ה-`.kawn/graph.json` הקיים ולעולם אינו סורק, בונה מחדש או
כותב. הוא מציע גרף דו-ממדי אינטראקטיבי, מפת-כוכבים תלת-ממדית מדרגית בשם "Universe"
(מתוקצבת כך שלעולם לא תצייר גרף גדול שלם בבת אחת), בונה Context-Pack, השפעה הפוכה,
תצוגות שינויי Git, ותצוגת מדד (benchmark) התנהגותית. בנוי באנגלית ובערבית (מודע
ל-RTL). הריצו אותו מהמקור עם `pnpm studio:build &&
pnpm kawn map`.

> צילום מסך שנלכד של Studio יתווסף אל `docs/assets/` לאחר מעבר לכידת-החזותיות הבא;
> עד אז הדיאגרמות שלמעלה הן החזותיים הקנוניים.

---

## KawnGraph לעומת חיפוש מאגר רגיל

השוואה נייטרלית של *גישות* (לא התקפה על מתחרה). כל תא בר-הגנה; "varies" משמעו שזה
תלוי בכלי הספציפי.

| יכולת | Plain search | General RAG | Generic graph viewer | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| סריקה מקומית דטרמיניסטית | ✅ | varies | ✅ | ✅ |
| קשרים ברמת הסמל | ❌ | varies | ✅ | ✅ |
| שכבות מסמכים / נתונים / בדיקות | ❌ | varies | varies | ✅ |
| ראיות על כל קשת | ❌ | ❌ | varies | ✅ |
| ניתוח השפעה תחום | ❌ | ❌ | varies | ✅ |
| הקשר של שינויי Git | varies | ❌ | ❌ | ✅ |
| Context Packs בתקציב טוקנים | ❌ | varies | ❌ | ✅ |
| אחזור MCP לקריאה-בלבד | ❌ | varies | varies | ✅ |
| אין צורך ב-LLM פנימי | ✅ | ❌ | ✅ | ✅ |

השוואה תלת-עמודתית מתוארכת וממוקרת מול כלי גרף בוגר (יכולות שבהן KawnGraph מוביל
**וגם** יכולות שבהן אינו) נמצאת ב-**[docs/COMPARISON.md](../COMPARISON.md)**.

---

## מדדים (Benchmarks)

KawnGraph מספק **רתמת (harness) A/B מקומית** המריצה את *אותו* סוכן על *אותה* משימה
**עם ובלי** KawnGraph ומתעדת התנהגות. התוצאות כנות ו**תלויות-משימה** — כולל מקרים
נייטרליים ושליליים.

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

מתודולוגיה, סביבה, גודלי דגימה, הטבלאות לכל-מדד, והמגבלות:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — נוצר מהארטיפקט שעבר commit ואומת
ב-[`benchmarks/published/`](../../benchmarks/published/).

---

## סורקים ושכבות נתמכים

כל שפה/פורמט הוא **תוסף סורק (scanner plugin) ממוספר-גרסה** מאחורי רישום אחד
(detect → scan → finalize): סדר דטרמיניסטי, בידוד כשל ברמת הקובץ, רישום מפורש,
וגדלי קבצים תחומים.

| שפה / פורמט | מה מחולץ |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

שני השמטות מכוונות בשני סורקי הקוד: מתודות/פונקציות מקוננות לעולם אינן צמתים נפרדים
(מתודה רוכבת על המחלקה שלה כמטא-נתון), וקובצי הצהרה סביבתיים (`.d.ts`, `.pyi`)
לעולם אינם נתבעים (claim). פרטים: **[docs/SCANNERS.md](../SCANNERS.md)**.

---

## פרטיות ואבטחה

- **ללא רשת כברירת מחדל.** הסריקה והאחזור קוראים את המאגר שלכם וכותבים JSON תחת
  `.kawn/`. שום דבר אינו עוזב את המכונה.
- **ללא LLM פנימי.** קוד, מסמכים ו-SQL מפורקים (parse) באופן מבני; העשרת ה-AI היא
  בהצטרפות (opt-in) ומקומית-תחילה (local-first).
- **ללא טלמטריה. ללא רישום שאילתות כברירת מחדל.**
- **MCP לקריאה-בלבד.** השרת מגיש את הגרף; לעולם אינו סורק, בונה מחדש או כותב — ומסרב
  להגיש גרף שלא יכול לבטוח בסכמה (schema) שלו.
- **אינטגרציות הפיכות ומוגבלות-פרויקט.** כתיבות אטומיות, גיבויים מתויגי-זמן
  (timestamped), עריכות קונפיגורציה מבניות (לא מחרוזתיות); לעולם אינו עורך
  `CLAUDE.md` / `AGENTS.md`, ולעולם אינו נוגע בקונפיגורציה גלובלית (global) כברירת
  מחדל.

המודל המלא: **[docs/PRIVACY.md](../PRIVACY.md)**. דווחו על פגיעות באופן פרטי דרך
**[SECURITY.md](../../SECURITY.md)**.

---

## מצב ומגבלות

KawnGraph נמצא ב**פיתוח פעיל** (`v0.1.0`, טרם פורסם ל-npm). נבנה ונבדק מקצה לקצה:
גרף ה-code/data/config/docs/test, קישורי מסמכים-לקוד, שאילתה מוגבלת-מצב, ניתוח
השפעה, השפעת Git/PR, Context Packs בתקציב טוקנים, ה-Universal Context Protocol, שרת
ה-MCP לקריאה-בלבד, התקנת סוכן בפקודה-אחת (Claude Code / Codex / Cursor), Studio,
ורתמת המדד A/B.

**מגבלות כנות.** המדד שפורסם הוא **אקספלורטיבי (n<5 לכל זרוע — כיווני, לא מובהק)**.
KawnGraph עוזר בעיקר בגילוי רב-קבצים לא-מוכר ויכול להוסיף תקורה במשימות חד-קובץ
ממוקדות-מראש. עדיין לא נבנה: הוקים אופציונליים שמציעים-בלבד, השכבה החזותית, העשרה
סמנטית/AI, ושכבת זמן-ריצה (runtime) — כולם בהצטרפות לפי עיצוב. ראו
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## תיעוד

| מדריך | מה בפנים |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | התקנה, סריקה, Context Pack ראשון |
| [Agent integration](../AGENT_INTEGRATION.md) | חוזה התקנת MCP, הפיכוּת |
| [Context Packs](../CONTEXT_PACKS.md) | דירוג, תקציבים, פורמט החיווט (wire) של UCP |
| [Graph model](../GRAPH_MODEL.md) | צמתים, קשתות, שכבות, ראיות, מזהים |
| [Scanners](../SCANNERS.md) | מה כל תוסף שפה מחלץ |
| [Benchmarks](../BENCHMARKS.md) | מתודולוגיה, סביבה, תוצאות מלאות |
| [Comparison](../COMPARISON.md) | השוואת יכולות מתוארכת וממוקרת |
| [Privacy](../PRIVACY.md) | גבולות נתונים לכל שכבה |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | תקלות ושאלות נפוצות |

---

## תרומה

תרומות מתקבלות בברכה. בנו מהמקור, הריצו את חבילת הבדיקות, וקראו את המדריך:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

ראו **[CONTRIBUTING.md](../../CONTRIBUTING.md)** להתקנה, מוסכמות, וביקורת הפרטיות
שכל PR עובר; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** לציפיות הקהילה;
**[docs/i18n/TRANSLATING.md](TRANSLATING.md)** כדי להוסיף או לבקר שפה; ו-**[SUPPORT.md](../../SUPPORT.md)**
למקום שבו אפשר לשאול שאלות.

---

## רישיון ותודות

**[MIT](../../LICENSE)** © תורמי KawnGraph.

**Kawn** (בערבית **كَوْن** — *קוסמוס, יקום, קיום*) מתייחס למאגר כאל יקום חי של ידע;
**Graph** הוא ה-Agent Context Graph מבוסס-הראיות בליבתו. נבנה עם
[TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/),
[React](https://react.dev/), [React Flow](https://reactflow.dev/),
[Three.js](https://threejs.org/), ו-[`@lezer/python`](https://lezer.codemirror.net/).

</div>
