<!-- KAWN-TRANSLATION
lang: no
status: machine-assisted
canonical: README.md
canonical-sha: 0bb15f5b2c5f88091d6bab4790ba6fb35c715b08dae4fceb9b54f7e15626992e
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### Kontekstuniverset for agenter

**Ett prosjektunivers. Hver kodeagent.**

[English](../../README.md) · [العربية](../../README.ar.md) · [Norsk] (current) · [oversettelsesstatus](STATUS.md)

> Denne oversettelsen er maskinassistert og kan inneholde feil. Den kanoniske engelske versjonen er [README.md](../../README.md); se [STATUS.md](STATUS.md).

</div>

---

## Hvorfor KawnGraph?

Når du gir en kodeagent en oppgave, starter den vanligvis med å *lese* — mye. Den
åpner dusinvis av filer, utleder på nytt hvordan ruter når databasen, og bygger
opp den samme mentale modellen ved hver forespørsel. Det er tregt, dyrt i tokens
og ofte unøyaktig: agenten går glipp av den ene filen som betyr noe, og drukner i
fem som ikke gjør det.

KawnGraph skanner repoet **én gang**, bygger en lagdelt, bevisbasert graf over
hvordan ting henger sammen, og svarer så, for en bestemt oppgave, med de **få
filene som betyr noe** — pluss de relevante dokumentene, de relaterte
databasetabellene, testene som skal kjøres, og risikoene man bør følge med på. Den
pakken er en **Context Pack**. Grafen er underlaget; Context Pack-en er produktet.

> **Gi agentene kartet, ikke repoet.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Hurtigstart

> **Merk:** npm-pakken `kawngraph` er **ikke publisert ennå**, så
> `npx kawngraph …` er *ikke* tilgjengelig i dag. Bruk fra-kildekode-fremgangsmåten
> nedenfor; `npx`-flyten vises for **etter publisering**.

**I dag — fra kildekode** (dette monorepoet, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Etter npm-publisering** (den tiltenkte én-kommandos-opplevelsen):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Åpne deretter agenten din og bare beskriv oppgaven — den henter selv de få filene
som betyr noe. Ingen API-nøkler, ingen telemetri, ingen nettverkskall under skann
eller henting. Ny til dette? Begynn med
**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Koble det til kodeagenten din

Poenget med KawnGraph er at agenten griper etter kartet **automatisk**. Én kommando
kobler et prosjekt til agentene du bruker — uten å redigere `CLAUDE.md` eller
`AGENTS.md`, og hver endring er reverserbar:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` oppdager **Claude Code**, **Codex** og **Cursor** og installerer en
**skrivebeskyttet MCP-integrasjon** avgrenset til prosjektet (`.mcp.json`,
`.cursor/mcp.json` eller `.codex/config.toml`), tar sikkerhetskopi av alt den rører
ved og verifiserer serveren med et live håndtrykk. Full kontrakt:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**MCP-serveren** er skrivebeskyttet stdio JSON-RPC uten avhengigheter og med fire verktøy:

| Verktøy | Hva det gjør |
| ---- | ------------ |
| `kawn_context` | Token-budsjettert Context Pack for en oppgave. |
| `kawn_query` | Rangert, modus-avgrenset søk over grafen. |
| `kawn_affected` | Omvendt påvirkning: hva som avhenger av et symbol. |
| `kawn_changes` | Påvirkning fra det gjeldende endringssettet (ucommittet, eller en gren mot en base-ref). Kun lokal git. |

Den **leser kun** grafen — den skanner, gjenoppbygger eller skriver den aldri (den
advarer når grafen ser foreldet ut og peker til `kawn update`).

---

## Hvordan det fungerer

Et prosjekt er ikke bare kode. Det er kode **og** dokumenter **og** SQL **og**
tester **og** konfigurasjonen som binder dem sammen. KawnGraph modellerer hver av
disse som et eget **lag**, slik at en forespørsel ber om nøyaktig det den trenger og
ingenting den ikke trenger — en kodepåvirkningsforespørsel drar aldri inn
markedsføringsdokumenter; en dokumentforespørsel returnerer aldri rå anropsgrafer
med mindre du ber om det.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph leser repoet ditt med deterministiske skannere inn i én lagdelt graf i .kawn/graph.json (kode-, data-, config-, dokument- og testlag), servert skrivebeskyttet til kawn-CLI-en, MCP-serveren og Studio. Ingen nettverk, ingen LLM, ingen telemetri." width="860">
</div>

| Lag    | Eksempler                                            |
| -------- | --------------------------------------------------- |
| `code`   | filer, funksjoner, klasser, importer, anrop, ruter   |
| `data`   | SQL-tabeller, migrasjoner, fremmednøkler                |
| `config` | workspace-pakker, avhengigheter                    |
| `docs`   | markdown-seksjoner, lenker, omtaler                  |
| `test`   | tester og hva de dekker                           |

Hver kant bærer **bevis** (kildesti, linjeområde, utdrag) og et konfidensnivå; hver
node har en **stabil, innholdsadresserbar ID** slik at grafen forblir diffbar på
tvers av skann. Dypere modell:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### A Context Pack, end to end

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

Den samme pakken er tilgjengelig som Markdown, JSON, eller den agent-nøytrale
**Universal Context Protocol** (`--format ucp` / `ucp-md`). Mer:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` åpner **KawnGraph Studio** — en lokal, **skrivebeskyttet** utforsker
servert over `127.0.0.1` som leser den eksisterende `.kawn/graph.json` og aldri
skanner, gjenoppbygger eller skriver. Den tilbyr en interaktiv 2D-graf, et skalerbart
3D-"Univers"-stjernekart (budsjettert slik at det aldri tegner en hel stor graf på én
gang), en Context-Pack-bygger, omvendt påvirkning, visninger av Git-endringer og en
visning for atferdsbenchmark. Bygget på engelsk og arabisk (RTL-bevisst). Kjør det fra
kildekode med `pnpm studio:build && pnpm kawn map`.

> Et fanget Studio-skjermbilde vil bli lagt til i `docs/assets/` etter neste
> visuelle fangst-runde; inntil da er diagrammene over de kanoniske visuellene.

---

## KawnGraph vs. vanlig repo-søk

En nøytral sammenligning av *tilnærminger* (ikke et angrep på konkurrenter). Hver
celle er forsvarbar; "varierer" betyr at det avhenger av det spesifikke verktøyet.

| Egenskap | Vanlig søk | Generell RAG | Generisk grafviser | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministisk lokal skann | ✅ | varierer | ✅ | ✅ |
| Relasjoner på symbolnivå | ❌ | varierer | ✅ | ✅ |
| Dokument- / data- / testlag | ❌ | varierer | varierer | ✅ |
| Bevis på hver kant | ❌ | ❌ | varierer | ✅ |
| Avgrenset påvirkningsanalyse | ❌ | ❌ | varierer | ✅ |
| Kontekst fra Git-endringer | varierer | ❌ | ❌ | ✅ |
| Token-budsjetterte Context Packs | ❌ | varierer | ❌ | ✅ |
| Skrivebeskyttet MCP-henting | ❌ | varierer | varierer | ✅ |
| Ingen intern LLM påkrevd | ✅ | ❌ | ✅ | ✅ |

En datert, kildebelagt sammenligning med tre kolonner mot et modent grafverktøy
(egenskaper KawnGraph leder på **og** egenskaper det ikke gjør) finnes i
**[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmarks

KawnGraph leveres med en **lokal A/B-rigg** som kjører *samme* agent på *samme*
oppgave **med vs. uten** KawnGraph og registrerer atferd. Resultatene er ærlige og
**oppgaveavhengige** — inkludert nøytrale og negative tilfeller.

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

Metodikk, miljø, utvalgsstørrelser, tabellene per metrikk, og begrensninger:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — generert fra det committede,
validerte artefaktet i [`benchmarks/published/`](../../benchmarks/published/).

---

## Støttede skannere og lag

Hvert språk/format er en versjonert **skanner-plugin** bak ett register
(detect → scan → finalize): deterministisk rekkefølge, feilisolering per fil,
eksplisitt registrering og avgrensede filstørrelser.

| Språk / format | Trukket ut |
| ----------------- | --------- |
| TypeScript / JS   | filer, funksjoner/klasser på toppnivå, importer, anrop, Next.js-ruter, tester |
| Python            | `def`/`async def`/`class` på toppnivå, dekoratorer, metoder (som metadata), importer, FastAPI/Flask-ruter, docstrings, tester (via `@lezer/python` — ren JS, feiltolerant) |
| SQL               | tabeller (`CREATE`/`ALTER`), fremmednøkkel-relasjoner |
| package.json      | workspace-pakker og interne avhengigheter |
| Markdown          | overskrifter/seksjoner lenket til kode, SQL og ruter |

To bevisste utelatelser i begge kodeskannerne: metoder/nestede funksjoner er aldri
egne noder (en metode følger klassen sin som metadata), og deklarasjonsfiler for
ambient (`.d.ts`, `.pyi`) påberopes aldri. Detaljer:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Personvern og sikkerhet

- **Ingen nettverk som standard.** Skann og henting leser repoet ditt og skriver
  JSON under `.kawn/`. Ingenting forlater maskinen.
- **Ingen intern LLM.** Kode, dokumenter og SQL parses strukturelt; KI-berikelse
  er opt-in og lokal-først.
- **Ingen telemetri. Ingen logging av forespørsler som standard.**
- **Skrivebeskyttet MCP.** Serveren serverer grafen; den skanner, gjenoppbygger
  eller skriver den aldri — og nekter å servere en graf hvis skjema den ikke kan stole på.
- **Reverserbare, prosjekt-avgrensede integrasjoner.** Atomiske skrivinger,
  tidsstemplede sikkerhetskopier, strukturerte (ikke streng-baserte) config-endringer;
  redigerer aldri `CLAUDE.md` / `AGENTS.md`, rører aldri global config som standard.

Full modell: **[docs/PRIVACY.md](../PRIVACY.md)**. Rapporter en sårbarhet privat
via **[SECURITY.md](../../SECURITY.md)**.

---

## Status og begrensninger

KawnGraph er under **aktiv utvikling** (`v0.1.0`, ennå ikke publisert til npm). Bygget
og testet ende-til-ende: kode/data/config/dokument/test-grafen, dokument-til-kode-lenker,
modus-avgrenset forespørsel, påvirkningsanalyse, Git/PR-påvirkning, token-budsjetterte
Context Packs, Universal Context Protocol, den skrivebeskyttede MCP-serveren, agent-oppsett
med én kommando (Claude Code / Codex / Cursor), Studio, og A/B-benchmarkriggen.

**Ærlige begrensninger.** Den publiserte benchmarken er **utforskende (n<5 per arm —
retningsgivende, ikke signifikant)**. KawnGraph hjelper mest ved ukjent oppdagelse på tvers
av flere filer og kan legge til overhead på allerede fokuserte enkeltfil-oppgaver. Ikke bygget
ennå: opt-in kun-foreslå-hooks, det visuelle laget, semantisk/KI-berikelse, og et
kjøretidslag — alle opt-in av design. Se
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Dokumentasjon

| Veiledning | Hva som er inni |
| ----- | ------------- |
| [Kom i gang](../GETTING_STARTED.md) | Installer, skann, første Context Pack |
| [Agent-integrasjon](../AGENT_INTEGRATION.md) | MCP-oppsettskontrakt, reverserbarhet |
| [Context Packs](../CONTEXT_PACKS.md) | Rangering, budsjetter, UCP-wire-format |
| [Grafmodell](../GRAPH_MODEL.md) | Noder, kanter, lag, bevis, ID-er |
| [Skannere](../SCANNERS.md) | Hva hver språk-plugin trekker ut |
| [Benchmarks](../BENCHMARKS.md) | Metodikk, miljø, fulle resultater |
| [Sammenligning](../COMPARISON.md) | Datert, kildebelagt egenskaps-sammenligning |
| [Personvern](../PRIVACY.md) | Datagrenser per lag |
| [Feilsøking](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Vanlige problemer og spørsmål |

---

## Bidra

Bidrag er velkomne. Bygg fra kildekode, kjør testsuiten, og les veiledningen:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Se **[CONTRIBUTING.md](../../CONTRIBUTING.md)** for oppsett, konvensjoner og
personverngjennomgangen hver PR består; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** for
forventninger i fellesskapet; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**
for å legge til eller gjennomgå et språk; og **[SUPPORT.md](../../SUPPORT.md)** for hvor du kan
stille spørsmål.

---

## Lisens og anerkjennelser

**[MIT](../../LICENSE)** © KawnGraph-bidragsytere.

**Kawn** (arabisk **كَوْن** — *kosmos, univers, eksistens*) behandler et repo som
et levende univers av kunnskap; **Graph** er den bevisbaserte Agent Context Graph i
kjernen. Bygget med [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/), og
[`@lezer/python`](https://lezer.codemirror.net/).
