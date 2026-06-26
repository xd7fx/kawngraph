<!-- KAWN-TRANSLATION
lang: cs
status: machine-assisted
canonical: README.md
canonical-sha: 3abf5a40e951f30aa3a3038e3d8696a9df1e5881002022bbda543f87204f9f64
-->

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../brand/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../../brand/logo-light.svg">
  <img src="../../brand/logo.svg" alt="KawnGraph" width="320">
</picture>

### Vesmír kontextu pro agenty

**Jeden vesmír projektu. Každý kódovací agent.**

KawnGraph mapuje kód, dokumentaci, data, testy a změny v Gitu do **Kontextových
balíčků (Context Packs)** podložených důkazy, takže Claude, Codex a Cursor mohou
najít ty správné soubory, aniž by musely číst celé úložiště.

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
[اردو](README.ur.md) ·
[Polski](README.pl.md) ·
[Nederlands](README.nl.md) ·
[Українська](README.uk.md) ·
[Tiếng Việt](README.vi.md) ·
[ภาษาไทย](README.th.md) ·
[Svenska](README.sv.md) ·
[Ελληνικά](README.el.md) ·
[Română](README.ro.md) ·
**Čeština** ·
[Suomi](README.fi.md) ·
[Dansk](README.da.md) ·
[Norsk](README.no.md) ·
[Magyar](README.hu.md) ·
[עברית](README.he.md)

<sub>English is canonical · العربية is AI-assisted · owner review pending · the other 29 languages are machine-assisted (human review needed) — see [translation status](STATUS.md).</sub>

<!-- LANGBAR:END -->

> Tento překlad je strojově podporovaný a může obsahovat chyby. Kanonickou verzí je anglický [README.md](../../README.md); viz [stav překladů](STATUS.md).

**[Rychlý start](#rychlý-start)** ·
**[Jak to funguje](#jak-to-funguje)** ·
**[Studio](#studio)** ·
**[Benchmarky](#benchmarky)** ·
**[Dokumentace](#dokumentace)** ·
**[Přispívání](#přispívání)**

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="Úkol ('Oprav Zid OAuth callback') vstupuje do KawnGraphu, který vrací Kontextový balíček v rámci tokenového rozpočtu: soubory ke čtení, související dokumentaci, tabulky, testy, rizika, seznam vyloučených položek a skóre spolehlivosti." width="860">
</div>

---

## Proč KawnGraph?

Když dáte kódovacímu agentovi úkol, obvykle začne *čtením* — a to hodně. Otevře
desítky souborů, znovu si odvodí, jak se routy dostávají k databázi, a při každém
požadavku znovu sestavuje stejný mentální model. To je pomalé, drahé na tokeny a
často nepřesné: agent přehlédne ten jeden soubor, na kterém záleží, a topí se v
pěti, na kterých nezáleží.

KawnGraph naskenuje úložiště **jednou**, sestaví vrstvený graf vztahů podložený
důkazy a poté pro konkrétní úkol odpoví **těmi několika soubory, na kterých
záleží** — plus relevantní dokumentací, souvisejícími databázovými tabulkami,
testy ke spuštění a riziky, na která je třeba dávat pozor. Tento svazek je
**Kontextový balíček (Context Pack)**. Graf je podklad; Kontextový balíček je
produkt.

> **Dejte agentům mapu, ne celé úložiště.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Rychlý start

Nainstalujte a spusťte KawnGraph **jediným příkazem** — `npx` jej stáhne, nic se
neklonuje (Node ≥ 18):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

**Nebo ze zdrojového kódu** (toto monorepo, pro přispěvatele — [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

Poté otevřete svého agenta a stačí popsat svůj úkol — sám si vytáhne těch několik
souborů, na kterých záleží. Žádné API klíče, žádná telemetrie, žádné síťové
volání během skenování ani načítání. Jste tu nově? Začněte s
**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Připojte ho ke svému kódovacímu agentovi

Smysl KawnGraphu spočívá v tom, že agent sáhne po mapě **automaticky**. Jediný
příkaz propojí projekt s agenty, které používáte — bez úprav `CLAUDE.md`
nebo `AGENTS.md`, přičemž každá změna je vratná:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` detekuje vaše kódovací agenty — **Claude Code**, **Codex**, **Cursor**,
**Copilot**, **Gemini CLI** a **Aider** (plus generický export Markdown/JSON a
volitelné **lokální LLM**) — a nainstaluje **read-only integraci** omezenou na
projekt (`.mcp.json`, `.cursor/mcp.json`, `.codex/config.toml`,
`.vscode/mcp.json`, `.gemini/settings.json` nebo kontextový soubor Aideru),
zálohuje vše, čeho se dotkne, a ověří každý server MCP živým handshakem. Úplná
smlouva: **[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**Server MCP** je read-only stdio JSON-RPC smyčka **bez MCP SDK** (ručně psaná) a se čtyřmi nástroji:

| Nástroj | Co dělá |
| ---- | ------------ |
| `kawn_context` | Kontextový balíček pro úkol v rámci tokenového rozpočtu. |
| `kawn_query` | Seřazené vyhledávání v grafu omezené režimem. |
| `kawn_affected` | Zpětný dopad: co závisí na daném symbolu. |
| `kawn_changes` | Dopad aktuální sady změn (necommitnuté, nebo větev vůči základní referenci). Pouze lokální git. |

Graf **pouze čte** — nikdy ho neskenuje, nepřestavuje ani do něj nezapisuje
(varuje, když graf vypadá zastarale, a odkáže na `kawn update`).

---

## Jak to funguje

Projekt není jen kód. Je to kód **a** dokumentace **a** SQL **a** testy **a**
konfigurace, která to vše spojuje dohromady. KawnGraph modeluje každou z těchto
částí jako samostatnou **vrstvu**, takže dotaz si vyžádá přesně to, co potřebuje,
a nic, co nepotřebuje — dotaz na dopad v kódu nikdy nepřitáhne marketingovou
dokumentaci; dotaz na dokumentaci nikdy nevrátí surové grafy volání, pokud o ně
nepožádáte.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph čte vaše úložiště deterministickými skenery do jednoho vrstveného grafu v .kawn/graph.json (vrstvy code, data, config, docs, test), který je read-only obsluhován pro CLI kawn, server MCP a Studio. Žádná síť, žádné LLM, žádná telemetrie." width="860">
</div>

| Vrstva    | Příklady                                            |
| -------- | --------------------------------------------------- |
| `code`   | soubory, funkce, třídy, importy, volání, routy   |
| `data`   | tabulky SQL, migrace, cizí klíče                |
| `config` | balíčky workspace, závislosti                    |
| `docs`   | sekce markdownu, odkazy, zmínky                  |
| `test`   | testy a to, co pokrývají                           |

Každá hrana nese **důkaz** (cesta ke zdroji, rozsah řádků, úryvek) a úroveň
spolehlivosti — mechanicky odvozenou tam, kde ji skener dokáže připojit; každý
uzel má **stabilní, obsahově adresovatelné ID**, takže graf zůstává napříč
skenováními porovnatelný. Hlubší model:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Kontextový balíček, od začátku do konce

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

Stejný balíček je k dispozici jako Markdown, JSON nebo agentově neutrální
**Universal Context Protocol** (`--format ucp` / `ucp-md`). Více:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` otevře **KawnGraph Studio** — lokální, **read-only** prohlížeč
obsluhovaný přes `127.0.0.1`, který čte existující `.kawn/graph.json` a nikdy
neskenuje, nepřestavuje ani nezapisuje. Nabízí interaktivní 2D graf,
škálovatelnou 3D hvězdnou mapu „Universe“ (s rozpočtem, aby nikdy nevykreslila
celý velký graf najednou), nástroj pro tvorbu Kontextových balíčků, zpětný
dopad, pohledy na změny v Gitu a pohled na behaviorální benchmark. Vytvořeno v
angličtině a arabštině (s podporou RTL). Spustíte ho ze zdrojového kódu pomocí
`pnpm studio:build && pnpm kawn map`.

<div align="center">
<img src="../assets/studio-universe.webp" alt="KawnGraph Studio — read-only 3D pohled „Universe“ na vlastní graf tohoto úložiště: 1 261 uzlů seskupených podle vrstvy (Code 815, Docs 430, Config 13, Data 3) s propojovacími čarami, plus filtry podle vrstvy/typu/hrany." width="860">
<br><sub>3D pohled <b>Universe</b> — vlastní graf tohoto úložiště (1 261 uzlů), read-only.</sub>
</div>

<div align="center">
<img src="../assets/studio-map.webp" alt="KawnGraph Studio — 2D grafový pohled na přibalený ukázkový projekt: soubory, funkce, routy, tabulky a dokumentace jako uzly s označenými hranami podloženými důkazy (importy, volání, definice, zmínky, vysvětlení), plus filtry podle vrstvy/typu/hrany." width="860">
<br><sub>2D <b>grafový</b> pohled — přibalený ukázkový projekt, s filtry podle vrstvy / typu / hrany.</sub>
</div>

---

## KawnGraph vs. obyčejné vyhledávání v úložišti

Neutrální srovnání *přístupů* (nikoli útok na konkurenci). Každá buňka je
obhajitelná; „varies“ znamená, že to závisí na konkrétním nástroji.

| Schopnost | Obyčejné vyhledávání | Obecné RAG | Obecný prohlížeč grafů | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministický lokální sken | ✅ | varies | ✅ | ✅ |
| Vztahy na úrovni symbolů | ❌ | varies | ✅ | ✅ |
| Vrstvy docs / data / test | ❌ | varies | varies | ✅ |
| Důkaz na každé hraně | ❌ | ❌ | varies | ✅ |
| Ohraničená analýza dopadu | ❌ | ❌ | varies | ✅ |
| Kontext změn v Gitu | varies | ❌ | ❌ | ✅ |
| Kontextové balíčky v tokenovém rozpočtu | ❌ | varies | ❌ | ✅ |
| Read-only načítání přes MCP | ❌ | varies | varies | ✅ |
| Není potřeba žádné interní LLM | ✅ | ❌ | ✅ | ✅ |

Datované, ozdrojované, třísloupcové srovnání oproti vyzrálému grafovému nástroji
(schopnosti, ve kterých KawnGraph vede, **i** schopnosti, ve kterých nevede)
najdete v **[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmarky

KawnGraph přináší **lokální A/B harness**, který spustí *stejného* agenta na
*stejném* úkolu **s KawnGraphem i bez něj** a zaznamená chování. Výsledky jsou
poctivé a **závislé na úkolu** — včetně neutrálních a negativních případů.

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

Metodika, prostředí, velikosti vzorků, tabulky podle jednotlivých metrik a
omezení: **[docs/BENCHMARKS.md](../BENCHMARKS.md)** — generováno z commitnutého,
validovaného artefaktu v [`benchmarks/published/`](../../benchmarks/published/).

---

## Podporované skenery a vrstvy

Každý jazyk/formát je verzovaný **plugin skeneru** za jedním registrem
(detekce → sken → finalizace): deterministické pořadí, izolace selhání po
jednotlivých souborech, explicitní registrace a omezené velikosti souborů.

| Jazyk / formát | Co se extrahuje |
| ----------------- | --------- |
| TypeScript / JS   | soubory, funkce/třídy nejvyšší úrovně, importy, volání, routy Next.js, testy |
| Python            | `def`/`async def`/`class` nejvyšší úrovně, dekorátory, metody (jako metadata), importy, routy FastAPI/Flask, docstringy, testy (přes `@lezer/python` — čisté JS, odolné vůči chybám) |
| SQL               | tabulky (`CREATE`/`ALTER`), vztahy přes cizí klíče |
| package.json      | balíčky workspace a interní závislosti |
| Markdown          | nadpisy/sekce propojené s kódem, SQL a routami |

Dvě záměrná vynechání v obou skenerech kódu: metody/vnořené funkce nikdy nejsou
samostatné uzly (metoda jede na své třídě jako metadata) a soubory s deklaracemi
prostředí (`.d.ts`, `.pyi`) nikdy nejsou nárokovány. Podrobnosti:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Soukromí a bezpečnost

- **Žádná síť ve výchozím nastavení.** Skenování a načítání čtou vaše úložiště a
  zapisují JSON do `.kawn/`. Nic neopouští stroj.
- **Žádné interní LLM.** Kód, dokumentace a SQL se parsují strukturálně;
  obohacení pomocí AI je dobrovolné (opt-in) a local-first.
- **Žádná telemetrie. Žádné logování dotazů ve výchozím nastavení.**
- **Read-only MCP.** Server obsluhuje graf; nikdy ho neskenuje, nepřestavuje ani
  do něj nezapisuje — a odmítne obsloužit graf, jehož schématu nemůže důvěřovat.
- **Vratné integrace omezené na projekt.** Atomické zápisy, časově označené
  zálohy, strukturované (nikoli textové) úpravy konfigurace; nikdy neupravuje
  `CLAUDE.md` / `AGENTS.md`, ve výchozím nastavení se nikdy nedotýká globální
  konfigurace.

Úplný model: **[docs/PRIVACY.md](../PRIVACY.md)**. Zranitelnost nahlaste
soukromě prostřednictvím **[SECURITY.md](../../SECURITY.md)**.

---

## Stav a omezení

KawnGraph je v **aktivním vývoji** (`v0.1.0`, ještě nepublikováno na npm).
Sestaveno a otestováno od začátku do konce: graf code/data/config/docs/test,
propojení dokumentace s kódem, dotaz omezený režimem, analýza dopadu, dopad
Gitu/PR, Kontextové balíčky v tokenovém rozpočtu, Universal Context Protocol,
read-only server MCP, nastavení agentů na jeden příkaz (Claude Code, Codex,
Cursor, Copilot, Gemini, Aider, generický export, lokální LLM), Studio a A/B
benchmark harness.

**Poctivá omezení.** Publikovaný benchmark je **exploratorní (n<5 na rameno —
směrový, nikoli významný)**. KawnGraph pomáhá nejvíce při objevování neznámého
kódu napříč více soubory a může přidat režii u již zaměřených úkolů s jedním
souborem. Zatím nevytvořeno: dobrovolné (opt-in) háčky pouze s návrhy, vizuální
vrstva, sémantické/AI obohacení a runtime vrstva — vše navrženo jako opt-in. Viz
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Dokumentace

| Průvodce | Co je uvnitř |
| ----- | ------------- |
| [Začínáme](../GETTING_STARTED.md) | Instalace, skenování, první Kontextový balíček |
| [Integrace agentů](../AGENT_INTEGRATION.md) | Smlouva nastavení MCP, vratnost |
| [Kontextové balíčky](../CONTEXT_PACKS.md) | Řazení, rozpočty, drátový formát UCP |
| [Model grafu](../GRAPH_MODEL.md) | Uzly, hrany, vrstvy, důkazy, ID |
| [Skenery](../SCANNERS.md) | Co každý jazykový plugin extrahuje |
| [Benchmarky](../BENCHMARKS.md) | Metodika, prostředí, kompletní výsledky |
| [Srovnání](../COMPARISON.md) | Datované, ozdrojované srovnání schopností |
| [Soukromí](../PRIVACY.md) | Datové hranice podle vrstvy |
| [Řešení potíží](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Časté problémy a otázky |

---

## Přispívání

Příspěvky jsou vítány. Sestavte ze zdrojového kódu, spusťte sadu testů a přečtěte si průvodce:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Viz **[CONTRIBUTING.md](../../CONTRIBUTING.md)** pro nastavení, konvence a
kontrolu soukromí, kterou prochází každý PR; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)**
pro očekávání od komunity; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**
pro přidání nebo kontrolu jazyka; a **[SUPPORT.md](../../SUPPORT.md)** pro to,
kde klást otázky.

---

## Licence a poděkování

**[MIT](../../LICENSE)** © přispěvatelé KawnGraph.

Vytvořeno a spravováno **[Abdulrahmanem Alnashrim](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)**.

**Kawn** (arabsky **كَوْن** — *kosmos, vesmír, existence*) chápe úložiště jako
živý vesmír znalostí; **Graph** je Agent Context Graph podložený důkazy v jeho
jádru. Vytvořeno pomocí [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/) a
[`@lezer/python`](https://lezer.codemirror.net/).
