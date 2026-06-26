<!-- KAWN-TRANSLATION
lang: it
status: machine-assisted
canonical: README.md
canonical-sha: 9ae23d43afac34187e2ed17d64244ea5b65352f88f470cbc2818ff41eb15e312
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### L'universo di contesto dell'agente

**Un unico universo di progetto. Ogni agente di programmazione.**

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
**Italiano** ·
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
[Dansk](README.da.md) ·
[Norsk](README.no.md) ·
[Magyar](README.hu.md) ·
[עברית](README.he.md)

<sub>English is canonical · العربية is AI-assisted · owner review pending · the other 29 languages are machine-assisted (human review needed) — see [translation status](STATUS.md).</sub>

<!-- LANGBAR:END -->

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA.svg?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/xd7fx)

> Questa traduzione è assistita da una macchina e può contenere errori. La versione canonica in inglese è [README.md](../../README.md); consulta lo [stato delle traduzioni](STATUS.md).

</div>

---

## Perché KawnGraph?

KawnGraph mappa codice, documentazione, dati, test e modifiche di Git in
**Context Packs** supportati da evidenze, così che Claude, Codex e Cursor
possano raggiungere i file giusti senza leggere l'intero repository.

Quando assegni un compito a un agente di programmazione, di solito inizia
*leggendo* — molto. Apre decine di file, ricava di nuovo come le rotte
raggiungono il database e ricostruisce lo stesso modello mentale a ogni
richiesta. È lento, costoso in token e spesso impreciso: l'agente si perde
l'unico file che conta e annega in cinque che non contano.

KawnGraph scansiona il repository **una volta**, costruisce un grafo a livelli
e supportato da evidenze di come le cose sono correlate, poi risponde, per un
compito specifico, con i **pochi file che contano** — più la documentazione
pertinente, le tabelle di database correlate, i test da eseguire e i rischi da
tenere d'occhio. Quel pacchetto è un **Context Pack**. Il grafo è il substrato;
il Context Pack è il prodotto.

> **Dai agli agenti la mappa, non il repository.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Avvio rapido

> **Attenzione:** il pacchetto npm `kawngraph` **non è ancora pubblicato**,
> quindi `npx kawngraph …` *non* è disponibile oggi. Usa il percorso da codice
> sorgente qui sotto; il flusso `npx` è mostrato per **dopo la pubblicazione**.

**Oggi — da codice sorgente** (questo monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Dopo la pubblicazione su npm** (l'esperienza prevista con un solo comando):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Poi apri il tuo agente e descrivi semplicemente il tuo compito — recupera da
solo i pochi file che contano. Nessuna chiave API, nessuna telemetria, nessuna
chiamata di rete durante la scansione o il recupero. Sei alle prime armi?
Inizia con **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Collegalo al tuo agente di programmazione

Il punto di KawnGraph è che l'agente raggiunga la mappa **automaticamente**.
Un solo comando collega un progetto agli agenti che usi — senza modificare
`CLAUDE.md` o `AGENTS.md`, con ogni modifica reversibile:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` rileva **Claude Code**, **Codex** e **Cursor** e installa una
**integrazione MCP di sola lettura** circoscritta al progetto (`.mcp.json`,
`.cursor/mcp.json` o `.codex/config.toml`), eseguendo il backup di tutto ciò
che tocca e verificando il server con un handshake dal vivo. Contratto
completo: **[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

Il **server MCP** è JSON-RPC su stdio di sola lettura, senza dipendenze e con quattro strumenti:

| Strumento | Cosa fa |
| ---- | ------------ |
| `kawn_context` | Context Pack con budget di token per un compito. |
| `kawn_query` | Ricerca classificata e circoscritta per modalità sul grafo. |
| `kawn_affected` | Impatto inverso: cosa dipende da un simbolo. |
| `kawn_changes` | Impatto dell'insieme di modifiche attuale (non committate, o un branch rispetto a un riferimento base). Solo git locale. |

**Legge soltanto** il grafo — non lo scansiona, ricostruisce o scrive mai
(avvisa quando il grafo sembra obsoleto e rimanda a `kawn update`).

---

## Come funziona

Un progetto non è solo codice. È codice **e** documentazione **e** SQL **e**
test **e** la configurazione che li lega insieme. KawnGraph modella ciascuno
come un **livello** distinto, così che una query chieda esattamente ciò di cui
ha bisogno e nulla che non le serva — una query di impatto sul codice non tira
mai dentro documentazione di marketing; una query sulla documentazione non
restituisce mai grafi di chiamate grezzi a meno che tu non lo chieda.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph legge il tuo repository con scanner deterministici verso un unico grafo a livelli in .kawn/graph.json (livelli di codice, dati, configurazione, documentazione e test), servito in sola lettura alla CLI kawn, al server MCP e a Studio. Nessuna rete, nessun LLM, nessuna telemetria." width="860">
</div>

| Livello  | Esempi                                              |
| -------- | --------------------------------------------------- |
| `code`   | file, funzioni, classi, import, chiamate, rotte     |
| `data`   | tabelle SQL, migrazioni, chiavi esterne             |
| `config` | pacchetti del workspace, dipendenze                 |
| `docs`   | sezioni markdown, link, menzioni                    |
| `test`   | test e ciò che coprono                              |

Ogni arco porta con sé **evidenze** (percorso di origine, intervallo di righe,
frammento) e un livello di confidenza; ogni nodo ha un **ID stabile e
indirizzabile per contenuto** così che il grafo resti confrontabile tra le
scansioni. Modello più approfondito:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Un Context Pack, dall'inizio alla fine

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

Lo stesso pacchetto è disponibile come Markdown, JSON o l'**Universal Context
Protocol** neutrale rispetto all'agente (`--format ucp` / `ucp-md`). Altro:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` apre **KawnGraph Studio** — un esploratore locale, di **sola
lettura**, servito su `127.0.0.1`, che legge il `.kawn/graph.json` esistente e
non scansiona, ricostruisce o scrive mai. Offre un grafo 2D interattivo, una
mappa stellare 3D "Universe" scalabile (con budget così da non disegnare mai un
intero grafo di grandi dimensioni in una volta), un costruttore di Context
Pack, l'impatto inverso, viste delle modifiche di Git e una vista di benchmark
comportamentale. Costruito in inglese e arabo (compatibile con RTL). Eseguilo
da codice sorgente con `pnpm studio:build && pnpm kawn map`.

> Uno screenshot acquisito di Studio sarà aggiunto a `docs/assets/` dopo la
> prossima passata di acquisizione visiva; fino ad allora i diagrammi qui sopra
> sono le immagini canoniche.

---

## KawnGraph rispetto alla semplice ricerca nel repository

Un confronto neutrale di *approcci* (non un attacco ai concorrenti). Ogni cella
è difendibile; "varia" significa che dipende dallo strumento specifico.

| Capacità | Ricerca semplice | RAG generico | Visualizzatore di grafi generico | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Scansione locale deterministica | ✅ | varia | ✅ | ✅ |
| Relazioni a livello di simbolo | ❌ | varia | ✅ | ✅ |
| Livelli di docs / dati / test | ❌ | varia | varia | ✅ |
| Evidenze su ogni arco | ❌ | ❌ | varia | ✅ |
| Analisi di impatto delimitata | ❌ | ❌ | varia | ✅ |
| Contesto delle modifiche di Git | varia | ❌ | ❌ | ✅ |
| Context Pack con budget di token | ❌ | varia | ❌ | ✅ |
| Recupero MCP di sola lettura | ❌ | varia | varia | ✅ |
| Nessun LLM interno richiesto | ✅ | ❌ | ✅ | ✅ |

Un confronto datato, con fonti e su tre colonne rispetto a uno strumento di
grafi maturo (capacità in cui KawnGraph è in vantaggio **e** capacità in cui
non lo è) si trova in **[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmarks

KawnGraph include un **banco di prova A/B locale** che esegue lo *stesso* agente
sullo *stesso* compito **con e senza** KawnGraph e registra il comportamento. I
risultati sono onesti e **dipendono dal compito** — inclusi casi neutri e
negativi.

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

Metodologia, ambiente, dimensioni del campione, le tabelle per metrica e le
limitazioni: **[docs/BENCHMARKS.md](../BENCHMARKS.md)** — generato a partire
dall'artefatto committato e validato in
[`benchmarks/published/`](../../benchmarks/published/).

---

## Scanner e livelli supportati

Ogni linguaggio/formato è un **plugin di scanner** versionato dietro un unico
registro (rileva → scansiona → finalizza): ordine deterministico, isolamento
dei guasti per file, registrazione esplicita e dimensioni dei file delimitate.

| Linguaggio / formato | Estratto |
| ----------------- | --------- |
| TypeScript / JS   | file, funzioni/classi di livello superiore, import, chiamate, rotte di Next.js, test |
| Python            | `def`/`async def`/`class` di livello superiore, decoratori, metodi (come metadati), import, rotte di FastAPI/Flask, docstring, test (tramite `@lezer/python` — JS puro, tollerante agli errori) |
| SQL               | tabelle (`CREATE`/`ALTER`), relazioni a chiave esterna |
| package.json      | pacchetti del workspace e dipendenze interne |
| Markdown          | intestazioni/sezioni collegate a codice, SQL e rotte |

Due omissioni deliberate in entrambi gli scanner di codice: i metodi/funzioni
annidate non sono mai nodi separati (un metodo viaggia sulla sua classe come
metadato), e i file di dichiarazione ambientale (`.d.ts`, `.pyi`) non vengono
mai rivendicati. Dettagli: **[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Privacy e sicurezza

- **Nessuna rete per impostazione predefinita.** La scansione e il recupero
  leggono il tuo repository e scrivono JSON sotto `.kawn/`. Nulla lascia la
  macchina.
- **Nessun LLM interno.** Codice, documentazione e SQL vengono analizzati
  strutturalmente; l'arricchimento con IA è opt-in e local-first.
- **Nessuna telemetria. Nessuna registrazione delle query per impostazione predefinita.**
- **MCP di sola lettura.** Il server serve il grafo; non scansiona, ricostruisce
  o scrive mai — e rifiuta di servire un grafo il cui schema non può ritenere
  affidabile.
- **Integrazioni reversibili e circoscritte al progetto.** Scritture atomiche,
  backup con marca temporale, modifiche di configurazione strutturate (non a
  stringa); non modifica mai `CLAUDE.md` / `AGENTS.md`, non tocca mai la
  configurazione globale per impostazione predefinita.

Modello completo: **[docs/PRIVACY.md](../PRIVACY.md)**. Segnala una
vulnerabilità in modo privato tramite **[SECURITY.md](../../SECURITY.md)**.

---

## Stato e limitazioni

KawnGraph è in **sviluppo attivo** (`v0.1.0`, non ancora pubblicato su npm).
Costruito e testato end-to-end: il grafo di
codice/dati/configurazione/documentazione/test, i collegamenti da docs a
codice, la query circoscritta per modalità, l'analisi di impatto, l'impatto di
Git/PR, i Context Pack con budget di token, l'Universal Context Protocol, il
server MCP di sola lettura, la configurazione degli agenti con un solo comando
(Claude Code / Codex / Cursor), Studio e il banco di prova benchmark A/B.

**Limiti onesti.** Il benchmark pubblicato è **esplorativo (n<5 per braccio —
direzionale, non significativo)**. KawnGraph aiuta soprattutto nella scoperta
multi-file non familiare e può aggiungere sovraccarico su compiti a file
singolo già focalizzati. Non ancora costruiti: hook opt-in di solo
suggerimento, il livello visivo, l'arricchimento semantico/con IA e un livello
di runtime — tutti opt-in per progettazione. Vedi
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Documentazione

| Guida | Cosa contiene |
| ----- | ------------- |
| [Per iniziare](../GETTING_STARTED.md) | Installa, scansiona, primo Context Pack |
| [Integrazione degli agenti](../AGENT_INTEGRATION.md) | Contratto di configurazione MCP, reversibilità |
| [Context Packs](../CONTEXT_PACKS.md) | Classificazione, budget, formato di trasmissione UCP |
| [Modello di grafo](../GRAPH_MODEL.md) | Nodi, archi, livelli, evidenze, ID |
| [Scanner](../SCANNERS.md) | Cosa estrae il plugin di ogni linguaggio |
| [Benchmarks](../BENCHMARKS.md) | Metodologia, ambiente, risultati completi |
| [Confronto](../COMPARISON.md) | Confronto delle capacità datato e con fonti |
| [Privacy](../PRIVACY.md) | Confini dei dati per livello |
| [Risoluzione dei problemi](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Problemi e domande comuni |

---

## Contribuire

I contributi sono benvenuti. Costruisci da codice sorgente, esegui la suite e
leggi la guida:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Consulta **[CONTRIBUTING.md](../../CONTRIBUTING.md)** per la configurazione, le
convenzioni e la revisione della privacy che ogni PR supera;
**[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** per le aspettative della
comunità; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)** per aggiungere o
revisionare una lingua; e **[SUPPORT.md](../../SUPPORT.md)** per dove porre
domande.

---

## Licenza e ringraziamenti

**[MIT](../../LICENSE)** © i contributori di KawnGraph.

**Kawn** (arabo **كَوْن** — *cosmo, universo, esistenza*) tratta un repository
come un universo vivente di conoscenza; **Graph** è l'Agent Context Graph
supportato da evidenze al suo nucleo. Costruito con
[TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/),
[React](https://react.dev/), [React Flow](https://reactflow.dev/),
[Three.js](https://threejs.org/), e [`@lezer/python`](https://lezer.codemirror.net/).
