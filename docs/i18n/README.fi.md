<!-- KAWN-TRANSLATION
lang: fi
status: machine-assisted
canonical: README.md
canonical-sha: 4ee6b7e69d4b76a495518d81d0f489290e0a9a198ba47984ed732e6cb691ea6c
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### Agentin kontekstiuniversumi

**Yksi projektin universumi. Jokainen koodausagentti.**

[English](../../README.md) · [العربية](../../README.ar.md) · [Suomi] (nykyinen) · [käännösten tila](STATUS.md)

> Tämä käännös on konetekoinen ja voi sisältää virheitä. Kanoninen englanninkielinen versio on [README.md](../../README.md); katso [käännösten tila](STATUS.md).

</div>

---

## Miksi KawnGraph?

KawnGraph kartoittaa koodin, dokumentaation, datan, testit ja Git-muutokset
todisteilla tuetuiksi **Context Pack** -paketeiksi, jotta Claude, Codex ja Cursor
löytävät oikeat tiedostot lukematta koko repositoriota.

Kun annat koodausagentille tehtävän, se yleensä aloittaa *lukemalla* — paljon.
Se avaa kymmeniä tiedostoja, päättelee uudelleen miten reitit pääsevät
tietokantaan ja rakentaa saman mentaalisen mallin joka pyynnöllä. Se on hidasta,
token-kallista ja usein epätarkkaa: agentti ohittaa sen yhden tiedoston jolla on
merkitystä ja hukkuu viiteen joilla ei ole.

KawnGraph skannaa repositorion **kerran**, rakentaa kerrostetun, todisteilla
tuetun graafin siitä miten asiat liittyvät toisiinsa, ja vastaa sitten tiettyyn
tehtävään niillä **harvoilla tiedostoilla joilla on merkitystä** — sekä
asiaankuuluvalla dokumentaatiolla, liittyvillä tietokantatauluilla, ajettavilla
testeillä ja vaaroilla joita on syytä tarkkailla. Tuo nippu on **Context Pack**.
Graafi on alusta; Context Pack on tuote.

> **Anna agenteille kartta, ei koko repositoriota.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Pika-aloitus

> **Huomio:** `kawngraph`-npm-paketti **ei ole vielä julkaistu**, joten
> `npx kawngraph …` *ei* ole tällä hetkellä saatavilla. Käytä alla olevaa
> lähdekoodista ajettavaa polkua; `npx`-kulku näytetään **julkaisun jälkeistä**
> käyttöä varten.

**Tänään — lähdekoodista** (tämä monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Npm-julkaisun jälkeen** (tarkoitettu yhden komennon kokemus):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Avaa sitten agenttisi ja kuvaile vain tehtäväsi — se hakee itse ne harvat
tiedostot joilla on merkitystä. Ei API-avaimia, ei telemetriaa, ei
verkkokutsuja skannauksen tai haun aikana. Uusi käyttäjä? Aloita tästä:
**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Yhdistä se koodausagenttiisi

KawnGraphin idea on, että agentti tarttuu karttaan **automaattisesti**. Yksi
komento kytkee projektin käyttämiisi agentteihin — muokkaamatta tiedostoja
`CLAUDE.md` tai `AGENTS.md`, ja jokainen muutos on peruutettavissa:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` tunnistaa **Claude Coden**, **Codexin** ja **Cursorin** ja asentaa
projektiin rajatun **vain luku -MCP-integraation** (`.mcp.json`,
`.cursor/mcp.json` tai `.codex/config.toml`), varmuuskopioiden kaiken mihin se
koskee ja varmistaen palvelimen elävällä kättelyllä. Täysi sopimus:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**MCP-palvelin** on vain luku -tilainen stdio-JSON-RPC ilman riippuvuuksia ja neljällä työkalulla:

| Työkalu | Mitä se tekee |
| ---- | ------------ |
| `kawn_context` | Token-budjetoitu Context Pack tehtävää varten. |
| `kawn_query` | Pisteytetty, tila-rajattu haku graafista. |
| `kawn_affected` | Käänteisvaikutus: mikä riippuu symbolista. |
| `kawn_changes` | Nykyisen muutosjoukon vaikutus (committoimaton, tai haara verrattuna perusviitteeseen). Vain paikallinen git. |

Se **vain lukee** graafia — se ei koskaan skannaa, rakenna uudelleen tai
kirjoita sitä (se varoittaa kun graafi näyttää vanhentuneelta ja ohjaa
komentoon `kawn update`).

---

## Miten se toimii

Projekti ei ole pelkkää koodia. Se on koodia **ja** dokumentaatiota **ja** SQL:ää
**ja** testejä **ja** sitä konfiguraatiota joka sitoo ne yhteen. KawnGraph
mallintaa jokaisen erillisenä **kerroksena**, joten kysely pyytää täsmälleen
sen mitä se tarvitsee eikä mitään mitä se ei tarvitse — koodivaikutuskysely ei
koskaan vedä mukaansa markkinointidokumentteja; dokumentaatiokysely ei koskaan
palauta raakoja kutsugraafeja ellet pyydä.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph lukee repositoriosi deterministisillä skannereilla yhteen kerrostettuun graafiin tiedostossa .kawn/graph.json (koodi-, data-, config-, docs- ja test-kerrokset), tarjottuna vain luku -tilassa kawn-CLI:lle, MCP-palvelimelle ja Studiolle. Ei verkkoa, ei LLM:ää, ei telemetriaa." width="860">
</div>

| Kerros    | Esimerkkejä                                            |
| -------- | --------------------------------------------------- |
| `code`   | tiedostot, funktiot, luokat, importit, kutsut, reitit   |
| `data`   | SQL-taulut, migraatiot, vierasavaimet                |
| `config` | workspace-paketit, riippuvuudet                    |
| `docs`   | markdown-osiot, linkit, maininnat                  |
| `test`   | testit ja se mitä ne kattavat                           |

Jokainen kaari kantaa **todisteita** (lähdepolku, riviväli, katkelma) ja
luottamustason; jokaisella solmulla on **vakaa, sisältöosoitteinen ID** jotta
graafi pysyy vertailtavana skannausten välillä. Syvempi malli:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Context Pack, alusta loppuun

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

Sama paketti on saatavilla Markdownina, JSON:na tai agenttineutraalina
**Universal Context Protocol** -muotona (`--format ucp` / `ucp-md`). Lisää:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` avaa **KawnGraph Studion** — paikallisen, **vain luku** -selaimen
joka tarjoillaan osoitteessa `127.0.0.1`, lukee olemassa olevan
`.kawn/graph.json`-tiedoston eikä koskaan skannaa, rakenna uudelleen tai
kirjoita. Se tarjoaa interaktiivisen 2D-graafin, skaalautuvan 3D-"Universe"-
tähtikartan (budjetoitu niin ettei se koskaan piirrä koko suurta graafia
kerralla), Context Pack -rakentajan, käänteisvaikutuksen, Git-muutosnäkymät ja
käyttäytymisen benchmark-näkymän. Rakennettu englanniksi ja arabiaksi
(RTL-tietoinen). Aja se lähdekoodista komennolla `pnpm studio:build &&
pnpm kawn map`.

> Studiosta kaapattu kuvakaappaus lisätään hakemistoon `docs/assets/` seuraavan
> visuaalisen kaappauskierroksen jälkeen; siihen asti yllä olevat kaaviot ovat
> kanoniset visuaalit.

---

## KawnGraph vs. tavallinen repositoriohaku

Neutraali vertailu *lähestymistavoista* (ei hyökkäys kilpailijoita kohtaan).
Jokainen solu on puolustettavissa; "vaihtelee" tarkoittaa että se riippuu
tietystä työkalusta.

| Ominaisuus | Tavallinen haku | Yleinen RAG | Yleiskäyttöinen graafikatselin | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministinen paikallinen skannaus | ✅ | vaihtelee | ✅ | ✅ |
| Symbolitason suhteet | ❌ | vaihtelee | ✅ | ✅ |
| Docs- / data- / test-kerrokset | ❌ | vaihtelee | vaihtelee | ✅ |
| Todisteet jokaisella kaarella | ❌ | ❌ | vaihtelee | ✅ |
| Rajattu vaikutusanalyysi | ❌ | ❌ | vaihtelee | ✅ |
| Git-muutoskonteksti | vaihtelee | ❌ | ❌ | ✅ |
| Token-budjetoidut Context Packit | ❌ | vaihtelee | ❌ | ✅ |
| Vain luku -MCP-haku | ❌ | vaihtelee | vaihtelee | ✅ |
| Ei sisäistä LLM:ää vaadita | ✅ | ❌ | ✅ | ✅ |

Päivätty, lähteistetty, kolmisarakkeinen vertailu kypsää graafityökalua vastaan
(ominaisuudet joissa KawnGraph johtaa **ja** ne joissa se ei johda) löytyy
tiedostosta **[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmarkit

KawnGraph sisältää **paikallisen A/B-valjaiston** joka ajaa *saman* agentin
*samalla* tehtävällä **KawnGraphin kanssa ja ilman** ja kirjaa käyttäytymisen.
Tulokset ovat rehellisiä ja **tehtäväriippuvaisia** — mukaan lukien neutraalit
ja negatiiviset tapaukset.

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

Metodologia, ympäristö, otoskoot, mittarikohtaiset taulukot ja rajoitukset:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — generoitu committoidusta,
validoidusta artefaktista hakemistossa [`benchmarks/published/`](../../benchmarks/published/).

---

## Tuetut skannerit ja kerrokset

Jokainen kieli/formaatti on versioitu **skanneri-plugin** yhden rekisterin
takana (tunnista → skannaa → viimeistele): deterministinen järjestys,
tiedostokohtainen virheiden eristys, eksplisiittinen rekisteröinti ja rajatut
tiedostokoot.

| Kieli / formaatti | Poimittu |
| ----------------- | --------- |
| TypeScript / JS   | tiedostot, ylimmän tason funktiot/luokat, importit, kutsut, Next.js-reitit, testit |
| Python            | ylimmän tason `def`/`async def`/`class`, dekoraattorit, metodit (metatietona), importit, FastAPI/Flask-reitit, docstringit, testit (kirjastolla `@lezer/python` — puhdas JS, virheitä sietävä) |
| SQL               | taulut (`CREATE`/`ALTER`), vierasavainsuhteet |
| package.json      | workspace-paketit ja sisäiset riippuvuudet |
| Markdown          | otsikot/osiot linkitettyinä koodiin, SQL:ään ja reitteihin |

Kaksi tarkoituksellista poikkeusta molemmissa koodiskannereissa:
metodit/sisäkkäiset funktiot eivät koskaan ole erillisiä solmuja (metodi kulkee
luokkansa mukana metatietona), eikä ambient-määrittelytiedostoja
(`.d.ts`, `.pyi`) koskaan vaadita omikseen. Lisätietoja:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Yksityisyys ja turvallisuus

- **Ei verkkoa oletuksena.** Skannaus ja haku lukevat repositoriosi ja
  kirjoittavat JSON:n hakemistoon `.kawn/`. Mikään ei poistu koneelta.
- **Ei sisäistä LLM:ää.** Koodi, dokumentaatio ja SQL jäsennetään
  rakenteellisesti; tekoälyrikastus on valinnaista ja local-first.
- **Ei telemetriaa. Ei kyselylokia oletuksena.**
- **Vain luku -MCP.** Palvelin tarjoilee graafin; se ei koskaan skannaa,
  rakenna uudelleen tai kirjoita — ja kieltäytyy tarjoilemasta graafia jonka
  skeemaan se ei voi luottaa.
- **Peruutettavat, projektiin rajatut integraatiot.** Atomiset kirjoitukset,
  aikaleimatut varmuuskopiot, rakenteelliset (ei merkkijono-) konfiguraatio-
  muokkaukset; ei koskaan muokkaa tiedostoja `CLAUDE.md` / `AGENTS.md`, ei
  koskaan koske globaaliin konfiguraatioon oletuksena.

Täysi malli: **[docs/PRIVACY.md](../PRIVACY.md)**. Ilmoita haavoittuvuudesta
yksityisesti tämän kautta: **[SECURITY.md](../../SECURITY.md)**.

---

## Tila ja rajoitukset

KawnGraph on **aktiivisessa kehityksessä** (`v0.1.0`, ei vielä julkaistu
npm:ään). Rakennettu ja testattu päästä päähän: koodi/data/config/docs/test-
graafi, docs-koodi-linkit, tila-rajattu kysely, vaikutusanalyysi, Git/PR-
vaikutus, token-budjetoidut Context Packit, Universal Context Protocol, vain luku
-MCP-palvelin, yhden komennon agenttiasennus (Claude Code / Codex / Cursor),
Studio ja A/B-benchmark-valjaisto.

**Rehelliset rajat.** Julkaistu benchmark on **eksploratiivinen (n<5 per haara —
suuntaa-antava, ei merkitsevä)**. KawnGraph auttaa eniten tuntemattomassa
monitiedostoisessa löytämisessä ja voi lisätä yleisrasitetta jo
keskittyneissä yksitiedostotehtävissä. Ei vielä rakennettu: valinnaiset
vain-ehdota-koukut, visuaalinen kerros, semanttinen/tekoälyrikastus ja
ajonaikainen kerros — kaikki valinnaisia suunnittelultaan. Katso
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Dokumentaatio

| Opas | Mitä sisällä |
| ----- | ------------- |
| [Pääsy alkuun](../GETTING_STARTED.md) | Asenna, skannaa, ensimmäinen Context Pack |
| [Agentti-integraatio](../AGENT_INTEGRATION.md) | MCP-asennussopimus, peruutettavuus |
| [Context Packit](../CONTEXT_PACKS.md) | Pisteytys, budjetit, UCP-johdinmuoto |
| [Graafimalli](../GRAPH_MODEL.md) | Solmut, kaaret, kerrokset, todisteet, ID:t |
| [Skannerit](../SCANNERS.md) | Mitä kunkin kielen plugin poimii |
| [Benchmarkit](../BENCHMARKS.md) | Metodologia, ympäristö, täydet tulokset |
| [Vertailu](../COMPARISON.md) | Päivätty, lähteistetty ominaisuusvertailu |
| [Yksityisyys](../PRIVACY.md) | Datarajat kerroksittain |
| [Vianetsintä](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Yleiset ongelmat ja kysymykset |

---

## Osallistuminen

Osallistumiset ovat tervetulleita. Rakenna lähdekoodista, aja sviitti ja lue opas:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Katso **[CONTRIBUTING.md](../../CONTRIBUTING.md)** asennusta, konventioita ja
yksityisyystarkistusta varten jonka jokainen PR läpäisee;
**[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** yhteisön odotuksia varten;
**[docs/i18n/TRANSLATING.md](TRANSLATING.md)** kielen lisäämistä tai
tarkistamista varten; ja **[SUPPORT.md](../../SUPPORT.md)** siihen mistä kysyä
kysymyksiä.

---

## Lisenssi ja kiitokset

**[MIT](../../LICENSE)** © KawnGraphin osallistujat.

**Kawn** (arabiaksi **كَوْن** — *kosmos, universumi, olemassaolo*) kohtelee
repositoriota elävänä tiedon universumina; **Graph** on sen ytimessä oleva
todisteilla tuettu Agent Context Graph. Rakennettu työkaluilla
[TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/),
[React](https://react.dev/), [React Flow](https://reactflow.dev/),
[Three.js](https://threejs.org/) ja [`@lezer/python`](https://lezer.codemirror.net/).
