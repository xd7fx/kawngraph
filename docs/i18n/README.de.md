<!-- KAWN-TRANSLATION
lang: de
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

### Das Kontext-Universum für Agenten

**Ein Projekt-Universum. Jeder Coding-Agent.**

KawnGraph bildet Code, Dokumentation, Daten, Tests und Git-Änderungen in
evidenzgestützte **Context Packs** ab, damit Claude, Codex und Cursor die
richtigen Dateien erreichen, ohne das gesamte Repository zu lesen.

<!-- LANGBAR:START -->

[English](../../README.md) ·
[العربية](../../README.ar.md) ·
[Español](README.es.md) ·
[Français](README.fr.md) ·
**Deutsch** ·
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
[Dansk](README.da.md) ·
[Norsk](README.no.md) ·
[Magyar](README.hu.md) ·
[עברית](README.he.md)

<sub>English is canonical · العربية is AI-assisted · owner review pending · the other 29 languages are machine-assisted (human review needed) — see [translation status](STATUS.md).</sub>

<!-- LANGBAR:END -->

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA.svg?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/xd7fx)

</div>

> **Hinweis:** Diese Übersetzung ist maschinengestützt (machine-assisted) und
> kann Fehler enthalten. Maßgeblich ist das englische Original
> [README.md](../../README.md). Den Übersetzungsstatus findest du in
> [STATUS.md](STATUS.md).

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="Eine Aufgabe ('Den Zid-OAuth-Callback reparieren') fließt in KawnGraph, das ein token-budgetiertes Context Pack zurückgibt: Pflichtdateien, verwandte Dokumente, Tabellen, Tests, Risiken, eine Ausschlussliste und einen Konfidenzwert." width="860">
</div>

---

## Warum KawnGraph?

Wenn du einem Coding-Agenten eine Aufgabe gibst, beginnt er meist mit *Lesen* —
und zwar viel. Er öffnet Dutzende Dateien, leitet erneut her, wie Routen die
Datenbank erreichen, und baut bei jeder Anfrage dasselbe mentale Modell neu auf.
Das ist langsam, token-teuer und oft ungenau: Der Agent verpasst die eine Datei,
auf die es ankommt, und ertrinkt in fünf, auf die es nicht ankommt.

KawnGraph scannt das Repository **einmal**, baut einen geschichteten,
evidenzgestützten Graphen darüber auf, wie die Dinge zusammenhängen, und
antwortet dann für eine konkrete Aufgabe mit den **wenigen Dateien, auf die es
ankommt** — plus den relevanten Dokumenten, den verwandten Datenbanktabellen,
den auszuführenden Tests und den zu beobachtenden Risiken. Dieses Bündel ist ein
**Context Pack**. Der Graph ist das Substrat; das Context Pack ist das Produkt.

> **Gib Agenten die Karte, nicht das ganze Repo.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Schnellstart

> **Achtung:** Das npm-Paket `kawngraph` ist **noch nicht veröffentlicht**, daher
> ist `npx kawngraph …` heute *nicht* verfügbar. Nutze den Pfad aus dem
> Quellcode unten; der `npx`-Ablauf wird für **nach der Veröffentlichung**
> gezeigt.

**Heute — aus dem Quellcode** (dieses Monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Nach der npm-Veröffentlichung** (das angestrebte Ein-Befehl-Erlebnis):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Öffne dann deinen Agenten und beschreibe einfach deine Aufgabe — er zieht von
selbst die wenigen Dateien heran, auf die es ankommt. Keine API-Schlüssel, keine
Telemetrie, keine Netzwerkaufrufe während Scan oder Abruf. Neu hier? Beginne mit
**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Verbinde es mit deinem Coding-Agenten

Der Sinn von KawnGraph ist, dass der Agent **automatisch** zur Karte greift. Ein
einziger Befehl verdrahtet ein Projekt mit den von dir genutzten Agenten — ohne
`CLAUDE.md` oder `AGENTS.md` zu bearbeiten, und jede Änderung ist umkehrbar:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` erkennt **Claude Code**, **Codex** und **Cursor** und installiert eine
**schreibgeschützte (read-only) MCP-Integration**, die auf das Projekt begrenzt
ist (`.mcp.json`, `.cursor/mcp.json` oder `.codex/config.toml`), sichert alles,
was es berührt, und verifiziert den Server mit einem Live-Handshake. Vollständiger
Vertrag: **[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

Der **MCP-Server** ist schreibgeschütztes stdio-JSON-RPC ohne Abhängigkeiten und
mit vier Werkzeugen:

| Werkzeug | Was es tut |
| ---- | ------------ |
| `kawn_context` | Token-budgetiertes Context Pack für eine Aufgabe. |
| `kawn_query` | Gerankte, modus-begrenzte Suche über den Graphen. |
| `kawn_affected` | Rückwärts-Impact: was von einem Symbol abhängt. |
| `kawn_changes` | Impact des aktuellen Änderungssatzes (uncommitted, oder ein Branch gegen eine Basis-Ref). Nur lokales Git. |

Es **liest nur** den Graphen — es scannt, baut oder schreibt ihn nie (es warnt,
wenn der Graph veraltet wirkt, und verweist auf `kawn update`).

---

## So funktioniert es

Ein Projekt ist nicht nur Code. Es ist Code **und** Dokumentation **und** SQL
**und** Tests **und** die Konfiguration, die sie zusammenhält. KawnGraph
modelliert jedes davon als eigene **Schicht (Layer)**, damit eine Abfrage genau
das anfordert, was sie braucht, und nichts, was sie nicht braucht — eine
Code-Impact-Abfrage zieht nie Marketing-Dokumente herein; eine Dokumentations-
Abfrage liefert nie rohe Aufrufgraphen, es sei denn, du fragst danach.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph liest dein Repo mit deterministischen Scannern in einen geschichteten Graphen unter .kawn/graph.json (Schichten code, data, config, docs, test) und stellt ihn schreibgeschützt für die kawn-CLI, den MCP-Server und Studio bereit. Kein Netzwerk, kein LLM, keine Telemetrie." width="860">
</div>

| Schicht  | Beispiele                                           |
| -------- | --------------------------------------------------- |
| `code`   | files, functions, classes, imports, calls, routes   |
| `data`   | SQL tables, migrations, foreign keys                |
| `config` | workspace packages, dependencies                    |
| `docs`   | markdown sections, links, mentions                  |
| `test`   | tests and what they cover                           |

Jede Kante trägt **Evidenz** (Quellpfad, Zeilenbereich, Ausschnitt) und ein
Konfidenzniveau; jeder Knoten hat eine **stabile, inhaltsadressierbare ID**, damit
der Graph über Scans hinweg diff-bar bleibt. Tieferes Modell:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Ein Context Pack, von Anfang bis Ende

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

Dasselbe Pack ist als Markdown, JSON oder im agenten-neutralen **Universal
Context Protocol** verfügbar (`--format ucp` / `ucp-md`). Mehr:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` öffnet **KawnGraph Studio** — einen lokalen, **schreibgeschützten**
Explorer, der über `127.0.0.1` bereitgestellt wird, die vorhandene
`.kawn/graph.json` liest und niemals scannt, neu baut oder schreibt. Er bietet
einen interaktiven 2D-Graphen, eine skalierbare 3D-"Universe"-Sternenkarte
(budgetiert, sodass sie nie einen ganzen großen Graphen auf einmal zeichnet),
einen Context-Pack-Builder, Rückwärts-Impact, Ansichten für Git-Änderungen und
eine Ansicht für Verhaltens-Benchmarks. Gebaut in Englisch und Arabisch
(RTL-fähig). Starte ihn aus dem Quellcode mit `pnpm studio:build &&
pnpm kawn map`.

> Ein erfasster Studio-Screenshot wird nach dem nächsten Visual-Capture-Durchlauf
> zu `docs/assets/` hinzugefügt; bis dahin sind die obigen Diagramme die
> maßgeblichen Visuals.

---

## KawnGraph vs. einfache Repository-Suche

Ein neutraler Vergleich von *Ansätzen* (kein Angriff auf Wettbewerber). Jede
Zelle ist belegbar; "varies" bedeutet, dass es vom konkreten Werkzeug abhängt.

| Fähigkeit | Plain search | General RAG | Generic graph viewer | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministischer lokaler Scan | ✅ | varies | ✅ | ✅ |
| Beziehungen auf Symbolebene | ❌ | varies | ✅ | ✅ |
| Schichten für Docs / Daten / Tests | ❌ | varies | varies | ✅ |
| Evidenz auf jeder Kante | ❌ | ❌ | varies | ✅ |
| Begrenzte Impact-Analyse | ❌ | ❌ | varies | ✅ |
| Kontext aus Git-Änderungen | varies | ❌ | ❌ | ✅ |
| Token-budgetierte Context Packs | ❌ | varies | ❌ | ✅ |
| Schreibgeschützter MCP-Abruf | ❌ | varies | varies | ✅ |
| Kein internes LLM erforderlich | ✅ | ❌ | ✅ | ✅ |

Ein datierter, mit Quellen belegter Drei-Spalten-Vergleich gegen ein ausgereiftes
Graph-Werkzeug (Fähigkeiten, bei denen KawnGraph führt, **und** solche, bei denen
es das nicht tut) findet sich in **[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmarks

KawnGraph liefert ein **lokales A/B-Harness**, das *denselben* Agenten an
*derselben* Aufgabe **mit vs. ohne** KawnGraph ausführt und das Verhalten
aufzeichnet. Die Ergebnisse sind ehrlich und **aufgabenabhängig** — einschließlich
neutraler und negativer Fälle.

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

Methodik, Umgebung, Stichprobengrößen, die Tabellen pro Metrik und die
Einschränkungen: **[docs/BENCHMARKS.md](../BENCHMARKS.md)** — generiert aus dem
eingecheckten, validierten Artefakt in
[`benchmarks/published/`](../../benchmarks/published/).

---

## Unterstützte Scanner & Schichten

Jede Sprache/jedes Format ist ein versioniertes **Scanner-Plugin** hinter einer
Registry (detect → scan → finalize): deterministische Reihenfolge, Fehler-
isolation pro Datei, explizite Registrierung und begrenzte Dateigrößen.

| Sprache / Format | Extrahiert |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

Zwei bewusste Auslassungen in beiden Code-Scannern: Methoden/verschachtelte
Funktionen sind nie eigene Knoten (eine Methode reist als Metadaten auf ihrer
Klasse mit), und Ambient-Deklarationsdateien (`.d.ts`, `.pyi`) werden nie
beansprucht. Details: **[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Datenschutz & Sicherheit

- **Standardmäßig kein Netzwerk.** Scan und Abruf lesen dein Repo und schreiben
  JSON unter `.kawn/`. Nichts verlässt die Maschine.
- **Kein internes LLM.** Code, Dokumentation und SQL werden strukturell geparst;
  KI-Anreicherung ist opt-in und local-first.
- **Keine Telemetrie. Standardmäßig kein Logging von Abfragen.**
- **Schreibgeschütztes MCP.** Der Server stellt den Graphen bereit; er scannt,
  baut oder schreibt ihn nie — und weigert sich, einen Graphen mit einem Schema
  bereitzustellen, dem er nicht vertrauen kann.
- **Umkehrbare, projektbegrenzte Integrationen.** Atomare Schreibvorgänge,
  zeitgestempelte Backups, strukturierte (nicht string-basierte)
  Konfigurationsänderungen; bearbeitet nie `CLAUDE.md` / `AGENTS.md`, fasst
  standardmäßig nie globale Konfiguration an.

Vollständiges Modell: **[docs/PRIVACY.md](../PRIVACY.md)**. Melde eine
Sicherheitslücke vertraulich über **[SECURITY.md](../../SECURITY.md)**.

---

## Status & Einschränkungen

KawnGraph befindet sich in **aktiver Entwicklung** (`v0.1.0`, noch nicht auf npm
veröffentlicht). Durchgängig gebaut und getestet: der Graph aus
code/data/config/docs/test, Docs-zu-Code-Verknüpfungen, modus-begrenzte Abfrage,
Impact-Analyse, Git-/PR-Impact, token-budgetierte Context Packs, das Universal
Context Protocol, der schreibgeschützte MCP-Server, das Ein-Befehl-Agenten-Setup
(Claude Code / Codex / Cursor), Studio und das A/B-Benchmark-Harness.

**Ehrliche Grenzen.** Der veröffentlichte Benchmark ist **explorativ (n<5 pro Arm
— richtungsweisend, nicht signifikant)**. KawnGraph hilft am meisten bei
unbekannter Mehrdatei-Erkundung und kann bei bereits fokussierten Einzeldatei-
Aufgaben Mehraufwand verursachen. Noch nicht gebaut: opt-in Suggest-only-Hooks,
die visuelle Schicht, semantische/KI-Anreicherung und eine Laufzeitschicht — alle
opt-in by design. Siehe [PROJECT_PLAN.md](../../PROJECT_PLAN.md) ·
[ARCHITECTURE.md](../../ARCHITECTURE.md) · [docs/FAQ.md](../FAQ.md) ·
[docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Dokumentation

| Leitfaden | Was drin ist |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | Installieren, scannen, erstes Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | MCP-Setup-Vertrag, Umkehrbarkeit |
| [Context Packs](../CONTEXT_PACKS.md) | Ranking, Budgets, UCP-Wire-Format |
| [Graph model](../GRAPH_MODEL.md) | Knoten, Kanten, Schichten, Evidenz, IDs |
| [Scanners](../SCANNERS.md) | Was jedes Sprach-Plugin extrahiert |
| [Benchmarks](../BENCHMARKS.md) | Methodik, Umgebung, vollständige Ergebnisse |
| [Comparison](../COMPARISON.md) | Datierter, mit Quellen belegter Fähigkeitsvergleich |
| [Privacy](../PRIVACY.md) | Datengrenzen pro Schicht |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Häufige Probleme & Fragen |

---

## Mitwirken

Beiträge sind willkommen. Baue aus dem Quellcode, führe die Suite aus und lies den
Leitfaden:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Siehe **[CONTRIBUTING.md](../../CONTRIBUTING.md)** für Setup, Konventionen und das
Datenschutz-Review, das jeder PR durchläuft; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)**
für die Erwartungen an die Community; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**,
um eine Sprache hinzuzufügen oder zu prüfen; und **[SUPPORT.md](../../SUPPORT.md)**
dafür, wo man Fragen stellen kann.

---

## Lizenz & Danksagungen

**[MIT](../../LICENSE)** © KawnGraph-Mitwirkende.

**Kawn** (arabisch **كَوْن** — *Kosmos, Universum, Existenz*) behandelt ein
Repository als ein lebendiges Wissensuniversum; **Graph** ist der
evidenzgestützte Agent Context Graph in seinem Kern. Gebaut mit
[TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/),
[React](https://react.dev/), [React Flow](https://reactflow.dev/),
[Three.js](https://threejs.org/), und
[`@lezer/python`](https://lezer.codemirror.net/).
