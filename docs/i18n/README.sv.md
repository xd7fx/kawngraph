<!-- KAWN-TRANSLATION
lang: sv
status: machine-assisted
canonical: README.md
canonical-sha: 0bb15f5b2c5f88091d6bab4790ba6fb35c715b08dae4fceb9b54f7e15626992e
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### Agentens kontextuniversum

**Ett projektuniversum. Varje kodningsagent.**

[English](../../README.md) · [العربية](../../README.ar.md) · [Svenska] (nuvarande) · [översättningsstatus](STATUS.md)

</div>

> Den här översättningen är maskinassisterad och kan innehålla fel. Den kanoniska engelska versionen är [README.md](../../README.md). Se [STATUS.md](STATUS.md) för översättningsstatus.

---

KawnGraph kartlägger kod, dokumentation, data, tester och Git-ändringar till
bevisbaserade **Context Packs** så att Claude, Codex och Cursor kan nå rätt
filer utan att läsa hela kodförrådet.

---

## Varför KawnGraph?

När du ger en kodningsagent en uppgift börjar den oftast med att *läsa* — mycket.
Den öppnar dussintals filer, härleder på nytt hur rutter når databasen och bygger
om samma mentala modell vid varje förfrågan. Det är långsamt, token-dyrt och ofta
felaktigt: agenten missar den enda fil som spelar roll och drunknar i fem som
inte gör det.

KawnGraph skannar kodförrådet **en gång**, bygger en skiktad, bevisbaserad graf
över hur saker hänger samman och svarar sedan, för en specifik uppgift, med de
**få filer som spelar roll** — plus den relevanta dokumentationen, de relaterade
databastabellerna, testerna att köra och riskerna att hålla koll på. Det paketet
är ett **Context Pack**. Grafen är substratet; Context Pack är produkten.

> **Ge agenterna kartan, inte hela förrådet.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Snabbstart

> **Obs:** npm-paketet `kawngraph` är **inte publicerat ännu**, så
> `npx kawngraph …` är *inte* tillgängligt idag. Använd vägen från källkod nedan;
> `npx`-flödet visas för **efter publicering**.

**Idag — från källkod** (det här monorepot, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Efter npm-publicering** (den avsedda upplevelsen med ett enda kommando):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Öppna sedan din agent och beskriv bara din uppgift — den hämtar på egen hand de
få filer som spelar roll. Inga API-nycklar, ingen telemetri, inga nätverksanrop
under skanning eller hämtning. Ny här? Börja med
**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Anslut den till din kodningsagent

Poängen med KawnGraph är att agenten griper efter kartan **automatiskt**. Ett
kommando kopplar ett projekt till de agenter du använder — utan att redigera
`CLAUDE.md` eller `AGENTS.md`, och varje ändring går att återställa:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` upptäcker **Claude Code**, **Codex** och **Cursor** och installerar en
**skrivskyddad MCP-integration** avgränsad till projektet (`.mcp.json`,
`.cursor/mcp.json` eller `.codex/config.toml`), säkerhetskopierar allt den rör
och verifierar servern med en live-handskakning. Fullständigt kontrakt:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**MCP-servern** är skrivskyddad stdio JSON-RPC utan beroenden och med fyra verktyg:

| Verktyg | Vad det gör |
| ---- | ------------ |
| `kawn_context` | Token-budgeterat Context Pack för en uppgift. |
| `kawn_query` | Rankad, lägesavgränsad sökning över grafen. |
| `kawn_affected` | Omvänd påverkan: vad som beror på en symbol. |
| `kawn_changes` | Påverkan av den aktuella ändringsuppsättningen (ej incheckad, eller en gren mot en basreferens). Endast lokal git. |

Den **läser endast** grafen — den skannar, bygger om eller skriver den aldrig
(den varnar när grafen ser inaktuell ut och pekar på `kawn update`).

---

## Så fungerar det

Ett projekt är inte bara kod. Det är kod **och** dokumentation **och** SQL
**och** tester **och** den konfiguration som binder samman dem. KawnGraph
modellerar var och en som ett distinkt **skikt**, så att en fråga begär exakt
vad den behöver och inget den inte behöver — en kodpåverkansfråga drar aldrig in
marknadsföringsdokument; en dokumentationsfråga returnerar aldrig råa
anropsgrafer om du inte ber om det.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph läser ditt kodförråd med deterministiska skannrar till en skiktad graf i .kawn/graph.json (skikten kod, data, config, dokumentation, test), serverad skrivskyddat till kawn-CLI:t, MCP-servern och Studio. Inget nätverk, ingen LLM, ingen telemetri." width="860">
</div>

| Skikt    | Exempel                                             |
| -------- | --------------------------------------------------- |
| `code`   | filer, funktioner, klasser, imports, anrop, rutter  |
| `data`   | SQL-tabeller, migreringar, främmande nycklar        |
| `config` | workspace-paket, beroenden                          |
| `docs`   | markdown-sektioner, länkar, omnämnanden             |
| `test`   | tester och vad de täcker                            |

Varje kant bär **bevis** (källsökväg, radintervall, kodsnutt) och en
konfidensnivå; varje nod har ett **stabilt, innehållsadresserbart ID** så att
grafen förblir diffbar mellan skanningar. Djupare modell:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Ett Context Pack, från början till slut

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

Samma pack finns tillgängligt som Markdown, JSON eller det agentneutrala
**Universal Context Protocol** (`--format ucp` / `ucp-md`). Mer:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` öppnar **KawnGraph Studio** — en lokal, **skrivskyddad** utforskare
serverad över `127.0.0.1` som läser den befintliga `.kawn/graph.json` och aldrig
skannar, bygger om eller skriver. Den erbjuder en interaktiv 2D-graf, en skalbar
3D-stjärnkarta över "universum" (budgeterad så att den aldrig ritar en hel stor
graf på en gång), en Context-Pack-byggare, omvänd påverkan, vyer för Git-ändringar
och en vy för beteendebenchmark. Byggd på engelska och arabiska (RTL-medveten).
Kör den från källkod med `pnpm studio:build && pnpm kawn map`.

> En tagen Studio-skärmbild kommer att läggas till i `docs/assets/` efter nästa
> visuella infångningsomgång; tills dess är diagrammen ovan de kanoniska bilderna.

---

## KawnGraph jämfört med vanlig kodförrådssökning

En neutral jämförelse av *tillvägagångssätt* (inte en attack mot konkurrenter).
Varje cell är försvarbar; "varierar" betyder att det beror på det specifika
verktyget.

| Förmåga | Vanlig sökning | Generisk RAG | Generisk grafvisare | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministisk lokal skanning | ✅ | varierar | ✅ | ✅ |
| Relationer på symbolnivå | ❌ | varierar | ✅ | ✅ |
| Skikt för dokumentation / data / test | ❌ | varierar | varierar | ✅ |
| Bevis på varje kant | ❌ | ❌ | varierar | ✅ |
| Avgränsad påverkansanalys | ❌ | ❌ | varierar | ✅ |
| Kontext för Git-ändringar | varierar | ❌ | ❌ | ✅ |
| Token-budgeterade Context Packs | ❌ | varierar | ❌ | ✅ |
| Skrivskyddad MCP-hämtning | ❌ | varierar | varierar | ✅ |
| Ingen intern LLM krävs | ✅ | ❌ | ✅ | ✅ |

En daterad, källbelagd jämförelse i tre kolumner mot ett moget grafverktyg
(förmågor som KawnGraph leder på **och** förmågor som det inte gör) finns i
**[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmarkar

KawnGraph levereras med en **lokal A/B-rigg** som kör *samma* agent på *samma*
uppgift **med vs utan** KawnGraph och registrerar beteendet. Resultaten är
ärliga och **uppgiftsberoende** — inklusive neutrala och negativa fall.

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

Metodik, miljö, urvalsstorlekar, tabellerna per mätvärde och begränsningar:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — genererat från den incheckade,
validerade artefakten i [`benchmarks/published/`](../../benchmarks/published/).

---

## Skannrar och skikt som stöds

Varje språk/format är ett versionshanterat **skanner-plugin** bakom ett enda
register (detect → scan → finalize): deterministisk ordning, isolering av fel
per fil, explicit registrering och avgränsade filstorlekar.

| Språk / format | Extraherat |
| ----------------- | --------- |
| TypeScript / JS   | filer, toppnivåfunktioner/klasser, imports, anrop, Next.js-rutter, tester |
| Python            | toppnivå `def`/`async def`/`class`, dekoratorer, metoder (som metadata), imports, FastAPI/Flask-rutter, docstrings, tester (via `@lezer/python` — ren JS, feltolerant) |
| SQL               | tabeller (`CREATE`/`ALTER`), relationer med främmande nycklar |
| package.json      | workspace-paket och interna beroenden |
| Markdown          | rubriker/sektioner länkade till kod, SQL och rutter |

Två avsiktliga utelämnanden i båda kodskannrarna: metoder/nästlade funktioner
blir aldrig separata noder (en metod åker med på sin klass som metadata), och
ambient-deklarationsfiler (`.d.ts`, `.pyi`) görs aldrig anspråk på. Detaljer:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Integritet och säkerhet

- **Inget nätverk som standard.** Skanning och hämtning läser ditt kodförråd och
  skriver JSON under `.kawn/`. Inget lämnar maskinen.
- **Ingen intern LLM.** Kod, dokumentation och SQL parsas strukturellt;
  AI-berikning är opt-in och local-first.
- **Ingen telemetri. Ingen frågeloggning som standard.**
- **Skrivskyddad MCP.** Servern serverar grafen; den skannar, bygger om eller
  skriver den aldrig — och vägrar att servera en graf vars schema den inte kan
  lita på.
- **Återställbara, projektavgränsade integrationer.** Atomära skrivningar,
  tidsstämplade säkerhetskopior, strukturerade (inte sträng-baserade)
  konfigurationsredigeringar; redigerar aldrig `CLAUDE.md` / `AGENTS.md`, rör
  aldrig global konfiguration som standard.

Fullständig modell: **[docs/PRIVACY.md](../PRIVACY.md)**. Rapportera en sårbarhet
privat via **[SECURITY.md](../../SECURITY.md)**.

---

## Status och begränsningar

KawnGraph är under **aktiv utveckling** (`v0.1.0`, ännu inte publicerat till
npm). Byggt och testat från början till slut: grafen för
kod/data/config/dokumentation/test, dokumentation-till-kod-länkar,
lägesavgränsad fråga, påverkansanalys, Git/PR-påverkan, token-budgeterade
Context Packs, Universal Context Protocol, den skrivskyddade MCP-servern,
agentinställning med ett kommando (Claude Code / Codex / Cursor), Studio och
A/B-benchmarkriggen.

**Ärliga begränsningar.** Den publicerade benchmarken är **explorativ (n<5 per
arm — riktningsgivande, inte signifikant)**. KawnGraph hjälper mest vid
upptäckt av okända filer över flera filer och kan lägga till omkostnader på
redan fokuserade enfilsuppgifter. Inte byggt ännu: opt-in-krokar som endast
föreslår, det visuella skiktet, semantisk/AI-berikning och ett runtime-skikt —
allt opt-in enligt design. Se
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Dokumentation

| Guide | Vad som finns inuti |
| ----- | ------------- |
| [Kom igång](../GETTING_STARTED.md) | Installera, skanna, första Context Pack |
| [Agentintegration](../AGENT_INTEGRATION.md) | MCP-inställningskontrakt, återställbarhet |
| [Context Packs](../CONTEXT_PACKS.md) | Rankning, budgetar, UCP-trådformat |
| [Grafmodell](../GRAPH_MODEL.md) | Noder, kanter, skikt, bevis, ID:n |
| [Skannrar](../SCANNERS.md) | Vad varje språk-plugin extraherar |
| [Benchmarkar](../BENCHMARKS.md) | Metodik, miljö, fullständiga resultat |
| [Jämförelse](../COMPARISON.md) | Daterad, källbelagd förmågejämförelse |
| [Integritet](../PRIVACY.md) | Datagränser per skikt |
| [Felsökning](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Vanliga problem och frågor |

---

## Bidra

Bidrag välkomnas. Bygg från källkod, kör sviten och läs guiden:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Se **[CONTRIBUTING.md](../../CONTRIBUTING.md)** för uppsättning, konventioner och
den integritetsgranskning som varje PR går igenom;
**[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** för förväntningar i
gemenskapen; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)** för att lägga till
eller granska ett språk; och **[SUPPORT.md](../../SUPPORT.md)** för var du kan
ställa frågor.

---

## Licens och tack

**[MIT](../../LICENSE)** © KawnGraph-bidragsgivare.

**Kawn** (arabiska **كَوْن** — *kosmos, universum, existens*) behandlar ett
kodförråd som ett levande universum av kunskap; **Graph** är den bevisbaserade
Agent Context Graph i dess kärna. Byggt med
[TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/),
[React](https://react.dev/), [React Flow](https://reactflow.dev/),
[Three.js](https://threejs.org/) och
[`@lezer/python`](https://lezer.codemirror.net/).
