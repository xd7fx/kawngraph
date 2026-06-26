<!-- KAWN-TRANSLATION
lang: uk
status: machine-assisted
canonical: README.md
canonical-sha: 0bb15f5b2c5f88091d6bab4790ba6fb35c715b08dae4fceb9b54f7e15626992e
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### Всесвіт контексту для агентів

**Один всесвіт проєкту. Кожен агент для написання коду.**

[English](../../README.md) · [العربية](../../README.ar.md) · [Українська] (поточна) · [статус перекладу](STATUS.md)

> Цей переклад виконано за допомогою машинного перекладу й він може містити помилки. Канонічна англійська версія — [README.md](../../README.md). Дивіться [STATUS.md](STATUS.md).

</div>

---

KawnGraph відображає код, документацію, дані, тести та зміни в Git у підкріплені доказами
**Context Packs** (контекстні пакети), щоб Claude, Codex і Cursor могли дістатися до потрібних файлів, не
читаючи весь репозиторій.

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="Завдання («Виправити callback Zid OAuth») надходить у KawnGraph, який повертає Context Pack у межах бюджету токенів: обов'язкові для читання файли, пов'язані документи, таблиці, тести, ризики, список виключеного та оцінку впевненості." width="860">
</div>

---

## Навіщо KawnGraph?

Коли ви даєте агенту для написання коду завдання, він зазвичай починає з *читання* — і дуже багато. Він
відкриває десятки файлів, наново виводить, як маршрути дістаються до бази даних, і щоразу
відбудовує ту саму ментальну модель. Це повільно, дорого з погляду токенів і часто
неточно: агент пропускає той єдиний файл, який має значення, і тоне у п'ятьох, які
значення не мають.

KawnGraph сканує репозиторій **один раз**, будує багатошаровий, підкріплений доказами граф
того, як речі пов'язані, а потім відповідає для конкретного завдання **кількома файлами,
що мають значення** — плюс відповідні документи, пов'язані таблиці бази даних, тести, які треба
запустити, і ризики, за якими слід стежити. Цей набір і є **Context Pack**. Граф — це
підґрунтя; Context Pack — це продукт.

> **Дайте агентам карту, а не репозиторій.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Швидкий старт

> **Зверніть увагу:** npm-пакет `kawngraph` **ще не опубліковано**, тож
> `npx kawngraph …` *наразі недоступний*. Скористайтеся шляхом збирання з вихідного коду нижче;
> потік `npx` показано для **періоду після публікації**.

**Сьогодні — з вихідного коду** (цей монорепозиторій, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Після публікації в npm** (передбачений досвід однієї команди):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Потім відкрийте свого агента й просто опишіть завдання — він самостійно дістане кілька файлів, які
мають значення. Без API-ключів, без телеметрії, без мережевих викликів під час сканування чи
отримання. Уперше з цим? Почніть із **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Підключіть його до свого агента для написання коду

Сенс KawnGraph у тому, що агент звертається до карти **автоматично**.
Одна команда під'єднує проєкт до агентів, якими ви користуєтесь — без редагування `CLAUDE.md`
чи `AGENTS.md`, і кожна зміна оборотна:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` виявляє **Claude Code**, **Codex** і **Cursor** та встановлює
**інтеграцію MCP лише для читання**, обмежену проєктом (`.mcp.json`,
`.cursor/mcp.json` або `.codex/config.toml`), створюючи резервну копію всього, чого торкається, і
перевіряючи сервер живим рукостисканням (handshake). Повний контракт:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**MCP-сервер** — це JSON-RPC через stdio лише для читання, без залежностей, із чотирма інструментами:

| Інструмент | Що він робить |
| ---- | ------------ |
| `kawn_context` | Context Pack у межах бюджету токенів для завдання. |
| `kawn_query` | Ранжований, обмежений режимом пошук по графу. |
| `kawn_affected` | Зворотний вплив: що залежить від символу. |
| `kawn_changes` | Вплив поточного набору змін (незакомічених або гілки відносно базового ref). Лише локальний git. |

Він **лише читає** граф — ніколи не сканує, не перебудовує й не записує його (він попереджає,
коли граф виглядає застарілим, і вказує на `kawn update`).

---

## Як це працює

Проєкт — це не лише код. Це код **і** документація **і** SQL **і** тести
**і** конфігурація, що пов'язує їх разом. KawnGraph моделює кожне з цього як
окремий **шар**, тож запит просить саме те, що йому потрібно, і нічого, що йому не
потрібно — запит на вплив у коді ніколи не затягує маркетингову документацію; запит до документації ніколи не
повертає сирі графи викликів, якщо ви не попросите.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph читає ваш репозиторій детермінованими сканерами в один багатошаровий граф у .kawn/graph.json (шари code, data, config, docs, test), який лише для читання надається CLI kawn, MCP-серверу та Studio. Без мережі, без LLM, без телеметрії." width="860">
</div>

| Шар    | Приклади                                            |
| -------- | --------------------------------------------------- |
| `code`   | файли, функції, класи, імпорти, виклики, маршрути   |
| `data`   | SQL-таблиці, міграції, зовнішні ключі                |
| `config` | пакети робочого простору, залежності                    |
| `docs`   | markdown-розділи, посилання, згадки                  |
| `test`   | тести й те, що вони покривають                           |

Кожне ребро несе **докази** (шлях до джерела, діапазон рядків, фрагмент) і
рівень впевненості; кожен вузол має **стабільний, адресований за вмістом ID**, тож
граф залишається придатним для diff між скануваннями. Глибша модель:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Context Pack від початку до кінця

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

Той самий пакет доступний у форматі Markdown, JSON або агентно-нейтрального **Universal
Context Protocol** (`--format ucp` / `ucp-md`). Більше:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` відкриває **KawnGraph Studio** — локальний оглядач **лише для читання**, який обслуговується
через `127.0.0.1`, читає наявний `.kawn/graph.json` і ніколи не сканує,
не перебудовує й не записує. Він пропонує інтерактивний 2D-граф, масштабовану зоряну карту-«Всесвіт» у 3D
(обмежену бюджетом, тож вона ніколи не малює весь великий граф одразу), конструктор Context Pack,
зворотний вплив, перегляди змін Git і перегляд поведінкового бенчмарку. Зроблено
англійською та арабською (з підтримкою RTL). Запускайте з вихідного коду командою `pnpm studio:build &&
pnpm kawn map`.

> Знятий знімок екрана Studio буде додано до `docs/assets/` після наступного
> проходу візуального захоплення; до того часу діаграми вище є канонічними візуалами.

---

## KawnGraph проти звичайного пошуку по репозиторію

Нейтральне порівняння *підходів* (не атака на конкурентів). Кожна клітинка
обґрунтована; «varies» означає, що це залежить від конкретного інструмента.

| Можливість | Звичайний пошук | Загальний RAG | Універсальний переглядач графів | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Детерміноване локальне сканування | ✅ | varies | ✅ | ✅ |
| Зв'язки на рівні символів | ❌ | varies | ✅ | ✅ |
| Шари docs / data / test | ❌ | varies | varies | ✅ |
| Докази на кожному ребрі | ❌ | ❌ | varies | ✅ |
| Обмежений аналіз впливу | ❌ | ❌ | varies | ✅ |
| Контекст змін Git | varies | ❌ | ❌ | ✅ |
| Context Packs у межах бюджету токенів | ❌ | varies | ❌ | ✅ |
| Отримання через MCP лише для читання | ❌ | varies | varies | ✅ |
| Не потрібен внутрішній LLM | ✅ | ❌ | ✅ | ✅ |

Датоване, із джерелами, тристовпцеве порівняння з зрілим інструментом для графів
(можливості, у яких KawnGraph лідирує, **і** ті, у яких ні) живе в
**[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Бенчмарки

KawnGraph постачається з **локальним A/B-харнесом**, який запускає *той самий* агент на *тому самому*
завданні **з KawnGraph і без** нього та записує поведінку. Результати чесні й
**залежать від завдання** — включно з нейтральними та негативними випадками.

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

Методологія, середовище, розміри вибірок, таблиці по метриках і обмеження:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — згенеровано із закоміченого,
валідованого артефакту в [`benchmarks/published/`](../../benchmarks/published/).

---

## Підтримувані сканери та шари

Кожна мова/формат — це версіонований **плагін-сканер** за одним реєстром
(detect → scan → finalize): детермінований порядок, ізоляція збоїв на рівні файлу,
явна реєстрація та обмежені розміри файлів.

| Мова / формат | Витягується |
| ----------------- | --------- |
| TypeScript / JS   | файли, функції/класи верхнього рівня, імпорти, виклики, маршрути Next.js, тести |
| Python            | `def`/`async def`/`class` верхнього рівня, декоратори, методи (як метадані), імпорти, маршрути FastAPI/Flask, docstring-и, тести (через `@lezer/python` — чистий JS, стійкий до помилок) |
| SQL               | таблиці (`CREATE`/`ALTER`), зв'язки за зовнішніми ключами |
| package.json      | пакети робочого простору та внутрішні залежності |
| Markdown          | заголовки/розділи, пов'язані з кодом, SQL і маршрутами |

Два навмисні упущення в обох сканерах коду: методи/вкладені функції
ніколи не є окремими вузлами (метод їде на своєму класі як метадані), а файли
ambient-декларацій (`.d.ts`, `.pyi`) ніколи не претендуються. Деталі:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Приватність і безпека

- **Без мережі за замовчуванням.** Сканування й отримання читають ваш репозиторій і записують JSON
  під `.kawn/`. Ніщо не залишає машину.
- **Без внутрішнього LLM.** Код, документація та SQL аналізуються структурно; AI-збагачення
  є опціональним і local-first.
- **Без телеметрії. Без журналювання запитів за замовчуванням.**
- **MCP лише для читання.** Сервер обслуговує граф; він ніколи не сканує, не перебудовує й не
  записує — і відмовляється обслуговувати граф, схемі якого він не може довіряти.
- **Оборотні інтеграції в межах проєкту.** Атомарні записи, резервні копії з позначкою часу,
  структуровані (а не рядкові) правки конфігурації; ніколи не редагує `CLAUDE.md` /
  `AGENTS.md`, ніколи не торкається глобальної конфігурації за замовчуванням.

Повна модель: **[docs/PRIVACY.md](../PRIVACY.md)**. Повідомте про вразливість
приватно через **[SECURITY.md](../../SECURITY.md)**.

---

## Статус і обмеження

KawnGraph перебуває в **активній розробці** (`v0.1.0`, ще не опубліковано в npm). Зібрано
й протестовано наскрізно: граф code/data/config/docs/test, зв'язки документація-код,
пошук, обмежений режимом, аналіз впливу, вплив Git/PR, Context Packs у межах бюджету токенів,
Universal Context Protocol, MCP-сервер лише для читання, налаштування агента однією командою
(Claude Code / Codex / Cursor), Studio та A/B-харнес для бенчмарків.

**Чесні межі.** Опублікований бенчмарк є **дослідницьким (n<5 на руку —
орієнтовний, не значущий)**. KawnGraph найбільше допомагає в незнайомому багатофайловому
пошуку й може додавати накладні витрати на вже сфокусованих однофайлових завданнях. Ще не
зроблено: опціональні гачки лише з підказками, візуальний шар, семантичне/AI-збагачення та
рантайм-шар — усе опціональне за задумом. Дивіться
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Документація

| Посібник | Що всередині |
| ----- | ------------- |
| [Перший крок](../GETTING_STARTED.md) | Встановлення, сканування, перший Context Pack |
| [Інтеграція з агентом](../AGENT_INTEGRATION.md) | Контракт налаштування MCP, оборотність |
| [Context Packs](../CONTEXT_PACKS.md) | Ранжування, бюджети, дротовий формат UCP |
| [Модель графа](../GRAPH_MODEL.md) | Вузли, ребра, шари, докази, ID |
| [Сканери](../SCANNERS.md) | Що витягує кожен мовний плагін |
| [Бенчмарки](../BENCHMARKS.md) | Методологія, середовище, повні результати |
| [Порівняння](../COMPARISON.md) | Датоване, із джерелами порівняння можливостей |
| [Приватність](../PRIVACY.md) | Межі даних на кожному шарі |
| [Усунення несправностей](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Поширені проблеми та запитання |

---

## Внесок

Внески вітаються. Зберіть із вихідного коду, запустіть набір тестів і прочитайте посібник:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Дивіться **[CONTRIBUTING.md](../../CONTRIBUTING.md)** для налаштування, домовленостей і
огляду приватності, який проходить кожен PR; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** для
очікувань спільноти; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**,
щоб додати чи переглянути мову; і **[SUPPORT.md](../../SUPPORT.md)**, де можна ставити
запитання.

---

## Ліцензія та подяки

**[MIT](../../LICENSE)** © учасники KawnGraph.

**Kawn** (арабською **كَوْن** — *космос, всесвіт, буття*) розглядає репозиторій як
живий всесвіт знань; **Graph** — це підкріплений доказами Agent Context
Graph у його основі. Зроблено з [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/) і
[`@lezer/python`](https://lezer.codemirror.net/).
</content>
</invoke>
