<!-- KAWN-TRANSLATION
lang: hu
status: machine-assisted
canonical: README.md
canonical-sha: b3379a444f5d5d0daf397ab919fb327c75e9b8b3d32b6ddd35e37ea76a810dc2
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### Az ágensek kontextus-univerzuma

**Egy projekt-univerzum. Minden kódoló ágensnek.**

A KawnGraph a kódot, a dokumentációt, az adatokat, a teszteket és a Git-változásokat
bizonyítékkal alátámasztott **Context Pack**-ekbe (kontextuscsomag) képezi le, hogy
a Claude, a Codex és a Cursor a megfelelő fájlokat érje el anélkül, hogy a teljes
adattárat elolvasná.

[English](../../README.md) · [العربية](../../README.ar.md) · [Magyar] (jelenlegi) · [translation status](STATUS.md)

</div>

> **Megjegyzés:** Ez a fordítás gépi segítséggel készült (machine-assisted), és
> hibákat tartalmazhat. A mérvadó forrás az angol eredeti
> [README.md](../../README.md). A fordítás állapotát lásd a [STATUS.md](STATUS.md)
> fájlban.

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="Egy feladat ('A Zid OAuth visszahívás javítása') a KawnGraph-ba áramlik, amely egy token-keretes Context Pack-et ad vissza: kötelezően olvasandó fájlok, kapcsolódó dokumentumok, táblák, tesztek, kockázatok, egy kizárási lista és egy konfidenciapontszám." width="860">
</div>

---

## Miért a KawnGraph?

Amikor egy kódoló ágensnek feladatot adsz, az általában *olvasással* kezd — méghozzá
sokat. Tucatnyi fájlt nyit meg, újra levezeti, hogyan érik el az útvonalak az
adatbázist, és minden kérésnél újraépíti ugyanazt a gondolati modellt. Ez lassú,
token-drága és gyakran pontatlan: az ágens lemarad arról az egy fájlról, ami számít,
és belefullad ötbe, amelyek nem.

A KawnGraph **egyszer** szkenneli az adattárat, réteges, bizonyítékkal alátámasztott
gráfot épít arról, hogyan kapcsolódnak a dolgok, majd egy konkrét feladatra azzal a
**néhány fájllal** válaszol, **ami számít** — plusz a releváns dokumentumokkal, a
kapcsolódó adatbázistáblákkal, a futtatandó tesztekkel és a figyelendő kockázatokkal.
Ez a köteg egy **Context Pack**. A gráf a hordozóközeg; a Context Pack a termék.

> **Adj az ágenseknek térképet, ne a teljes adattárat.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Gyorsindítás

> **Figyelem:** a `kawngraph` npm-csomag **még nincs közzétéve**, ezért az
> `npx kawngraph …` ma *nem* érhető el. Használd az alábbi forrásból-építés
> útvonalat; az `npx` folyamat a **közzététel utáni** állapotra vonatkozik.

**Ma — forrásból** (ez a monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Az npm-közzététel után** (a szándékolt egyparancsos élmény):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Ezután nyisd meg az ágensedet, és egyszerűen írd le a feladatot — magától előhúzza a
néhány fájlt, ami számít. Nincsenek API-kulcsok, nincs telemetria, nincsenek
hálózati hívások a szkennelés vagy a lekérés során. Új vagy benne? Kezdd ezzel:
**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Kösd össze a kódoló ágenseddel

A KawnGraph lényege, hogy az ágens **automatikusan** nyúl a térképhez. Egyetlen
parancs hozzáköt egy projektet az általad használt ágensekhez — anélkül, hogy
szerkesztené a `CLAUDE.md` vagy `AGENTS.md` fájlt, és minden változtatás
visszafordítható:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

A `setup` felismeri a **Claude Code**, a **Codex** és a **Cursor** ágenseket, és egy
**csak olvasható (read-only) MCP-integrációt** telepít a projektre korlátozva
(`.mcp.json`, `.cursor/mcp.json` vagy `.codex/config.toml`), biztonsági másolatot
készít mindenről, amihez hozzányúl, és egy élő kézfogással ellenőrzi a szervert. A
teljes szerződés: **[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

Az **MCP-szerver** csak olvasható stdio JSON-RPC, függőségek nélkül és négy
eszközzel:

| Eszköz | Mit csinál |
| ---- | ------------ |
| `kawn_context` | Token-keretes Context Pack egy feladathoz. |
| `kawn_query` | Rangsorolt, módra korlátozott keresés a gráfban. |
| `kawn_affected` | Visszafelé ható hatás: mi függ egy szimbólumtól. |
| `kawn_changes` | Az aktuális változáshalmaz hatása (commit nélküli, vagy egy ág egy alapreferenciához képest). Csak helyi git. |

**Csak olvassa** a gráfot — soha nem szkenneli, építi újra vagy írja (figyelmeztet,
ha a gráf elavultnak tűnik, és a `kawn update` parancsra mutat).

---

## Hogyan működik

Egy projekt nem csak kód. Az kód **és** dokumentáció **és** SQL **és** tesztek
**és** a konfiguráció, ami összeköti őket. A KawnGraph mindegyiket külön **rétegként
(layer)** modellezi, így egy lekérdezés pontosan azt kéri, amire szüksége van, és
semmit, amire nincs — egy kódhatás-lekérdezés soha nem ránt be marketing-
dokumentumokat; egy dokumentáció-lekérdezés soha nem ad vissza nyers hívási
gráfokat, hacsak nem kéred.

<div align="center">
<img src="../assets/architecture.svg" alt="A KawnGraph determinisztikus szkennerekkel olvassa be az adattáradat egyetlen réteges gráfba a .kawn/graph.json fájlban (code, data, config, docs, test rétegek), és csak olvashatóan szolgálja ki a kawn CLI-nek, az MCP-szervernek és a Studiónak. Nincs hálózat, nincs LLM, nincs telemetria." width="860">
</div>

| Réteg    | Példák                                              |
| -------- | --------------------------------------------------- |
| `code`   | files, functions, classes, imports, calls, routes   |
| `data`   | SQL tables, migrations, foreign keys                |
| `config` | workspace packages, dependencies                    |
| `docs`   | markdown sections, links, mentions                  |
| `test`   | tests and what they cover                           |

Minden él **bizonyítékot** hordoz (forrásútvonal, sortartomány, részlet) és egy
konfidenciaszintet; minden csomópontnak van egy **stabil, tartalom-címezhető
azonosítója**, így a gráf szkennelések között is összehasonlítható (diffelhető)
marad. Mélyebb modell: **[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Egy Context Pack az elejétől a végéig

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

Ugyanaz a csomag elérhető Markdownként, JSON-ként, vagy az ágens-semleges
**Universal Context Protocol** formátumban (`--format ucp` / `ucp-md`). Több:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

A `kawn map` megnyitja a **KawnGraph Studiót** — egy helyi, **csak olvasható**
böngészőt, amelyet a `127.0.0.1` felett szolgál ki, a meglévő `.kawn/graph.json`
fájlt olvassa, és soha nem szkennel, épít újra vagy ír. Interaktív 2D gráfot, egy
skálázható 3D "Universe" csillagtérképet (keretezve, hogy soha ne rajzoljon ki egy
teljes nagy gráfot egyszerre), egy Context-Pack-építőt, visszafelé ható hatást,
Git-változás nézeteket és egy viselkedési benchmark nézetet kínál. Angol és arab
nyelven épült (RTL-tudatos). Forrásból a `pnpm studio:build &&
pnpm kawn map` paranccsal indítsd.

> Egy elkészített Studio-képernyőkép a következő vizuális-rögzítési menet után
> kerül a `docs/assets/` mappába; addig a fenti diagramok a mérvadó vizuálok.

---

## KawnGraph vs. egyszerű adattár-keresés

A *megközelítések* semleges összehasonlítása (nem versenytárs-támadás). Minden cella
megvédhető; a "varies" azt jelenti, hogy az adott eszköztől függ.

| Képesség | Plain search | General RAG | Generic graph viewer | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Determinisztikus helyi szkennelés | ✅ | varies | ✅ | ✅ |
| Szimbólumszintű kapcsolatok | ❌ | varies | ✅ | ✅ |
| Docs / adat / teszt rétegek | ❌ | varies | varies | ✅ |
| Bizonyíték minden élen | ❌ | ❌ | varies | ✅ |
| Korlátozott hatáselemzés | ❌ | ❌ | varies | ✅ |
| Git-változási kontextus | varies | ❌ | ❌ | ✅ |
| Token-keretes Context Pack-ek | ❌ | varies | ❌ | ✅ |
| Csak olvasható MCP-lekérés | ❌ | varies | varies | ✅ |
| Nincs szükség belső LLM-re | ✅ | ❌ | ✅ | ✅ |

Egy dátumozott, forrásokkal alátámasztott, háromoszlopos összehasonlítás egy érett
gráfeszközzel szemben (képességek, amelyekben a KawnGraph vezet, **és** amelyekben
nem) a **[docs/COMPARISON.md](../COMPARISON.md)** fájlban található.

---

## Benchmarkok

A KawnGraph egy **helyi A/B futtatókörnyezetet** szállít, amely *ugyanazt* az ágenst
*ugyanazon* a feladaton futtatja **KawnGraph-fal vs. anélkül**, és rögzíti a
viselkedést. Az eredmények őszinték és **feladatfüggők** — beleértve a semleges és
negatív eseteket is.

<!-- BENCH:START -->

<!-- Generated by scripts/readme-benchmark.mjs from benchmarks/published/campaign-2026-06-20.summary.json — do not edit by hand. -->

Local A/B harness, 72 agent sessions, seed 1, 3 repeats per arm (3/arm after grouping — **exploratory, n<5, directional only**). Same agent, same task, same repository snapshot; A = without KawnGraph, B = with. Δ = B − A. Gold validation: all runs have a valid gold reference.

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

**Where it helped, was neutral, or hurt (all 12 task cells):**

| Task family | Agent | Mode | Outcome | Tool-call Δ | Time Δ |
| --- | --- | --- | --- | --- | --- |
| code-symbol-extraction | claude | retrieval | Regressed | +1.7 | +9.2 s |
| context-pack-ranking | claude | retrieval | Neutral | -0.3 | +6.2 s |
| docs-to-code-linking | claude | retrieval | Neutral | -0.3 | +9.6 s |
| freshness-gate | claude | retrieval | Improved | -9.7 | -54.6 s |
| oauth-code-guard | claude | e2e | Neutral | -0.3 | +5.9 s |
| zid-oauth | claude | retrieval | Regressed | +0.3 | +7.3 s |
| code-symbol-extraction | codex | retrieval | Regressed | +2 | +20.3 s |
| context-pack-ranking | codex | retrieval | Regressed | +4 | +33.3 s |
| docs-to-code-linking | codex | retrieval | Improved | -0.7 | -4.6 s |
| freshness-gate | codex | retrieval | Neutral | 0 | -2.1 s |
| oauth-code-guard | codex | e2e | Regressed | 0 | +1.5 s |
| zid-oauth | codex | retrieval | Regressed | +5.3 | +4.5 s |

Outcome labels (`Improved` / `Neutral` / `Regressed` / `Insufficient data`) are derived deterministically from tool-call and wall-time deltas; every cell is n=3/arm, so all are directional. Full per-metric tables: [benchmarks/published/campaign-2026-06-20.md](../../benchmarks/published/campaign-2026-06-20.md).

<!-- BENCH:END -->

Módszertan, környezet, mintaméretek, a metrikánkénti táblák és a korlátok:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — a `benchmarks/published/` mappában
található, becsekkolt, validált műtermékből generálva
[`benchmarks/published/`](../../benchmarks/published/).

---

## Támogatott szkennerek és rétegek

Minden nyelv/formátum egy verziózott **szkenner-bővítmény (plugin)** egyetlen
registry mögött (detect → scan → finalize): determinisztikus sorrend, fájlonkénti
hibaizoláció, explicit regisztráció és korlátozott fájlméretek.

| Nyelv / formátum | Kinyert adatok |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

Két szándékos kihagyás mindkét kódszkennerben: a metódusok/beágyazott függvények
soha nem külön csomópontok (egy metódus metaadatként utazik az osztályán), és az
ambiens deklarációs fájlokat (`.d.ts`, `.pyi`) soha nem igénylik. Részletek:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Adatvédelem és biztonság

- **Alapértelmezetten nincs hálózat.** A szkennelés és a lekérés olvassa az
  adattáradat, és JSON-t ír a `.kawn/` alá. Semmi nem hagyja el a gépet.
- **Nincs belső LLM.** A kódot, a dokumentációt és az SQL-t strukturálisan elemzi;
  az AI-gazdagítás opcionális (opt-in) és local-first.
- **Nincs telemetria. Alapértelmezetten nincs lekérdezésnaplózás.**
- **Csak olvasható MCP.** A szerver kiszolgálja a gráfot; soha nem szkennel, épít
  újra vagy ír — és nem hajlandó kiszolgálni olyan gráfot, amelynek a sémájában nem
  bízhat.
- **Visszafordítható, projektre korlátozott integrációk.** Atomi írások,
  időbélyegzett biztonsági másolatok, strukturált (nem string-alapú)
  konfigurációszerkesztések; soha nem szerkeszti a `CLAUDE.md` / `AGENTS.md` fájlt,
  alapértelmezetten soha nem nyúl a globális konfigurációhoz.

Teljes modell: **[docs/PRIVACY.md](../PRIVACY.md)**. Sebezhetőséget bizalmasan a
**[SECURITY.md](../../SECURITY.md)** fájlon keresztül jelents.

---

## Állapot és korlátok

A KawnGraph **aktív fejlesztés** alatt áll (`v0.1.0`, még nincs közzétéve az
npm-en). Végponttól végpontig megépítve és tesztelve: a code/data/config/docs/test
gráf, a dokumentáció-kód kapcsolatok, a módra korlátozott lekérdezés, a hatáselemzés,
a Git/PR hatás, a token-keretes Context Pack-ek, a Universal Context Protocol, a csak
olvasható MCP-szerver, az egyparancsos ágens-beállítás (Claude Code / Codex /
Cursor), a Studio és az A/B benchmark futtatókörnyezet.

**Őszinte korlátok.** A közzétett benchmark **feltáró jellegű (n<5 karonként —
irányadó, nem szignifikáns)**. A KawnGraph leginkább ismeretlen, több fájlt érintő
felderítésnél segít, és többletterhet adhat a már fókuszált, egyfájlos feladatoknál.
Még nincs megépítve: az opcionális, csak-javasló (suggest-only) horgok, a vizuális
réteg, a szemantikai/AI-gazdagítás és egy futásidejű réteg — mind tervezetten
opcionálisak. Lásd: [PROJECT_PLAN.md](../../PROJECT_PLAN.md) ·
[ARCHITECTURE.md](../../ARCHITECTURE.md) · [docs/FAQ.md](../FAQ.md) ·
[docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Dokumentáció

| Útmutató | Mi van benne |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | Telepítés, szkennelés, első Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | MCP-beállítási szerződés, visszafordíthatóság |
| [Context Packs](../CONTEXT_PACKS.md) | Rangsorolás, keretek, UCP wire-formátum |
| [Graph model](../GRAPH_MODEL.md) | Csomópontok, élek, rétegek, bizonyíték, azonosítók |
| [Scanners](../SCANNERS.md) | Mit nyer ki az egyes nyelvi bővítmények |
| [Benchmarks](../BENCHMARKS.md) | Módszertan, környezet, teljes eredmények |
| [Comparison](../COMPARISON.md) | Dátumozott, forrásokkal alátámasztott képesség-összehasonlítás |
| [Privacy](../PRIVACY.md) | Adathatárok rétegenként |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Gyakori problémák és kérdések |

---

## Közreműködés

A hozzájárulásokat szívesen fogadjuk. Építs forrásból, futtasd a tesztsorozatot, és
olvasd el az útmutatót:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Lásd a **[CONTRIBUTING.md](../../CONTRIBUTING.md)** fájlt a beállításért, a
konvenciókért és az adatvédelmi felülvizsgálatért, amelyen minden PR átesik; a
**[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** fájlt a közösségi elvárásokért; a
**[docs/i18n/TRANSLATING.md](TRANSLATING.md)** fájlt egy nyelv hozzáadásához vagy
felülvizsgálatához; és a **[SUPPORT.md](../../SUPPORT.md)** fájlt arról, hol lehet
kérdezni.

---

## Licenc és köszönetnyilvánítás

**[MIT](../../LICENSE)** © KawnGraph közreműködők.

A **Kawn** (arabul **كَوْن** — *kozmosz, univerzum, létezés*) egy adattárat élő
tudás-univerzumként kezel; a **Graph** a magjában lévő, bizonyítékkal alátámasztott
Agent Context Graph. Készült: [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/) és
[`@lezer/python`](https://lezer.codemirror.net/) felhasználásával.
