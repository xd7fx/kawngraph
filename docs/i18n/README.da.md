<!-- KAWN-TRANSLATION
lang: da
status: machine-assisted
canonical: README.md
canonical-sha: 9ae23d43afac34187e2ed17d64244ea5b65352f88f470cbc2818ff41eb15e312
-->

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../brand/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../../brand/logo-light.svg">
  <img src="../../brand/logo.svg" alt="KawnGraph" width="320">
</picture>

### Kontekst-universet for agenter

**Ét projekt-univers. Enhver kodningsagent.**

KawnGraph kortlægger kode, dokumentation, data, tests og Git-ændringer i
evidensunderbyggede **Context Packs**, så Claude, Codex og Cursor kan nå de
rigtige filer uden at læse hele repositoryet.

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
[Čeština](README.cs.md) ·
[Suomi](README.fi.md) ·
**Dansk** ·
[Norsk](README.no.md) ·
[Magyar](README.hu.md) ·
[עברית](README.he.md)

<sub>English is canonical · العربية is AI-assisted · owner review pending · the other 29 languages are machine-assisted (human review needed) — see [translation status](STATUS.md).</sub>

<!-- LANGBAR:END -->

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA.svg?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/xd7fx)

</div>

> **Bemærk:** Denne oversættelse er maskinassisteret og kan indeholde fejl. Den
> autoritative kilde er den engelske original [README.md](../../README.md).
> Oversættelsesstatus findes i [STATUS.md](STATUS.md).

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="En opgave ('Ret Zid OAuth-callbacket') flyder ind i KawnGraph, som returnerer en token-budgetteret Context Pack: vigtigste filer, relaterede dokumenter, tabeller, tests, risici, en ekskluderet liste og en konfidensscore." width="860">
</div>

---

## Hvorfor KawnGraph?

Når du giver en kodningsagent en opgave, begynder den som regel med at *læse* —
en hel del. Den åbner snesevis af filer, udleder igen, hvordan ruter når
databasen, og genopbygger den samme mentale model ved hver forespørgsel. Det er
langsomt, token-dyrt og ofte unøjagtigt: agenten overser den ene fil, der
betyder noget, og drukner i fem, der ikke gør.

KawnGraph scanner repositoryet **én gang**, bygger en lagdelt,
evidensunderbygget graf over, hvordan tingene hænger sammen, og svarer derefter,
for en konkret opgave, med de **få filer, der betyder noget** — plus de
relevante dokumenter, de relaterede databasetabeller, de tests, der skal køres,
og de risici, der skal holdes øje med. Det bundt er en **Context Pack**. Grafen
er substratet; Context Packen er produktet.

> **Giv agenterne kortet, ikke hele repoet.**

---

## Hurtig start

> **OBS:** npm-pakken `kawngraph` er **endnu ikke udgivet**, så
> `npx kawngraph …` er *ikke* tilgængelig i dag. Brug stien fra kildekoden
> nedenfor; `npx`-flowet vises for **efter udgivelsen**.

**I dag — fra kildekode** (dette monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Efter npm-udgivelsen** (den tilsigtede oplevelse med én kommando):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Åbn derefter din agent og beskriv blot din opgave — den henter på egen hånd de
få filer, der betyder noget. Ingen API-nøgler, ingen telemetri, ingen
netværkskald under scan eller hentning. Ny her? Begynd med
**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Forbind den til din kodningsagent

Pointen med KawnGraph er, at agenten griber efter kortet **automatisk**. Én
kommando forbinder et projekt med de agenter, du bruger — uden at redigere
`CLAUDE.md` eller `AGENTS.md`, og hver ændring kan tilbageføres:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` registrerer dine kodningsagenter — **Claude Code**, **Codex**,
**Cursor**, **Copilot**, **Gemini CLI** og **Aider** (plus en `generic`
Markdown/JSON-eksport og en valgfri **lokal LLM**) — og installerer en
**skrivebeskyttet integration**, der er afgrænset til projektet
(`.mcp.json`, `.cursor/mcp.json`, `.codex/config.toml`, `.vscode/mcp.json`,
`.gemini/settings.json` eller en Aider-kontekstfil), tager backup af alt, den
rører ved, og verificerer hver MCP-server med et live-handshake. Fuld kontrakt:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**MCP-serveren** er en skrivebeskyttet stdio JSON-RPC-løkke **uden MCP SDK**
(håndbygget) og med fire værktøjer:

| Værktøj | Hvad det gør |
| ---- | ------------ |
| `kawn_context` | Token-budgetteret Context Pack for en opgave. |
| `kawn_query` | Rangeret, mode-afgrænset søgning over grafen. |
| `kawn_affected` | Omvendt påvirkning: hvad der afhænger af et symbol. |
| `kawn_changes` | Påvirkning af det aktuelle ændringssæt (ikke-committet eller en branch mod en base-ref). Kun lokal git. |

Den **læser kun** grafen — den scanner, genopbygger eller skriver den aldrig (den
advarer, når grafen ser forældet ud, og henviser til `kawn update`).

---

## Sådan virker det

Et projekt er ikke bare kode. Det er kode **og** dokumentation **og** SQL **og**
tests **og** den konfiguration, der binder dem sammen. KawnGraph modellerer hver
af dem som et særskilt **lag**, så en forespørgsel beder om præcis det, den har
brug for, og intet, den ikke har brug for — en kode-påvirkningsforespørgsel
trækker aldrig marketingdokumenter ind; en dokumentationsforespørgsel returnerer
aldrig rå kaldgrafer, medmindre du beder om det.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph læser dit repo med deterministiske scannere ind i én lagdelt graf i .kawn/graph.json (lagene code, data, config, docs, test) og leverer den skrivebeskyttet til kawn-CLI'en, MCP-serveren og Studio. Intet netværk, ingen LLM, ingen telemetri." width="860">
</div>

| Lag      | Eksempler                                           |
| -------- | --------------------------------------------------- |
| `code`   | files, functions, classes, imports, calls, routes   |
| `data`   | SQL tables, migrations, foreign keys                |
| `config` | workspace packages, dependencies                    |
| `docs`   | markdown sections, links, mentions                  |
| `test`   | tests and what they cover                           |

Kanter bærer **evidens** (kildesti, linjeinterval, uddrag) og et
konfidensniveau — mekanisk udledt, hvor scanneren kan vedhæfte det; hver knude har
et **stabilt, indholdsadresserbart ID**, så grafen forbliver diff-bar på tværs af
scans. Dybere model:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### En Context Pack, fra start til slut

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

Den samme pack er tilgængelig som Markdown, JSON eller den agent-neutrale
**Universal Context Protocol** (`--format ucp` / `ucp-md`). Mere:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## KawnGraph Studio

`kawn map` åbner **KawnGraph Studio** — en lokal, **skrivebeskyttet** explorer,
der leveres over `127.0.0.1`, læser den eksisterende `.kawn/graph.json` og aldrig
scanner, genopbygger eller skriver. Den tilbyder en interaktiv 2D-graf, et
skalerbart 3D-"Universe"-stjernekort (budgetteret, så det aldrig tegner en hel
stor graf på én gang), en Context-Pack-builder, omvendt påvirkning, visninger af
Git-ændringer og en visning af adfærdsbenchmarks. Bygget på engelsk og arabisk
(RTL-bevidst). Kør den fra kildekode med `pnpm studio:build &&
pnpm kawn map`.

<div align="center">
<img src="../assets/studio-universe.webp" alt="KawnGraph Studio — den skrivebeskyttede 3D-'Universe'-visning af dette repositorys egen graf: 1.261 knuder samlet i klynger efter lag (Code 815, Docs 430, Config 13, Data 3) med forbindelseslinjer, plus filtre pr. lag/type/kant." width="860">
<br><sub>3D-<b>Universe</b>-visningen — dette repositorys egen graf (1.261 knuder), skrivebeskyttet.</sub>
</div>

<div align="center">
<img src="../assets/studio-map.webp" alt="KawnGraph Studio — 2D-grafvisningen af det medfølgende eksempelprojekt: filer, funktioner, ruter, tabeller og dokumenter som knuder med mærkede, evidensunderbyggede kanter (imports, calls, defines, mentions, explains), plus filtre pr. lag/type/kant." width="860">
<br><sub>2D-<b>graf</b>-visningen — det medfølgende eksempelprojekt, med filtre pr. lag / type / kant.</sub>
</div>

---

## KawnGraph vs. almindelig repository-søgning

En neutral sammenligning af *tilgange* (ikke et angreb på konkurrenter). Hver
celle kan forsvares; "varies" betyder, at det afhænger af det konkrete værktøj.

| Kapabilitet | Plain search | General RAG | Generic graph viewer | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministisk lokal scan | ✅ | varies | ✅ | ✅ |
| Relationer på symbolniveau | ❌ | varies | ✅ | ✅ |
| Lag for docs / data / tests | ❌ | varies | varies | ✅ |
| Evidens på hver kant | ❌ | ❌ | varies | ✅ |
| Afgrænset påvirkningsanalyse | ❌ | ❌ | varies | ✅ |
| Kontekst fra Git-ændringer | varies | ❌ | ❌ | ✅ |
| Token-budgetterede Context Packs | ❌ | varies | ❌ | ✅ |
| Skrivebeskyttet MCP-hentning | ❌ | varies | varies | ✅ |
| Ingen intern LLM påkrævet | ✅ | ❌ | ✅ | ✅ |

En dateret, kildebelagt sammenligning i tre kolonner mod et modent grafværktøj
(kapabiliteter, hvor KawnGraph fører, **og** kapabiliteter, hvor det ikke gør)
findes i **[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Ydelsesmålinger

KawnGraph leveres med et **lokalt A/B-harness**, der kører *den samme* agent på
*den samme* opgave **med vs. uden** KawnGraph og registrerer adfærden.
Resultaterne er ærlige og **opgaveafhængige** — inklusive neutrale og negative
tilfælde.

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

Metode, miljø, stikprøvestørrelser, tabellerne pr. metrik og begrænsningerne:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — genereret fra det committede,
validerede artefakt i [`benchmarks/published/`](../../benchmarks/published/).

---

## Understøttede scannere og lag

Hvert sprog/format er et versioneret **scanner-plugin** bag ét register
(detect → scan → finalize): deterministisk rækkefølge, fejlisolering pr. fil,
eksplicit registrering og afgrænsede filstørrelser.

| Sprog / format | Udtrukket |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

To bevidste udeladelser i begge kode-scannere: metoder/indlejrede funktioner er
aldrig separate knuder (en metode følger med på sin klasse som metadata), og
ambient-deklarationsfiler (`.d.ts`, `.pyi`) gøres aldrig krav på. Detaljer:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Privatliv og sikkerhed

- **Intet netværk som standard.** Scan og hentning læser dit repo og skriver
  JSON under `.kawn/`. Intet forlader maskinen.
- **Ingen intern LLM.** Kode, dokumentation og SQL parses strukturelt;
  AI-berigelse er opt-in og local-first.
- **Ingen telemetri. Ingen logning af forespørgsler som standard.**
- **Skrivebeskyttet MCP.** Serveren leverer grafen; den scanner, genopbygger
  eller skriver den aldrig — og nægter at levere en graf, hvis skema den ikke kan
  stole på.
- **Tilbageførbare, projektafgrænsede integrationer.** Atomiske skrivninger,
  tidsstemplede backups, strukturerede (ikke streng-baserede)
  konfigurationsændringer; redigerer aldrig `CLAUDE.md` / `AGENTS.md`, rører
  aldrig global konfiguration som standard.

Fuld model: **[docs/PRIVACY.md](../PRIVACY.md)**. Rapportér en sårbarhed
fortroligt via **[SECURITY.md](../../SECURITY.md)**.

---

## Status og begrænsninger

KawnGraph er under **aktiv udvikling** (`v0.1.0`, endnu ikke udgivet til npm).
Bygget og testet end-to-end: grafen for code/data/config/docs/test,
docs-til-code-links, mode-afgrænset forespørgsel, påvirkningsanalyse,
Git-/PR-påvirkning, token-budgetterede Context Packs, Universal Context Protocol,
den skrivebeskyttede MCP-server, agent-opsætning med én kommando
(Claude Code, Codex, Cursor, Copilot, Gemini, Aider, generisk eksport, lokal
LLM), Studio og A/B-benchmark-harnesset.

**Ærlige grænser.** Den udgivne benchmark er **eksplorativ (n<5 pr. arm —
retningsgivende, ikke signifikant)**. KawnGraph hjælper mest ved ukendt
opdagelse på tværs af flere filer og kan tilføje overhead ved allerede
fokuserede enkeltfil-opgaver. Endnu ikke bygget: opt-in suggest-only-hooks, det
visuelle lag, semantisk/AI-berigelse og et runtime-lag — alt sammen opt-in efter
design. Se [PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Dokumentation

| Vejledning | Hvad der er indeni |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | Installer, scan, første Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | MCP-opsætningskontrakt, tilbageførbarhed |
| [Context Packs](../CONTEXT_PACKS.md) | Ranking, budgetter, UCP-wire-format |
| [Graph model](../GRAPH_MODEL.md) | Knuder, kanter, lag, evidens, ID'er |
| [Scanners](../SCANNERS.md) | Hvad hvert sprog-plugin udtrækker |
| [Benchmarks](../BENCHMARKS.md) | Metode, miljø, fulde resultater |
| [Comparison](../COMPARISON.md) | Dateret, kildebelagt kapabilitetssammenligning |
| [Privacy](../PRIVACY.md) | Datagrænser pr. lag |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Almindelige problemer og spørgsmål |

---

## Bidrag

Bidrag er velkomne. Byg fra kildekode, kør testsuiten, og læs vejledningen:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Se **[CONTRIBUTING.md](../../CONTRIBUTING.md)** for opsætning, konventioner og
det privatlivsreview, som hver PR gennemgår; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)**
for forventninger til fællesskabet; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**
for at tilføje eller gennemgå et sprog; og **[SUPPORT.md](../../SUPPORT.md)** for,
hvor man kan stille spørgsmål.

---

## Licens og anerkendelser

**[MIT](../../LICENSE)** © KawnGraph-bidragydere.

Skabt og vedligeholdt af **[Abdulrahman Alnashri](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)**.

**Kawn** (arabisk **كَوْن** — *kosmos, univers, eksistens*) behandler et
repository som et levende vidensunivers; **Graph** er den evidensunderbyggede
Agent Context Graph i dets kerne. Bygget med
[TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/),
[React](https://react.dev/), [React Flow](https://reactflow.dev/),
[Three.js](https://threejs.org/), og
[`@lezer/python`](https://lezer.codemirror.net/).
