<!-- KAWN-TRANSLATION
lang: ru
status: machine-assisted
canonical: README.md
canonical-sha: 0bb15f5b2c5f88091d6bab4790ba6fb35c715b08dae4fceb9b54f7e15626992e
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### Вселенная контекста для агентов

**Одна вселенная проекта. Каждый кодовый агент.**

KawnGraph отображает код, документацию, данные, тесты и изменения Git в подкреплённые
доказательствами **Context Packs** (пакеты контекста), чтобы Claude, Codex и Cursor могли
найти нужные файлы, не читая весь репозиторий.

[English](../../README.md) · [العربية](../../README.ar.md) · [Русский] (текущий) · [статус перевода](STATUS.md)

> Этот перевод выполнен с помощью машины и может содержать ошибки. Каноническая версия на английском языке — [README.md](../../README.md); см. [STATUS.md](STATUS.md).

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="Задача («Исправить колбэк OAuth для Zid») поступает в KawnGraph, который возвращает Context Pack с учётом бюджета токенов: обязательные к прочтению файлы, связанные документы, таблицы, тесты, риски, список исключённого и оценку уверенности." width="860">
</div>

---

## Зачем нужен KawnGraph?

Когда вы даёте кодовому агенту задачу, он обычно начинает с *чтения* — и много. Он
открывает десятки файлов, заново выводит, как маршруты доходят до базы данных, и каждый раз
перестраивает одну и ту же ментальную модель. Это медленно, дорого по токенам и часто
неточно: агент пропускает один действительно важный файл и тонет в пяти, которые не имеют
значения.

KawnGraph сканирует репозиторий **один раз**, строит многослойный, подкреплённый
доказательствами граф того, как всё связано, а затем для конкретной задачи отвечает
**теми немногими файлами, что важны** — плюс соответствующая документация, связанные таблицы
базы данных, тесты для запуска и риски, за которыми стоит следить. Этот набор и есть
**Context Pack**. Граф — это основа; Context Pack — это продукт.

> **Дайте агентам карту, а не репозиторий.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Быстрый старт

> **Внимание:** npm-пакет `kawngraph` **ещё не опубликован**, поэтому
> `npx kawngraph …` сегодня *недоступен*. Используйте путь сборки из исходников ниже;
> поток `npx` показан для **периода после публикации**.

**Сегодня — из исходников** (этот монорепозиторий, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**После публикации в npm** (задуманный опыт работы одной командой):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Затем откройте вашего агента и просто опишите задачу — он сам подтянет те немногие
файлы, что важны. Никаких API-ключей, никакой телеметрии, никаких сетевых вызовов во время
сканирования или извлечения. Впервые здесь? Начните с **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Подключите его к вашему кодовому агенту

Суть KawnGraph в том, что агент обращается к карте **автоматически**.
Одна команда подключает проект к используемым вами агентам — без редактирования `CLAUDE.md`
или `AGENTS.md`, причём каждое изменение обратимо:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` обнаруживает **Claude Code**, **Codex** и **Cursor** и устанавливает
**интеграцию MCP только для чтения**, ограниченную проектом (`.mcp.json`,
`.cursor/mcp.json` или `.codex/config.toml`), создавая резервные копии всего, к чему
прикасается, и проверяя сервер живым рукопожатием. Полный контракт:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**MCP-сервер** — это JSON-RPC через stdio только для чтения с нулевыми зависимостями и четырьмя инструментами:

| Инструмент | Что он делает |
| ---- | ------------ |
| `kawn_context` | Context Pack с учётом бюджета токенов для задачи. |
| `kawn_query` | Ранжированный поиск по графу с ограничением по режиму. |
| `kawn_affected` | Обратное влияние: что зависит от символа. |
| `kawn_changes` | Влияние текущего набора изменений (незакоммиченных или ветки относительно базовой ссылки). Только локальный git. |

Он **только читает** граф — он никогда не сканирует, не перестраивает и не записывает его (он предупреждает,
когда граф выглядит устаревшим, и указывает на `kawn update`).

---

## Как это работает

Проект — это не только код. Это код **и** документация **и** SQL **и** тесты
**и** конфигурация, которая их связывает. KawnGraph моделирует каждый из них как
отдельный **слой**, чтобы запрос запрашивал ровно то, что ему нужно, и ничего лишнего —
запрос о влиянии на код никогда не тянет маркетинговую документацию; запрос о документации никогда не
возвращает сырые графы вызовов, если вы об этом не просите.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph читает ваш репозиторий детерминированными сканерами в один многослойный граф в .kawn/graph.json (слои code, data, config, docs, test), предоставляемый только для чтения CLI kawn, MCP-серверу и Studio. Без сети, без LLM, без телеметрии." width="860">
</div>

| Слой    | Примеры                                            |
| -------- | --------------------------------------------------- |
| `code`   | файлы, функции, классы, импорты, вызовы, маршруты   |
| `data`   | SQL-таблицы, миграции, внешние ключи                |
| `config` | пакеты рабочего пространства, зависимости                    |
| `docs`   | разделы markdown, ссылки, упоминания                  |
| `test`   | тесты и то, что они покрывают                           |

Каждое ребро несёт **доказательство** (путь к источнику, диапазон строк, фрагмент) и
уровень уверенности; каждый узел имеет **стабильный, адресуемый по содержимому ID**, поэтому
граф остаётся сравнимым между сканированиями. Подробнее о модели:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Context Pack от начала до конца

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

Тот же пакет доступен в виде Markdown, JSON или нейтрального к агенту **Universal
Context Protocol** (`--format ucp` / `ucp-md`). Подробнее:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` открывает **KawnGraph Studio** — локальный обозреватель **только для чтения**,
обслуживаемый по `127.0.0.1`, который читает существующий `.kawn/graph.json` и никогда не сканирует,
не перестраивает и не записывает. Он предлагает интерактивный 2D-граф, масштабируемую 3D-«Вселенную» —
звёздную карту (с бюджетом, чтобы она никогда не отрисовывала весь большой граф сразу), конструктор
Context Pack, обратное влияние, представления изменений Git и представление поведенческого бенчмарка. Собран
на английском и арабском языках (с поддержкой RTL). Запускайте из исходников командой `pnpm studio:build &&
pnpm kawn map`.

> Снимок экрана Studio будет добавлен в `docs/assets/` после следующего
> прохода визуального захвата; до тех пор каноническими визуальными материалами являются диаграммы выше.

---

## KawnGraph против обычного поиска по репозиторию

Нейтральное сравнение *подходов* (не атака на конкурентов). Каждая ячейка
обоснована; «varies» означает, что это зависит от конкретного инструмента.

| Возможность | Обычный поиск | Общий RAG | Универсальный просмотрщик графов | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Детерминированное локальное сканирование | ✅ | varies | ✅ | ✅ |
| Связи на уровне символов | ❌ | varies | ✅ | ✅ |
| Слои docs / data / test | ❌ | varies | varies | ✅ |
| Доказательство на каждом ребре | ❌ | ❌ | varies | ✅ |
| Ограниченный анализ влияния | ❌ | ❌ | varies | ✅ |
| Контекст изменений Git | varies | ❌ | ❌ | ✅ |
| Context Packs с учётом бюджета токенов | ❌ | varies | ❌ | ✅ |
| Извлечение через MCP только для чтения | ❌ | varies | varies | ✅ |
| Не требуется внутренний LLM | ✅ | ❌ | ✅ | ✅ |

Датированное, с источниками, трёхколоночное сравнение со зрелым графовым инструментом
(возможности, в которых KawnGraph лидирует, **и** возможности, в которых нет) находится в
**[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Бенчмарки

KawnGraph поставляется с **локальным A/B-стендом**, который запускает *одного и того же* агента на *одной и той же*
задаче **с KawnGraph и без него** и фиксирует поведение. Результаты честны и
**зависят от задачи** — включая нейтральные и отрицательные случаи.

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

Методология, окружение, размеры выборок, таблицы по каждой метрике и ограничения:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — сгенерировано из закоммиченного,
проверенного артефакта в [`benchmarks/published/`](../../benchmarks/published/).

---

## Поддерживаемые сканеры и слои

Каждый язык/формат — это версионируемый **плагин-сканер** за единым реестром
(detect → scan → finalize): детерминированный порядок, изоляция сбоев по каждому файлу,
явная регистрация и ограниченные размеры файлов.

| Язык / формат | Извлекается |
| ----------------- | --------- |
| TypeScript / JS   | файлы, функции/классы верхнего уровня, импорты, вызовы, маршруты Next.js, тесты |
| Python            | `def`/`async def`/`class` верхнего уровня, декораторы, методы (как метаданные), импорты, маршруты FastAPI/Flask, docstrings, тесты (через `@lezer/python` — чистый JS, устойчивый к ошибкам) |
| SQL               | таблицы (`CREATE`/`ALTER`), связи внешних ключей |
| package.json      | пакеты рабочего пространства и внутренние зависимости |
| Markdown          | заголовки/разделы, связанные с кодом, SQL и маршрутами |

Два намеренных упущения в обоих сканерах кода: методы/вложенные функции
никогда не являются отдельными узлами (метод едет на своём классе как метаданные), а
файлы внешних объявлений (`.d.ts`, `.pyi`) никогда не заявляются. Подробности:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Конфиденциальность и безопасность

- **По умолчанию без сети.** Сканирование и извлечение читают ваш репозиторий и записывают JSON
  в `.kawn/`. Ничто не покидает машину.
- **Без внутреннего LLM.** Код, документация и SQL разбираются структурно; обогащение ИИ
  включается по желанию и работает локально.
- **Без телеметрии. Без логирования запросов по умолчанию.**
- **MCP только для чтения.** Сервер обслуживает граф; он никогда не сканирует, не перестраивает и не
  записывает — и отказывается обслуживать граф, схеме которого он не может доверять.
- **Обратимые интеграции в пределах проекта.** Атомарные записи, резервные копии с
  отметками времени, структурированное (а не строковое) редактирование конфигурации; никогда не редактирует `CLAUDE.md` /
  `AGENTS.md`, никогда не трогает глобальную конфигурацию по умолчанию.

Полная модель: **[docs/PRIVACY.md](../PRIVACY.md)**. Сообщить об уязвимости
приватно можно через **[SECURITY.md](../../SECURITY.md)**.

---

## Статус и ограничения

KawnGraph находится в **активной разработке** (`v0.1.0`, ещё не опубликован в npm). Собрано
и протестировано от начала до конца: граф code/data/config/docs/test, связи документации с кодом,
запрос с ограничением по режиму, анализ влияния, влияние Git/PR, Context Packs с учётом бюджета токенов,
Universal Context Protocol, MCP-сервер только для чтения, настройка агента одной командой
(Claude Code / Codex / Cursor), Studio и A/B-стенд для бенчмарков.

**Честные ограничения.** Опубликованный бенчмарк является **исследовательским (n<5 на плечо —
ориентировочно, не значимо)**. KawnGraph помогает больше всего в незнакомом многофайловом
обнаружении и может добавлять накладные расходы в уже сфокусированных однофайловых задачах. Ещё не
построено: опциональные хуки только с подсказками, визуальный слой, семантическое/ИИ-обогащение и
рантайм-слой — всё по замыслу опционально. См.
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Документация

| Руководство | Что внутри |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | Установка, сканирование, первый Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | Контракт настройки MCP, обратимость |
| [Context Packs](../CONTEXT_PACKS.md) | Ранжирование, бюджеты, проводной формат UCP |
| [Graph model](../GRAPH_MODEL.md) | Узлы, рёбра, слои, доказательства, ID |
| [Scanners](../SCANNERS.md) | Что извлекает каждый языковой плагин |
| [Benchmarks](../BENCHMARKS.md) | Методология, окружение, полные результаты |
| [Comparison](../COMPARISON.md) | Датированное, с источниками, сравнение возможностей |
| [Privacy](../PRIVACY.md) | Границы данных по каждому слою |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Частые проблемы и вопросы |

---

## Участие в разработке

Вклады приветствуются. Соберите из исходников, запустите набор тестов и прочитайте руководство:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

См. **[CONTRIBUTING.md](../../CONTRIBUTING.md)** для настройки, соглашений и
проверки конфиденциальности, которую проходит каждый PR; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** для
ожиданий сообщества; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**,
чтобы добавить или проверить язык; и **[SUPPORT.md](../../SUPPORT.md)** для того, где задавать
вопросы.

---

## Лицензия и благодарности

**[MIT](../../LICENSE)** © участники KawnGraph.

**Kawn** (по-арабски **كَوْن** — *космос, вселенная, бытие*) рассматривает репозиторий как
живую вселенную знаний; **Graph** — это подкреплённый доказательствами Agent Context
Graph в его основе. Создано с [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/) и
[`@lezer/python`](https://lezer.codemirror.net/).
