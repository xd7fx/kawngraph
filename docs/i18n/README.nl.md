<!-- KAWN-TRANSLATION
lang: nl
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

### Het Agent Context-universum

**Eén projectuniversum. Elke coding-agent.**

KawnGraph brengt code, documentatie, data, tests en Git-wijzigingen samen in
bewijsondersteunde **Context Packs**, zodat Claude, Codex en Cursor de juiste
bestanden bereiken zonder de hele repository te lezen.

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
**Nederlands** ·
[Українська](README.uk.md) ·
[Tiếng Việt](README.vi.md) ·
[ภาษาไทย](README.th.md) ·
[Svenska](README.sv.md) ·
[Ελληνικά](README.el.md) ·
[Română](README.ro.md) ·
[Čeština](README.cs.md) ·
[Suomi](README.fi.md) ·
[Dansk](README.da.md) ·
[Norsk](README.no.md) ·
[Magyar](README.hu.md) ·
[עברית](README.he.md)

<sub>English is canonical · العربية is AI-assisted · owner review pending · the other 29 languages are machine-assisted (human review needed) — see [translation status](STATUS.md).</sub>

<!-- LANGBAR:END -->

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA.svg?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/xd7fx)

> Deze vertaling is machine-ondersteund en kan fouten bevatten. De canonieke
> Engelse versie is [README.md](../../README.md); zie [STATUS.md](STATUS.md) voor
> de vertaalstatus.

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="Een taak ('Repareer de Zid OAuth-callback') stroomt naar KawnGraph, dat een token-gebudgetteerd Context Pack teruggeeft: essentiële bestanden, gerelateerde documentatie, tabellen, tests, risico's, een uitgesloten lijst en een betrouwbaarheidsscore." width="860">
</div>

---

## Waarom KawnGraph?

Wanneer je een coding-agent een taak geeft, begint hij meestal met *lezen* — heel
veel. Hij opent tientallen bestanden, leidt opnieuw af hoe routes de database
bereiken en bouwt bij elk verzoek hetzelfde mentale model opnieuw op. Dat is
traag, token-duur en vaak onnauwkeurig: de agent mist het ene bestand dat ertoe
doet en verdrinkt in vijf die er niet toe doen.

KawnGraph scant de repository **één keer**, bouwt een gelaagde,
bewijsondersteunde graaf van hoe dingen samenhangen, en antwoordt vervolgens voor
een specifieke taak met de **paar bestanden die ertoe doen** — plus de relevante
documentatie, de gerelateerde databasetabellen, de uit te voeren tests en de
risico's om in de gaten te houden. Die bundel is een **Context Pack**. De graaf
is het substraat; het Context Pack is het product.

> **Geef agents de kaart, niet de hele repo.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Snelstart

> **Let op:** het `kawngraph` npm-pakket is **nog niet gepubliceerd**, dus
> `npx kawngraph …` is vandaag *niet* beschikbaar. Gebruik het from-source-pad
> hieronder; de `npx`-flow wordt getoond voor **na publicatie**.

**Vandaag — vanuit de broncode** (deze monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Na npm-publicatie** (de bedoelde ervaring met één commando):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Open daarna je agent en beschrijf gewoon je taak — hij haalt zelf de paar
bestanden op die ertoe doen. Geen API-sleutels, geen telemetrie, geen
netwerkoproepen tijdens het scannen of ophalen. Nieuw hierin? Begin met
**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Verbind het met je coding-agent

Het idee achter KawnGraph is dat de agent **automatisch** naar de kaart grijpt.
Eén commando koppelt een project aan de agents die je gebruikt — zonder
`CLAUDE.md` of `AGENTS.md` te bewerken, en elke wijziging is omkeerbaar:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` detecteert je coding-agents — **Claude Code**, **Codex**, **Cursor**,
**Copilot**, **Gemini CLI** en **Aider** (plus een `generic` Markdown/JSON-export
en een optionele **lokale LLM**) — en installeert een **alleen-lezen integratie**
die beperkt blijft tot het project (`.mcp.json`, `.cursor/mcp.json`,
`.codex/config.toml`, `.vscode/mcp.json`, `.gemini/settings.json` of een
Aider-contextbestand), maakt back-ups van alles wat het aanraakt en verifieert
elke MCP-server met een live handshake. Volledig contract:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

De **MCP-server** is een alleen-lezen stdio JSON-RPC-loop **zonder MCP SDK**
(handgeschreven) en met vier tools:

| Tool | Wat het doet |
| ---- | ------------ |
| `kawn_context` | Token-gebudgetteerd Context Pack voor een taak. |
| `kawn_query` | Gerangschikte, modus-gescopete zoekopdracht over de graaf. |
| `kawn_affected` | Omgekeerde impact: wat afhankelijk is van een symbool. |
| `kawn_changes` | Impact van de huidige wijzigingenset (niet-gecommit, of een branch t.o.v. een base-ref). Alleen lokale git. |

Het **leest alleen** de graaf — het scant, herbouwt of schrijft de graaf nooit
(het waarschuwt wanneer de graaf verouderd lijkt en verwijst naar `kawn update`).

---

## Hoe het werkt

Een project is niet alleen code. Het is code **en** documentatie **en** SQL
**en** tests **en** de configuratie die ze samenbindt. KawnGraph modelleert elk
als een aparte **laag**, zodat een query precies vraagt wat hij nodig heeft en
niets wat hij niet nodig heeft — een code-impact-query sleept nooit
marketingdocumentatie mee; een docs-query geeft nooit ruwe call-grafen terug
tenzij je daarom vraagt.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph leest je repo met deterministische scanners in één gelaagde graaf op .kawn/graph.json (code-, data-, config-, docs-, testlagen), alleen-lezen aangeboden aan de kawn-CLI, de MCP-server en Studio. Geen netwerk, geen LLM, geen telemetrie." width="860">
</div>

| Laag     | Voorbeelden                                         |
| -------- | --------------------------------------------------- |
| `code`   | bestanden, functies, classes, imports, calls, routes |
| `data`   | SQL-tabellen, migraties, foreign keys               |
| `config` | workspace-pakketten, afhankelijkheden               |
| `docs`   | markdown-secties, links, vermeldingen               |
| `test`   | tests en wat ze dekken                              |

Edges dragen **bewijs** (bronpad, regelbereik, snippet) en een
betrouwbaarheidsniveau — mechanisch afgeleid waar de scanner het kan toevoegen;
elke node heeft een **stabiel, content-adresseerbaar ID** zodat de graaf
vergelijkbaar (diffbaar) blijft over scans heen. Dieper model:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Een Context Pack, van begin tot eind

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

Hetzelfde pack is beschikbaar als Markdown, JSON of het agent-neutrale
**Universal Context Protocol** (`--format ucp` / `ucp-md`). Meer:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` opent **KawnGraph Studio** — een lokale, **alleen-lezen** verkenner
die via `127.0.0.1` wordt aangeboden, de bestaande `.kawn/graph.json` leest en
nooit scant, herbouwt of schrijft. Het biedt een interactieve 2D-graaf, een
schaalbare 3D-"Universe"-sterrenkaart (gebudgetteerd zodat hij nooit een hele
grote graaf in één keer tekent), een Context-Pack-bouwer, omgekeerde impact,
Git-wijzigingsweergaven en een gedragsmatige benchmarkweergave. Gebouwd in het
Engels en het Arabisch (RTL-bewust). Voer het uit vanuit de broncode met
`pnpm studio:build && pnpm kawn map`.

<div align="center">
<img src="../assets/studio-universe.webp" alt="KawnGraph Studio — de alleen-lezen 3D-'Universe'-weergave van de eigen graaf van deze repository: 1.261 nodes geclusterd per laag (Code 815, Docs 430, Config 13, Data 3) met verbindingslijnen, plus filters per laag/type/edge." width="860">
<br><sub>De 3D-<b>Universe</b>-weergave — de eigen graaf van deze repository (1.261 nodes), alleen-lezen.</sub>
</div>

<div align="center">
<img src="../assets/studio-map.webp" alt="KawnGraph Studio — de 2D-graafweergave van het meegeleverde voorbeeldproject: bestanden, functies, routes, tabellen en docs als nodes met gelabelde, bewijsondersteunde edges (imports, calls, defines, mentions, explains), plus filters per laag/type/edge." width="860">
<br><sub>De 2D-<b>graaf</b>weergave — het meegeleverde voorbeeldproject, met filters per laag / type / edge.</sub>
</div>

---

## KawnGraph vs. gewone repository-zoekfunctie

Een neutrale vergelijking van *benaderingen* (geen aanval op concurrenten). Elke
cel is verdedigbaar; "varieert" betekent dat het afhangt van de specifieke tool.

| Capaciteit | Gewone zoekfunctie | Algemene RAG | Generieke graafviewer | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministische lokale scan | ✅ | varieert | ✅ | ✅ |
| Relaties op symboolniveau | ❌ | varieert | ✅ | ✅ |
| Docs- / data- / testlagen | ❌ | varieert | varieert | ✅ |
| Bewijs op elke edge | ❌ | ❌ | varieert | ✅ |
| Begrensde impactanalyse | ❌ | ❌ | varieert | ✅ |
| Git-wijzigingscontext | varieert | ❌ | ❌ | ✅ |
| Token-gebudgetteerde Context Packs | ❌ | varieert | ❌ | ✅ |
| Alleen-lezen MCP-ophaling | ❌ | varieert | varieert | ✅ |
| Geen interne LLM vereist | ✅ | ❌ | ✅ | ✅ |

Een gedateerde, gebronde vergelijking met drie kolommen tegen een volwassen
graaftool (capaciteiten waarin KawnGraph voorop loopt **en** capaciteiten waarin
het dat niet doet) staat in **[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmarks

KawnGraph wordt geleverd met een **lokale A/B-harness** die *dezelfde* agent op
*dezelfde* taak draait **met versus zonder** KawnGraph en het gedrag vastlegt.
De resultaten zijn eerlijk en **taakafhankelijk** — inclusief neutrale en
negatieve gevallen.

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

Methodologie, omgeving, steekproefgroottes, de per-metric-tabellen en
beperkingen: **[docs/BENCHMARKS.md](../BENCHMARKS.md)** — gegenereerd uit het
gecommitte, gevalideerde artefact in
[`benchmarks/published/`](../../benchmarks/published/).

---

## Ondersteunde scanners & lagen

Elke taal/elk formaat is een geversioneerde **scanner-plug-in** achter één
registry (detect → scan → finalize): deterministische volgorde, isolatie van
fouten per bestand, expliciete registratie en begrensde bestandsgroottes.

| Taal / formaat | Geëxtraheerd |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

Twee bewuste weglatingen in beide code-scanners: methods/geneste functies zijn
nooit aparte nodes (een method rijdt mee op zijn class als metadata), en
ambient-declaratiebestanden (`.d.ts`, `.pyi`) worden nooit geclaimd. Details:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Privacy & beveiliging

- **Standaard geen netwerk.** Scan en ophalen lezen je repo en schrijven JSON
  onder `.kawn/`. Niets verlaat de machine.
- **Geen interne LLM.** Code, documentatie en SQL worden structureel geparseerd;
  AI-verrijking is opt-in en local-first.
- **Geen telemetrie. Standaard geen logging van zoekopdrachten.**
- **Alleen-lezen MCP.** De server bedient de graaf; hij scant, herbouwt of
  schrijft nooit — en weigert een graaf te bedienen waarvan hij het schema niet
  kan vertrouwen.
- **Omkeerbare, project-gescopete integraties.** Atomaire schrijfacties,
  back-ups met tijdstempel, gestructureerde (niet string-) configuratiewijzigingen;
  bewerkt nooit `CLAUDE.md` / `AGENTS.md`, raakt standaard nooit de globale
  configuratie aan.

Volledig model: **[docs/PRIVACY.md](../PRIVACY.md)**. Meld een kwetsbaarheid
privé via **[SECURITY.md](../../SECURITY.md)**.

---

## Status & beperkingen

KawnGraph is in **actieve ontwikkeling** (`v0.1.0`, nog niet gepubliceerd op
npm). End-to-end gebouwd en getest: de code/data/config/docs/test-graaf,
docs-naar-code-links, modus-gescopete query, impactanalyse, Git/PR-impact,
token-gebudgetteerde Context Packs, het Universal Context Protocol, de
alleen-lezen MCP-server, agent-setup met één commando (Claude Code, Codex,
Cursor, Copilot, Gemini, Aider, generieke export, lokale LLM), Studio en de
A/B-benchmarkharness.

**Eerlijke beperkingen.** De gepubliceerde benchmark is **verkennend (n<5 per arm
— richtinggevend, niet significant)**. KawnGraph helpt het meest bij onbekende
multi-bestandsontdekking en kan overhead toevoegen bij al-gefocuste
single-bestandstaken. Nog niet gebouwd: opt-in suggest-only hooks, de visuele
laag, semantische/AI-verrijking en een runtimelaag — allemaal opt-in van opzet.
Zie [PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Documentatie

| Gids | Wat erin staat |
| ----- | ------------- |
| [Aan de slag](../GETTING_STARTED.md) | Installeren, scannen, eerste Context Pack |
| [Agent-integratie](../AGENT_INTEGRATION.md) | MCP-setup-contract, omkeerbaarheid |
| [Context Packs](../CONTEXT_PACKS.md) | Ranking, budgetten, UCP-wire-formaat |
| [Graafmodel](../GRAPH_MODEL.md) | Nodes, edges, lagen, bewijs, IDs |
| [Scanners](../SCANNERS.md) | Wat elke taal-plug-in extraheert |
| [Benchmarks](../BENCHMARKS.md) | Methodologie, omgeving, volledige resultaten |
| [Vergelijking](../COMPARISON.md) | Gedateerde, gebronde capaciteitsvergelijking |
| [Privacy](../PRIVACY.md) | Datagrenzen per laag |
| [Probleemoplossing](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Veelvoorkomende problemen & vragen |

---

## Bijdragen

Bijdragen zijn welkom. Bouw vanuit de broncode, draai de suite en lees de gids:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Zie **[CONTRIBUTING.md](../../CONTRIBUTING.md)** voor setup, conventies en de
privacyreview die elke PR doorloopt; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)**
voor communityverwachtingen; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)** om
een taal toe te voegen of te reviewen; en **[SUPPORT.md](../../SUPPORT.md)** voor
waar je vragen kunt stellen.

---

## Licentie & dankbetuigingen

**[MIT](../../LICENSE)** © KawnGraph-bijdragers.

Gemaakt & onderhouden door **[Abdulrahman Alnashri](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)**.

**Kawn** (Arabisch **كَوْن** — *kosmos, universum, bestaan*) behandelt een
repository als een levend universum van kennis; **Graph** is de
bewijsondersteunde Agent Context Graph in de kern ervan. Gebouwd met
[TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/),
[React](https://react.dev/), [React Flow](https://reactflow.dev/),
[Three.js](https://threejs.org/), en
[`@lezer/python`](https://lezer.codemirror.net/).
