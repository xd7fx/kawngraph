<!-- KAWN-TRANSLATION
lang: el
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

### Το Σύμπαν Συμφραζομένων του Agent

**Ένα σύμπαν για κάθε project. Κάθε agent προγραμματισμού.**

Το KawnGraph χαρτογραφεί τον κώδικα, τα docs, τα δεδομένα, τα tests, και τις
αλλαγές Git σε **Context Packs** με τεκμήρια (evidence), ώστε το Claude, το Codex,
και το Cursor να φτάνουν στα σωστά αρχεία χωρίς να διαβάζουν ολόκληρο το repository.

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
**Ελληνικά** ·
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

> Αυτή η μετάφραση είναι υποβοηθούμενη από μηχανή (machine-assisted) και μπορεί να περιέχει σφάλματα. Το κανονικό (canonical) κείμενο στα Αγγλικά είναι το [README.md](../../README.md)· δείτε το [STATUS.md](STATUS.md).

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="Μια εργασία («Διόρθωσε το callback του Zid OAuth») ρέει μέσα στο KawnGraph, το οποίο επιστρέφει ένα Context Pack με budget από tokens: αρχεία απαραίτητα προς ανάγνωση, σχετικά docs, πίνακες, tests, κίνδυνους, μια λίστα εξαιρέσεων, και ένα σκορ εμπιστοσύνης." width="860">
</div>

---

## Γιατί KawnGraph;

Όταν αναθέτετε μια εργασία σε έναν agent προγραμματισμού, συνήθως ξεκινά *διαβάζοντας* — πολλά. Ανοίγει δεκάδες αρχεία, ξανα-υπολογίζει πώς τα routes φτάνουν στη βάση δεδομένων, και ανακατασκευάζει το ίδιο νοητικό μοντέλο σε κάθε αίτημα. Αυτό είναι αργό, ακριβό σε tokens, και συχνά ανακριβές: ο agent χάνει το ένα αρχείο που έχει σημασία και πνίγεται σε πέντε που δεν έχουν.

Το KawnGraph σαρώνει το repository **μία φορά**, κατασκευάζει έναν πολυεπίπεδο γράφο με τεκμήρια (evidence) για το πώς συνδέονται τα πράγματα, και στη συνέχεια απαντά, για μια συγκεκριμένη εργασία, με τα **λίγα αρχεία που έχουν σημασία** — μαζί με τα σχετικά docs, τους σχετικούς πίνακες της βάσης δεδομένων, τα tests που πρέπει να τρέξετε, και τους κινδύνους που πρέπει να προσέξετε. Αυτό το πακέτο είναι ένα **Context Pack**. Ο γράφος είναι το υπόστρωμα· το Context Pack είναι το προϊόν.

> **Δώστε στους agents τον χάρτη, όχι το repo.**

---

## Γρήγορη εκκίνηση

Εγκαταστήστε και τρέξτε το KawnGraph με **μία εντολή** — το `npx` το κατεβάζει,
χωρίς να χρειάζεται κλωνοποίηση (Node ≥ 18):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

**Ή από τον πηγαίο κώδικα** (αυτό το monorepo, για συνεισφέροντες — [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

Στη συνέχεια ανοίξτε τον agent σας και απλώς περιγράψτε την εργασία σας — τραβάει μόνος του τα λίγα αρχεία που έχουν σημασία. Χωρίς API keys, χωρίς telemetry, χωρίς κλήσεις δικτύου κατά τη σάρωση ή την ανάκτηση. Νέοι σε αυτό; Ξεκινήστε με το **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Συνδέστε το με τον agent προγραμματισμού σας

Το νόημα του KawnGraph είναι ότι ο agent φτάνει στον χάρτη **αυτόματα**. Μία εντολή συνδέει ένα project με τους agents που χρησιμοποιείτε — χωρίς επεξεργασία του `CLAUDE.md` ή του `AGENTS.md`, με κάθε αλλαγή αναστρέψιμη:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

Το `setup` εντοπίζει τους agents προγραμματισμού σας — **Claude Code**, **Codex**, **Cursor**, **Copilot**, **Gemini CLI**, και **Aider** (συν ένα `generic` export σε Markdown/JSON και ένα προαιρετικό **τοπικό LLM**) — και εγκαθιστά μια **read-only integration** περιορισμένη στο project (`.mcp.json`, `.cursor/mcp.json`, `.codex/config.toml`, `.vscode/mcp.json`, `.gemini/settings.json`, ή ένα αρχείο συμφραζομένων Aider), δημιουργώντας αντίγραφο ασφαλείας οτιδήποτε αγγίζει και επαληθεύοντας κάθε MCP server με μια ζωντανή χειραψία (handshake). Πλήρες συμβόλαιο: **[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

Ο **MCP server** είναι ένας read-only stdio JSON-RPC βρόχος **χωρίς MCP SDK** (γραμμένος στο χέρι) με τέσσερα εργαλεία:

| Εργαλείο | Τι κάνει |
| ---- | ------------ |
| `kawn_context` | Context Pack με budget από tokens για μια εργασία. |
| `kawn_query` | Κατατασσόμενη (ranked), περιορισμένη ανά mode αναζήτηση στον γράφο. |
| `kawn_affected` | Αντίστροφος αντίκτυπος: τι εξαρτάται από ένα σύμβολο. |
| `kawn_changes` | Αντίκτυπος του τρέχοντος συνόλου αλλαγών (uncommitted, ή ένα branch έναντι ενός base ref). Μόνο τοπικό git. |

**Μόνο διαβάζει** τον γράφο — ποτέ δεν σαρώνει, ανακατασκευάζει, ή γράφει σε αυτόν (προειδοποιεί όταν ο γράφος φαίνεται παρωχημένος και παραπέμπει στο `kawn update`).

---

## Πώς Λειτουργεί

Ένα project δεν είναι μόνο κώδικας. Είναι κώδικας **και** docs **και** SQL **και** tests **και** η διαμόρφωση (configuration) που τα δένει όλα μαζί. Το KawnGraph μοντελοποιεί το καθένα ως ξεχωριστό **layer**, ώστε ένα query να ζητά ακριβώς αυτό που χρειάζεται και τίποτα που δεν χρειάζεται — ένα query αντικτύπου κώδικα δεν σέρνει ποτέ μέσα marketing docs· ένα query docs δεν επιστρέφει ποτέ ακατέργαστα call graphs εκτός αν το ζητήσετε.

<div align="center">
<img src="../assets/architecture.svg" alt="Το KawnGraph διαβάζει το repo σας με ντετερμινιστικούς scanners σε έναν ενιαίο πολυεπίπεδο γράφο στο .kawn/graph.json (layers code, data, config, docs, test), που σερβίρεται read-only στο kawn CLI, στον MCP server, και στο Studio. Χωρίς δίκτυο, χωρίς LLM, χωρίς telemetry." width="860">
</div>

| Layer    | Παραδείγματα                                            |
| -------- | --------------------------------------------------- |
| `code`   | files, functions, classes, imports, calls, routes   |
| `data`   | SQL tables, migrations, foreign keys                |
| `config` | workspace packages, dependencies                    |
| `docs`   | markdown sections, links, mentions                  |
| `test`   | tests and what they cover                           |

Κάθε edge φέρει **τεκμήριο (evidence)** (source path, εύρος γραμμών, snippet) και ένα επίπεδο εμπιστοσύνης (confidence) — μηχανικά παραγόμενο εκεί όπου ο scanner μπορεί να το επισυνάψει· κάθε node έχει ένα **σταθερό, content-addressable ID** ώστε ο γράφος να παραμένει diffable μεταξύ σαρώσεων. Βαθύτερο μοντέλο: **[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Ένα Context Pack, από άκρη σε άκρη

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

Το ίδιο pack είναι διαθέσιμο ως Markdown, JSON, ή το ανεξάρτητο από agent **Universal Context Protocol** (`--format ucp` / `ucp-md`). Περισσότερα: **[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

Το `kawn map` ανοίγει το **KawnGraph Studio** — έναν τοπικό, **read-only** explorer που σερβίρεται μέσω `127.0.0.1`, ο οποίος διαβάζει το υπάρχον `.kawn/graph.json` και ποτέ δεν σαρώνει, ανακατασκευάζει, ή γράφει. Προσφέρει έναν διαδραστικό 2D γράφο, έναν κλιμακούμενο 3D "Universe" χάρτη αστεριών (με budget ώστε να μην σχεδιάζει ποτέ έναν ολόκληρο μεγάλο γράφο ταυτόχρονα), έναν Context-Pack builder, αντίστροφο αντίκτυπο, προβολές αλλαγών Git, και μια προβολή συμπεριφορικού benchmark. Φτιαγμένο στα Αγγλικά και τα Αραβικά (με επίγνωση RTL). Τρέξτε το από τον πηγαίο κώδικα με `pnpm studio:build && pnpm kawn map`.

<div align="center">
<img src="../assets/studio-universe.webp" alt="KawnGraph Studio — η read-only 3D προβολή «Universe» του ίδιου του γράφου αυτού του repository: 1.261 nodes ομαδοποιημένα ανά layer (Code 815, Docs 430, Config 13, Data 3) με γραμμές σύνδεσης, συν φίλτρα ανά layer/type/edge." width="860">
<br><sub>Η 3D προβολή <b>Universe</b> — ο ίδιος ο γράφος αυτού του repository (1.261 nodes), read-only.</sub>
</div>

<div align="center">
<img src="../assets/studio-map.webp" alt="KawnGraph Studio — η 2D προβολή γράφου του ενσωματωμένου παραδείγματος project: αρχεία, functions, routes, πίνακες, και docs ως nodes με επισημασμένα edges που φέρουν τεκμήρια (imports, calls, defines, mentions, explains), συν φίλτρα layer/type/edge." width="860">
<br><sub>Η 2D προβολή <b>γράφου</b> — το ενσωματωμένο παράδειγμα project, με φίλτρα layer / type / edge.</sub>
</div>

---

## KawnGraph vs. απλή αναζήτηση repository

Μια ουδέτερη σύγκριση *προσεγγίσεων* (όχι επίθεση σε ανταγωνιστή). Κάθε κελί είναι υπερασπίσιμο· "varies" σημαίνει ότι εξαρτάται από το συγκεκριμένο εργαλείο.

| Δυνατότητα | Απλή αναζήτηση | Γενικό RAG | Γενικός graph viewer | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Ντετερμινιστική τοπική σάρωση | ✅ | varies | ✅ | ✅ |
| Σχέσεις σε επίπεδο συμβόλου | ❌ | varies | ✅ | ✅ |
| Layers docs / data / test | ❌ | varies | varies | ✅ |
| Τεκμήριο σε κάθε edge | ❌ | ❌ | varies | ✅ |
| Οριοθετημένη ανάλυση αντικτύπου | ❌ | ❌ | varies | ✅ |
| Συμφραζόμενα αλλαγών Git | varies | ❌ | ❌ | ✅ |
| Context Packs με budget από tokens | ❌ | varies | ❌ | ✅ |
| Read-only MCP ανάκτηση | ❌ | varies | varies | ✅ |
| Δεν απαιτείται εσωτερικό LLM | ✅ | ❌ | ✅ | ✅ |

Μια χρονολογημένη, με πηγές, σύγκριση τριών στηλών έναντι ενός ώριμου εργαλείου γράφων (δυνατότητες στις οποίες το KawnGraph προηγείται **και** δυνατότητες στις οποίες δεν προηγείται) βρίσκεται στο **[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Μετρήσεις επιδόσεων

Το KawnGraph περιλαμβάνει ένα **τοπικό A/B harness** που τρέχει τον *ίδιο* agent στην *ίδια* εργασία **με και χωρίς** KawnGraph και καταγράφει τη συμπεριφορά. Τα αποτελέσματα είναι ειλικρινή και **εξαρτώνται από την εργασία** — συμπεριλαμβανομένων ουδέτερων και αρνητικών περιπτώσεων.

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

Μεθοδολογία, περιβάλλον, μεγέθη δείγματος, οι πίνακες ανά μετρική, και περιορισμοί: **[docs/BENCHMARKS.md](../BENCHMARKS.md)** — δημιουργούνται από το committed, επικυρωμένο artifact στο [`benchmarks/published/`](../../benchmarks/published/).

---

## Υποστηριζόμενοι scanners & layers

Κάθε γλώσσα/μορφή είναι ένα versioned **scanner plugin** πίσω από ένα μητρώο (detect → scan → finalize): ντετερμινιστική σειρά, απομόνωση αποτυχίας ανά αρχείο, ρητή εγγραφή, και οριοθετημένα μεγέθη αρχείων.

| Γλώσσα / μορφή | Εξαγόμενα |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

Δύο σκόπιμες παραλείψεις και στους δύο scanners κώδικα: methods/nested functions δεν είναι ποτέ ξεχωριστά nodes (μια method ταξιδεύει πάνω στην class της ως metadata), και ambient declaration files (`.d.ts`, `.pyi`) δεν διεκδικούνται ποτέ. Λεπτομέρειες: **[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Ιδιωτικότητα & ασφάλεια

- **Χωρίς δίκτυο από προεπιλογή.** Η σάρωση και η ανάκτηση διαβάζουν το repo σας και γράφουν JSON
  κάτω από το `.kawn/`. Τίποτα δεν φεύγει από το μηχάνημα.
- **Χωρίς εσωτερικό LLM.** Ο κώδικας, τα docs, και το SQL αναλύονται δομικά· ο εμπλουτισμός με AI
  είναι opt-in και local-first.
- **Χωρίς telemetry. Χωρίς καταγραφή query από προεπιλογή.**
- **Read-only MCP.** Ο server σερβίρει τον γράφο· ποτέ δεν σαρώνει, ανακατασκευάζει, ή
  γράφει — και αρνείται να σερβίρει έναν γράφο του οποίου το schema δεν μπορεί να εμπιστευτεί.
- **Αναστρέψιμες, project-scoped integrations.** Ατομικές εγγραφές, αντίγραφα ασφαλείας με
  χρονοσήμανση, δομημένες (όχι string) επεξεργασίες config· ποτέ δεν επεξεργάζεται το `CLAUDE.md` /
  `AGENTS.md`, ποτέ δεν αγγίζει το global config από προεπιλογή.

Πλήρες μοντέλο: **[docs/PRIVACY.md](../PRIVACY.md)**. Αναφέρετε μια ευπάθεια ιδιωτικά μέσω **[SECURITY.md](../../SECURITY.md)**.

---

## Κατάσταση & περιορισμοί

Το KawnGraph βρίσκεται σε **ενεργή ανάπτυξη** (`v0.1.0`, δεν έχει δημοσιευτεί ακόμα στο npm). Φτιαγμένο και δοκιμασμένο από άκρη σε άκρη: ο γράφος code/data/config/docs/test, οι σύνδεσμοι docs-σε-code, το mode-scoped query, η ανάλυση αντικτύπου, ο αντίκτυπος Git/PR, τα Context Packs με budget από tokens, το Universal Context Protocol, ο read-only MCP server, το setup agent μίας εντολής (Claude Code, Codex, Cursor, Copilot, Gemini, Aider, generic export, τοπικό LLM), το Studio, και το A/B benchmark harness.

**Ειλικρινείς περιορισμοί.** Το δημοσιευμένο benchmark είναι **εξερευνητικό (n<5 ανά arm — ενδεικτικό, όχι στατιστικά σημαντικό)**. Το KawnGraph βοηθά περισσότερο στην ανακάλυψη άγνωστων πολυ-αρχειακών εργασιών και μπορεί να προσθέσει επιβάρυνση σε ήδη εστιασμένες εργασίες ενός αρχείου. Δεν έχουν φτιαχτεί ακόμα: opt-in suggest-only hooks, το οπτικό layer, ο σημασιολογικός/AI εμπλουτισμός, και ένα runtime layer — όλα opt-in από σχεδιασμό. Δείτε [PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) · [docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Τεκμηρίωση

| Οδηγός | Τι περιέχει |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | Εγκατάσταση, σάρωση, πρώτο Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | Συμβόλαιο setup MCP, αναστρεψιμότητα |
| [Context Packs](../CONTEXT_PACKS.md) | Κατάταξη (ranking), budgets, μορφή σύρματος UCP |
| [Graph model](../GRAPH_MODEL.md) | Nodes, edges, layers, evidence, IDs |
| [Scanners](../SCANNERS.md) | Τι εξάγει κάθε plugin γλώσσας |
| [Benchmarks](../BENCHMARKS.md) | Μεθοδολογία, περιβάλλον, πλήρη αποτελέσματα |
| [Comparison](../COMPARISON.md) | Χρονολογημένη, με πηγές, σύγκριση δυνατοτήτων |
| [Privacy](../PRIVACY.md) | Όρια δεδομένων ανά layer |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Συνήθη ζητήματα & ερωτήσεις |

---

## Συνεισφορά

Οι συνεισφορές είναι ευπρόσδεκτες. Κάντε build από τον πηγαίο κώδικα, τρέξτε τη σουίτα, και διαβάστε τον οδηγό:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Δείτε το **[CONTRIBUTING.md](../../CONTRIBUTING.md)** για το setup, τις συμβάσεις, και τον έλεγχο ιδιωτικότητας που περνά κάθε PR· το **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** για τις προσδοκίες της κοινότητας· το **[docs/i18n/TRANSLATING.md](TRANSLATING.md)** για να προσθέσετε ή να ελέγξετε μια γλώσσα· και το **[SUPPORT.md](../../SUPPORT.md)** για το πού να κάνετε ερωτήσεις.

---

## Άδεια & ευχαριστίες

**[MIT](../../LICENSE)** © οι συνεισφέροντες του KawnGraph.

Δημιουργήθηκε & συντηρείται από τον **[Abdulrahman Alnashri](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)**.

**Kawn** (Αραβικά **كَوْن** — *κόσμος, σύμπαν, ύπαρξη*) αντιμετωπίζει ένα repository ως ένα ζωντανό σύμπαν γνώσης· **Graph** είναι ο με τεκμήρια Agent Context Graph στον πυρήνα του. Φτιαγμένο με [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [React](https://react.dev/), [React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/), και [`@lezer/python`](https://lezer.codemirror.net/).
