<!-- KAWN-TRANSLATION
lang: hi
status: machine-assisted
canonical: README.md
canonical-sha: ab7d13ed267d0a841de534a293213dc0b66856849dac2fd92e1c6af204679af8
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### एजेंट कॉन्टेक्स्ट यूनिवर्स (The Agent Context Universe)

**एक प्रोजेक्ट यूनिवर्स। हर कोडिंग एजेंट।**

KawnGraph कोड, डॉक्स, डेटा, टेस्ट और Git परिवर्तनों को साक्ष्य-समर्थित
**Context Packs** में मैप करता है, ताकि Claude, Codex और Cursor पूरे रिपॉज़िटरी को
पढ़े बिना सही फाइलों तक पहुँच सकें।

[English](../../README.md) · [العربية](../../README.ar.md) · [हिन्दी] (current) · [translation status](STATUS.md)

> यह अनुवाद मशीन-सहायता प्राप्त (machine-assisted) है और इसमें त्रुटियाँ हो सकती हैं।
> आधिकारिक (canonical) अंग्रेज़ी संस्करण [README.md](../../README.md) है;
> अनुवाद की स्थिति के लिए [STATUS.md](STATUS.md) देखें।

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="एक टास्क ('Zid OAuth callback ठीक करो') KawnGraph में जाता है, जो एक टोकन-बजटेड Context Pack लौटाता है: पढ़ने योग्य ज़रूरी फाइलें, संबंधित डॉक्स, टेबल, टेस्ट, जोखिम, बहिष्कृत सूची, और एक कॉन्फिडेंस स्कोर।" width="860">
</div>

---

## KawnGraph क्यों?

जब आप किसी कोडिंग एजेंट को कोई टास्क देते हैं, तो वह आमतौर पर *पढ़ने* से शुरू करता है —
बहुत कुछ। वह दर्जनों फाइलें खोलता है, फिर से पता लगाता है कि रूट्स डेटाबेस तक कैसे
पहुँचते हैं, और हर अनुरोध पर वही मानसिक मॉडल दोबारा बनाता है। यह धीमा है, टोकन के
हिसाब से महँगा है, और अक्सर गलत भी होता है: एजेंट वह एक फाइल छोड़ देता है जो मायने
रखती है और पाँच ऐसी फाइलों में डूब जाता है जो नहीं रखतीं।

KawnGraph रिपॉज़िटरी को **एक बार** स्कैन करता है, यह दर्शाने वाला एक परतदार,
साक्ष्य-समर्थित ग्राफ़ बनाता है कि चीज़ें आपस में कैसे जुड़ी हैं, फिर किसी विशिष्ट
टास्क के लिए उन **कुछ फाइलों** के साथ जवाब देता है जो मायने रखती हैं — साथ ही संबंधित
डॉक्स, संबंधित डेटाबेस टेबल, चलाने योग्य टेस्ट, और ध्यान देने योग्य जोखिम। वह बंडल एक
**Context Pack** है। ग्राफ़ आधार (substrate) है; Context Pack उत्पाद (product) है।

> **एजेंट्स को नक्शा दो, पूरा रिपॉज़िटरी नहीं।** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Quick Start

> **ध्यान दें:** `kawngraph` npm पैकेज **अभी प्रकाशित नहीं हुआ है**, इसलिए
> `npx kawngraph …` आज *उपलब्ध नहीं* है। नीचे दिए गए from-source रास्ते का उपयोग करें;
> `npx` फ़्लो **प्रकाशन के बाद** के लिए दिखाया गया है।

**आज — सोर्स से** (यह monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**npm प्रकाशन के बाद** (इच्छित एक-कमांड अनुभव):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

फिर अपना एजेंट खोलें और बस अपना टास्क बताएँ — वह स्वयं ही उन कुछ फाइलों को खींच लेता
है जो मायने रखती हैं। कोई API कीज़ नहीं, कोई टेलीमेट्री नहीं, स्कैन या रिट्रीवल के दौरान
कोई नेटवर्क कॉल नहीं। इसमें नए हैं? **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)** से शुरू करें।

---

## इसे अपने कोडिंग एजेंट से जोड़ें

KawnGraph का उद्देश्य यह है कि एजेंट **स्वतः** नक्शे तक पहुँचे। एक कमांड एक प्रोजेक्ट
को उन एजेंट्स से जोड़ देती है जिनका आप उपयोग करते हैं — `CLAUDE.md` या `AGENTS.md` को
संपादित किए बिना, और हर परिवर्तन वापस लेने योग्य (reversible) होता है:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` **Claude Code**, **Codex** और **Cursor** का पता लगाता है और प्रोजेक्ट तक
सीमित एक **read-only MCP integration** स्थापित करता है (`.mcp.json`,
`.cursor/mcp.json`, या `.codex/config.toml`), जिसे वह छूता है उसका बैकअप लेता है और
सर्वर को एक लाइव handshake के साथ सत्यापित करता है। पूर्ण अनुबंध:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**।

**MCP server** शून्य निर्भरताओं वाला read-only stdio JSON-RPC है और इसमें चार टूल हैं:

| Tool | यह क्या करता है |
| ---- | ------------ |
| `kawn_context` | किसी टास्क के लिए टोकन-बजटेड Context Pack। |
| `kawn_query` | ग्राफ़ पर रैंक्ड, मोड-स्कोप्ड खोज। |
| `kawn_affected` | रिवर्स इम्पैक्ट: किसी सिंबल पर क्या निर्भर करता है। |
| `kawn_changes` | वर्तमान change set का प्रभाव (uncommitted, या एक branch बनाम एक base ref)। केवल लोकल git। |

यह ग्राफ़ को **केवल पढ़ता है** — यह कभी स्कैन, पुनर्निर्माण, या लेखन नहीं करता (जब
ग्राफ़ पुराना दिखता है तो यह चेतावनी देता है और `kawn update` की ओर इशारा करता है)।

---

## यह कैसे काम करता है

एक प्रोजेक्ट सिर्फ़ कोड नहीं है। यह कोड **और** डॉक्स **और** SQL **और** टेस्ट **और**
वह कॉन्फ़िगरेशन है जो उन्हें आपस में बाँधता है। KawnGraph इनमें से प्रत्येक को एक
अलग **layer** के रूप में मॉडल करता है, ताकि एक क्वेरी ठीक वही माँगे जिसकी उसे ज़रूरत
है और कुछ भी अतिरिक्त नहीं — एक code-impact क्वेरी कभी मार्केटिंग डॉक्स नहीं खींचती;
एक docs क्वेरी कभी रॉ कॉल ग्राफ़ नहीं लौटाती जब तक आप न माँगें।

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph आपके रिपॉज़िटरी को डिटरमिनिस्टिक स्कैनर्स के साथ पढ़कर .kawn/graph.json पर एक परतदार ग्राफ़ (code, data, config, docs, test परतें) बनाता है, जो kawn CLI, MCP server, और Studio को read-only परोसा जाता है। कोई नेटवर्क नहीं, कोई LLM नहीं, कोई टेलीमेट्री नहीं।" width="860">
</div>

| Layer    | उदाहरण                                            |
| -------- | --------------------------------------------------- |
| `code`   | files, functions, classes, imports, calls, routes   |
| `data`   | SQL tables, migrations, foreign keys                |
| `config` | workspace packages, dependencies                    |
| `docs`   | markdown sections, links, mentions                  |
| `test`   | tests and what they cover                           |

प्रत्येक edge **साक्ष्य** (source path, line range, snippet) और एक कॉन्फ़िडेंस स्तर
रखता है; प्रत्येक node के पास एक **stable, content-addressable ID** होती है ताकि
ग्राफ़ स्कैन-दर-स्कैन diffable बना रहे। गहरा मॉडल:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**।

### एक Context Pack, शुरू से अंत तक (A Context Pack, end to end)

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

वही pack Markdown, JSON, या एजेंट-न्यूट्रल **Universal Context Protocol**
(`--format ucp` / `ucp-md`) के रूप में उपलब्ध है। अधिक:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**।

---

## Studio

`kawn map` **KawnGraph Studio** खोलता है — एक लोकल, **read-only** एक्सप्लोरर जो
`127.0.0.1` पर परोसा जाता है, मौजूदा `.kawn/graph.json` को पढ़ता है और कभी स्कैन,
पुनर्निर्माण, या लेखन नहीं करता। यह एक इंटरैक्टिव 2D ग्राफ़, एक स्केलेबल 3D "Universe"
स्टार-मैप (बजटेड, ताकि यह कभी पूरे बड़े ग्राफ़ को एक साथ न खींचे), एक Context-Pack
बिल्डर, रिवर्स-इम्पैक्ट, Git-change व्यूज़, और एक behavioral benchmark व्यू प्रदान
करता है। अंग्रेज़ी और अरबी (RTL-aware) में बना है। इसे सोर्स से `pnpm studio:build &&
pnpm kawn map` के साथ चलाएँ।

> अगली विज़ुअल-कैप्चर पास के बाद एक कैप्चर किया गया Studio स्क्रीनशॉट
> `docs/assets/` में जोड़ा जाएगा; तब तक ऊपर दिए गए आरेख ही आधिकारिक विज़ुअल हैं।

---

## KawnGraph बनाम सादा रिपॉज़िटरी खोज

*दृष्टिकोणों* की एक तटस्थ तुलना (यह किसी प्रतिस्पर्धी पर हमला नहीं है)। हर सेल
रक्षणीय है; "varies" का अर्थ है कि यह विशिष्ट टूल पर निर्भर करता है।

| Capability | Plain search | General RAG | Generic graph viewer | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministic local scan | ✅ | varies | ✅ | ✅ |
| Symbol-level relationships | ❌ | varies | ✅ | ✅ |
| Docs / data / test layers | ❌ | varies | varies | ✅ |
| Evidence on every edge | ❌ | ❌ | varies | ✅ |
| Bounded impact analysis | ❌ | ❌ | varies | ✅ |
| Git-change context | varies | ❌ | ❌ | ✅ |
| Token-budgeted Context Packs | ❌ | varies | ❌ | ✅ |
| Read-only MCP retrieval | ❌ | varies | varies | ✅ |
| No internal LLM required | ✅ | ❌ | ✅ | ✅ |

एक परिपक्व ग्राफ़ टूल के विरुद्ध दिनांकित, स्रोत-समर्थित, तीन-स्तंभ वाली तुलना
(वे क्षमताएँ जिनमें KawnGraph आगे है **और** वे जिनमें नहीं) यहाँ मौजूद है:
**[docs/COMPARISON.md](../COMPARISON.md)**।

---

## Benchmarks

KawnGraph एक **local A/B harness** के साथ आता है जो *उसी* एजेंट को *उसी* टास्क पर
KawnGraph **के साथ बनाम बिना** चलाता है और व्यवहार रिकॉर्ड करता है। परिणाम ईमानदार
और **टास्क-निर्भर** हैं — तटस्थ और नकारात्मक मामलों सहित।

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

मेथडोलॉजी, परिवेश, नमूना आकार, प्रति-मेट्रिक टेबल्स, और सीमाएँ:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — [`benchmarks/published/`](../../benchmarks/published/) में
कमिट किए गए, सत्यापित आर्टिफ़ैक्ट से जनरेट किया गया।

---

## समर्थित स्कैनर और परतें

प्रत्येक भाषा/फ़ॉर्मैट एक रजिस्ट्री के पीछे एक वर्ज़न्ड **scanner plugin** है
(detect → scan → finalize): डिटरमिनिस्टिक क्रम, प्रति-फाइल विफलता अलगाव,
स्पष्ट पंजीकरण, और सीमित फाइल आकार।

| Language / format | Extracted |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

दोनों कोड स्कैनर्स में दो जानबूझकर की गई चूकें हैं: methods/nested functions कभी अलग
nodes नहीं होते (एक method अपने class पर metadata के रूप में सवारी करता है), और
ambient declaration फाइलें (`.d.ts`, `.pyi`) कभी क्लेम नहीं की जातीं। विवरण:
**[docs/SCANNERS.md](../SCANNERS.md)**।

---

## गोपनीयता और सुरक्षा

- **डिफ़ॉल्ट रूप से कोई नेटवर्क नहीं।** स्कैन और रिट्रीवल आपके रिपॉज़िटरी को पढ़ते हैं
  और `.kawn/` के तहत JSON लिखते हैं। कुछ भी मशीन से बाहर नहीं जाता।
- **कोई आंतरिक LLM नहीं।** कोड, डॉक्स, और SQL संरचनात्मक रूप से पार्स किए जाते हैं;
  AI enrichment opt-in और local-first है।
- **कोई टेलीमेट्री नहीं। डिफ़ॉल्ट रूप से कोई query logging नहीं।**
- **Read-only MCP।** सर्वर ग्राफ़ परोसता है; यह कभी स्कैन, पुनर्निर्माण, या लेखन नहीं
  करता — और ऐसे ग्राफ़ को परोसने से इनकार करता है जिसके schema पर वह भरोसा नहीं कर सकता।
- **वापस लेने योग्य, प्रोजेक्ट-स्कोप्ड इंटीग्रेशन।** Atomic writes, timestamped
  backups, संरचित (string नहीं) config edits; कभी `CLAUDE.md` / `AGENTS.md` संपादित
  नहीं करता, डिफ़ॉल्ट रूप से कभी global config को नहीं छूता।

पूर्ण मॉडल: **[docs/PRIVACY.md](../PRIVACY.md)**। किसी भेद्यता (vulnerability) की
निजी तौर पर रिपोर्ट **[SECURITY.md](../../SECURITY.md)** के माध्यम से करें।

---

## स्थिति और सीमाएँ

KawnGraph **सक्रिय विकास** में है (`v0.1.0`, अभी npm पर प्रकाशित नहीं)। शुरू से अंत
तक बनाया और परीक्षण किया गया: code/data/config/docs/test ग्राफ़, docs-to-code links,
mode-scoped query, impact analysis, Git/PR impact, टोकन-बजटेड Context Packs,
Universal Context Protocol, read-only MCP server, एक-कमांड एजेंट setup
(Claude Code / Codex / Cursor), Studio, और A/B benchmark harness।

**ईमानदार सीमाएँ।** प्रकाशित benchmark **exploratory (n<5 प्रति arm —
दिशात्मक, सांख्यिकीय रूप से सार्थक नहीं)** है। KawnGraph सबसे अधिक अपरिचित
मल्टी-फाइल खोज में मदद करता है और पहले से ही केंद्रित single-file टास्क पर overhead
जोड़ सकता है। अभी तक नहीं बनाया गया: opt-in suggest-only hooks, visual layer,
semantic/AI enrichment, और एक runtime layer — सभी डिज़ाइन से opt-in। देखें
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md)।

---

## Documentation

| Guide | अंदर क्या है |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | इंस्टॉल, स्कैन, पहला Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | MCP setup अनुबंध, वापस लेने योग्यता |
| [Context Packs](../CONTEXT_PACKS.md) | Ranking, budgets, UCP wire format |
| [Graph model](../GRAPH_MODEL.md) | Nodes, edges, layers, evidence, IDs |
| [Scanners](../SCANNERS.md) | प्रत्येक भाषा plugin क्या निकालता है |
| [Benchmarks](../BENCHMARKS.md) | मेथडोलॉजी, परिवेश, पूर्ण परिणाम |
| [Comparison](../COMPARISON.md) | दिनांकित, स्रोत-समर्थित क्षमता तुलना |
| [Privacy](../PRIVACY.md) | प्रति परत डेटा सीमाएँ |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | सामान्य समस्याएँ और प्रश्न |

---

## योगदान (Contributing)

योगदान का स्वागत है। सोर्स से बनाएँ, सूट चलाएँ, और गाइड पढ़ें:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

setup, परंपराओं, और हर PR द्वारा पास की जाने वाली privacy समीक्षा के लिए
**[CONTRIBUTING.md](../../CONTRIBUTING.md)** देखें; सामुदायिक अपेक्षाओं के लिए
**[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)**; किसी भाषा को जोड़ने या समीक्षा
करने के लिए **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**; और प्रश्न पूछने के स्थान
के लिए **[SUPPORT.md](../../SUPPORT.md)** देखें।

---

## लाइसेंस और आभार

**[MIT](../../LICENSE)** © KawnGraph contributors।

**Kawn** (अरबी **كَوْن** — *ब्रह्मांड, यूनिवर्स, अस्तित्व*) एक रिपॉज़िटरी को ज्ञान के
एक जीवंत यूनिवर्स के रूप में मानता है; **Graph** इसके केंद्र में मौजूद साक्ष्य-समर्थित
Agent Context Graph है। [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/), और
[`@lezer/python`](https://lezer.codemirror.net/) के साथ बनाया गया।
