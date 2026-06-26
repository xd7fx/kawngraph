<!-- KAWN-TRANSLATION
lang: ro
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

### Universul de context al agentului

**Un singur univers de proiect. Fiecare agent de programare.**

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
**Română** ·
[Čeština](README.cs.md) ·
[Suomi](README.fi.md) ·
[Dansk](README.da.md) ·
[Norsk](README.no.md) ·
[Magyar](README.hu.md) ·
[עברית](README.he.md)

<sub>English is canonical · العربية is AI-assisted · owner review pending · the other 29 languages are machine-assisted (human review needed) — see [translation status](STATUS.md).</sub>

<!-- LANGBAR:END -->

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA.svg?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/xd7fx)

> Această traducere este asistată de mașină și poate conține erori. Versiunea canonică în engleză este [README.md](../../README.md); consultați [starea traducerilor](STATUS.md).

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="O sarcină ('Repară callback-ul OAuth Zid') intră în KawnGraph, care returnează un Context Pack încadrat într-un buget de token-uri: fișiere obligatoriu de citit, documente conexe, tabele, teste, riscuri, o listă de excluderi și un scor de încredere." width="860">
</div>

---

## De ce KawnGraph?

Când îi dai unui agent de programare o sarcină, de obicei începe prin a *citi* —
mult. Deschide zeci de fișiere, redescoperă cum ajung rutele la baza de date și
reconstruiește același model mental la fiecare cerere. Asta este lent, costisitor
în token-uri și adesea inexact: agentul ratează singurul fișier care contează și
se îneacă în cinci care nu contează.

KawnGraph scanează depozitul **o singură dată**, construiește un graf stratificat,
susținut de dovezi, al felului în care lucrurile se leagă, apoi răspunde, pentru o
sarcină anume, cu **puținele fișiere care contează** — plus documentele relevante,
tabelele de bază de date conexe, testele de rulat și riscurile de urmărit. Acel
pachet este un **Context Pack**. Graful este substratul; Context Pack-ul este
produsul.

> **Dă-le agenților harta, nu depozitul.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Pornire rapidă

> **Atenție:** pachetul npm `kawngraph` **nu este încă publicat**, așa că
> `npx kawngraph …` *nu* este disponibil astăzi. Folosiți calea din sursă de mai
> jos; fluxul `npx` este arătat pentru **după publicare**.

**Astăzi — din sursă** (acest monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**După publicarea pe npm** (experiența vizată, dintr-o singură comandă):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Apoi deschideți agentul și descrieți pur și simplu sarcina — el extrage singur
puținele fișiere care contează. Fără chei API, fără telemetrie, fără apeluri de
rețea în timpul scanării sau al regăsirii. Sunteți nou? Începeți cu
**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Conectează-l la agentul tău de programare

Ideea KawnGraph este că agentul apelează la hartă **automat**. O singură comandă
leagă un proiect de agenții pe care îi folosiți — fără a edita `CLAUDE.md` sau
`AGENTS.md`, fiecare modificare fiind reversibilă:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` detectează **Claude Code**, **Codex** și **Cursor** și instalează o
**integrare MCP doar-citire** încadrată la proiect (`.mcp.json`,
`.cursor/mcp.json` sau `.codex/config.toml`), făcând o copie de rezervă a tot ce
atinge și verificând serverul printr-un handshake live. Contractul complet:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**Serverul MCP** este JSON-RPC stdio doar-citire, fără dependențe, cu patru unelte:

| Unealtă | Ce face |
| ---- | ------------ |
| `kawn_context` | Context Pack încadrat într-un buget de token-uri pentru o sarcină. |
| `kawn_query` | Căutare clasată, încadrată pe mod, peste graf. |
| `kawn_affected` | Impact invers: ce depinde de un simbol. |
| `kawn_changes` | Impactul setului curent de modificări (necomise, sau o ramură față de o referință de bază). Doar git local. |

El **doar citește** graful — nu îl scanează, reconstruiește sau scrie niciodată
(avertizează când graful pare învechit și indică `kawn update`).

---

## Cum funcționează

Un proiect nu înseamnă doar cod. Înseamnă cod **și** documente **și** SQL **și**
teste **și** configurația care le leagă pe toate. KawnGraph modelează fiecare ca
un **strat** distinct, astfel încât o interogare cere exact ce are nevoie și nimic
din ce nu are nevoie — o interogare de impact al codului nu aduce niciodată
documente de marketing; o interogare de documente nu returnează niciodată grafuri
de apel brute decât dacă o ceri.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph citește depozitul cu scanere deterministe într-un singur graf stratificat la .kawn/graph.json (straturile code, data, config, docs, test), servit doar-citire către CLI-ul kawn, serverul MCP și Studio. Fără rețea, fără LLM, fără telemetrie." width="860">
</div>

| Strat    | Exemple                                            |
| -------- | --------------------------------------------------- |
| `code`   | files, functions, classes, imports, calls, routes   |
| `data`   | SQL tables, migrations, foreign keys                |
| `config` | workspace packages, dependencies                    |
| `docs`   | markdown sections, links, mentions                  |
| `test`   | tests and what they cover                           |

Fiecare muchie poartă **dovezi** (cale sursă, interval de linii, fragment) și un
nivel de încredere; fiecare nod are un **ID stabil, adresabil prin conținut**,
astfel încât graful rămâne comparabil (diffable) între scanări. Modelul în
detaliu: **[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Un Context Pack, de la cap la coadă

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

Același pachet este disponibil ca Markdown, JSON sau ca **Universal Context
Protocol** neutru față de agent (`--format ucp` / `ucp-md`). Mai mult:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` deschide **KawnGraph Studio** — un explorator local, **doar-citire**,
servit prin `127.0.0.1`, care citește `.kawn/graph.json` existent și nu scanează,
nu reconstruiește și nu scrie niciodată. Oferă un graf 2D interactiv, o hartă
stelară 3D „Univers” scalabilă (încadrată în buget, ca să nu deseneze niciodată un
graf mare întreg deodată), un constructor de Context Pack, impact invers, vizualizări
de modificări Git și o vizualizare de benchmark comportamental. Construit în engleză
și arabă (conștient de RTL). Rulați-l din sursă cu `pnpm studio:build &&
pnpm kawn map`.

> O captură de ecran din Studio va fi adăugată în `../assets/` după următoarea
> trecere de captură vizuală; până atunci diagramele de mai sus sunt vizualele
> canonice.

---

## KawnGraph vs. căutarea simplă în depozit

O comparație neutră a *abordărilor* (nu un atac la adresa concurenților). Fiecare
celulă este justificabilă; „variabil” înseamnă că depinde de unealta specifică.

| Capabilitate | Căutare simplă | RAG general | Vizualizator de graf generic | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Scanare locală deterministă | ✅ | variabil | ✅ | ✅ |
| Relații la nivel de simbol | ❌ | variabil | ✅ | ✅ |
| Straturi documente / date / teste | ❌ | variabil | variabil | ✅ |
| Dovezi pe fiecare muchie | ❌ | ❌ | variabil | ✅ |
| Analiză de impact mărginită | ❌ | ❌ | variabil | ✅ |
| Context al modificărilor Git | variabil | ❌ | ❌ | ✅ |
| Context Packs încadrate într-un buget de token-uri | ❌ | variabil | ❌ | ✅ |
| Regăsire MCP doar-citire | ❌ | variabil | variabil | ✅ |
| Niciun LLM intern necesar | ✅ | ❌ | ✅ | ✅ |

O comparație datată, cu surse, pe trei coloane față de o unealtă de graf matură
(capabilitățile la care KawnGraph conduce **și** cele la care nu o face) se află
în **[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmark-uri

KawnGraph livrează un **harness A/B local** care rulează *același* agent pe
*aceeași* sarcină **cu vs. fără** KawnGraph și înregistrează comportamentul.
Rezultatele sunt oneste și **dependente de sarcină** — inclusiv cazuri neutre și
negative.

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

Metodologia, mediul, dimensiunile eșantioanelor, tabelele per-metrică și
limitările: **[docs/BENCHMARKS.md](../BENCHMARKS.md)** — generate din artefactul
comis și validat din [`benchmarks/published/`](../../benchmarks/published/).

---

## Scanere și straturi suportate

Fiecare limbaj/format este un **plugin de scaner** versionat în spatele unui
singur registru (detectează → scanează → finalizează): ordine deterministă,
izolare a eșecurilor per fișier, înregistrare explicită și dimensiuni de fișier
mărginite.

| Limbaj / format | Extras |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

Două omisiuni deliberate în ambele scanere de cod: metodele/funcțiile imbricate nu
sunt niciodată noduri separate (o metodă călătorește pe clasa sa ca metadate), iar
fișierele de declarare ambientală (`.d.ts`, `.pyi`) nu sunt niciodată revendicate.
Detalii: **[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Confidențialitate și securitate

- **Fără rețea în mod implicit.** Scanarea și regăsirea citesc depozitul și scriu
  JSON sub `.kawn/`. Nimic nu părăsește mașina.
- **Niciun LLM intern.** Codul, documentele și SQL-ul sunt analizate structural;
  îmbogățirea cu AI este opțională și local-first.
- **Fără telemetrie. Fără jurnalizarea interogărilor în mod implicit.**
- **MCP doar-citire.** Serverul servește graful; nu îl scanează, reconstruiește
  sau scrie niciodată — și refuză să servească un graf a cărui schemă nu o poate
  considera de încredere.
- **Integrări reversibile, încadrate la proiect.** Scrieri atomice, copii de
  rezervă cu marcaj temporal, editări de configurație structurate (nu pe șiruri);
  nu editează niciodată `CLAUDE.md` / `AGENTS.md`, nu atinge niciodată configurația
  globală în mod implicit.

Modelul complet: **[docs/PRIVACY.md](../PRIVACY.md)**. Raportați o vulnerabilitate
în privat prin **[SECURITY.md](../../SECURITY.md)**.

---

## Stare și limitări

KawnGraph este în **dezvoltare activă** (`v0.1.0`, încă nepublicat pe npm).
Construit și testat de la cap la coadă: graful code/data/config/docs/test,
legăturile documente-la-cod, interogarea încadrată pe mod, analiza de impact,
impactul Git/PR, Context Packs încadrate într-un buget de token-uri, Universal
Context Protocol, serverul MCP doar-citire, configurarea agentului dintr-o singură
comandă (Claude Code / Codex / Cursor), Studio și harness-ul de benchmark A/B.

**Limite oneste.** Benchmark-ul publicat este **exploratoriu (n<5 per braț —
direcțional, nu semnificativ)**. KawnGraph ajută cel mai mult la descoperirea
nefamiliarizată în mai multe fișiere și poate adăuga supraîncărcare la sarcini deja
focalizate, cu un singur fișier. Încă neconstruit: hook-uri opt-in doar-sugestie,
stratul vizual, îmbogățirea semantică/AI și un strat de execuție (runtime) — toate
opt-in prin proiectare. Vedeți
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Documentație

| Ghid | Ce conține |
| ----- | ------------- |
| [Pornire](../GETTING_STARTED.md) | Instalare, scanare, primul Context Pack |
| [Integrarea agentului](../AGENT_INTEGRATION.md) | Contractul de configurare MCP, reversibilitate |
| [Context Packs](../CONTEXT_PACKS.md) | Clasare, bugete, formatul de transmisie UCP |
| [Modelul de graf](../GRAPH_MODEL.md) | Noduri, muchii, straturi, dovezi, ID-uri |
| [Scanere](../SCANNERS.md) | Ce extrage fiecare plugin de limbaj |
| [Benchmark-uri](../BENCHMARKS.md) | Metodologie, mediu, rezultate complete |
| [Comparație](../COMPARISON.md) | Comparație de capabilități datată, cu surse |
| [Confidențialitate](../PRIVACY.md) | Limitele datelor per strat |
| [Depanare](../TROUBLESHOOTING.md) · [Întrebări frecvente](../FAQ.md) | Probleme și întrebări comune |

---

## Contribuții

Contribuțiile sunt binevenite. Construiți din sursă, rulați suita și citiți ghidul:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Vedeți **[CONTRIBUTING.md](../../CONTRIBUTING.md)** pentru configurare, convenții și
revizuirea de confidențialitate prin care trece fiecare PR;
**[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** pentru așteptările comunității;
**[docs/i18n/TRANSLATING.md](TRANSLATING.md)** pentru a adăuga sau revizui o limbă;
și **[SUPPORT.md](../../SUPPORT.md)** pentru unde să puneți întrebări.

---

## Licență și mulțumiri

**[MIT](../../LICENSE)** © contribuitorii KawnGraph.

**Kawn** (în arabă **كَوْن** — *cosmos, univers, existență*) tratează un depozit ca
pe un univers viu de cunoaștere; **Graph** este Agent Context Graph susținut de
dovezi din nucleul său. Construit cu [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/) și
[`@lezer/python`](https://lezer.codemirror.net/).
