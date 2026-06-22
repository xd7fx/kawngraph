<!-- KAWN-TRANSLATION
lang: zh-TW
status: machine-assisted
canonical: README.md
canonical-sha: b3379a444f5d5d0daf397ab919fb327c75e9b8b3d32b6ddd35e37ea76a810dc2
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph 標誌" width="320">

### 代理情境宇宙

**一個專案宇宙，服務每一個程式設計代理。**

KawnGraph 將程式碼、文件、資料、測試與 Git 變更映射為有證據佐證的
**情境包（Context Packs）**，讓 Claude、Codex 與 Cursor 不必讀取整個儲存庫，
就能找到正確的檔案。

[English](../../README.md) · [العربية](../../README.ar.md) · [繁體中文]（目前語言） · [翻譯狀態](STATUS.md)

> 本翻譯為機器輔助（machine-assisted）產生，可能含有錯誤。權威版本為英文版 README.md，請參閱 [STATUS.md](STATUS.md)。

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="一項任務（「修復 Zid OAuth 回呼」）流入 KawnGraph，它回傳一個有 token 預算的情境包：必讀檔案、相關文件、資料表、測試、風險、已排除清單，以及一個信心分數。" width="860">
</div>

---

## 為什麼選擇 KawnGraph？

當你交給程式設計代理一項任務時，它通常會從*閱讀*開始——而且讀很多。
它會打開數十個檔案、重新推導路由如何連到資料庫，並在每次請求時重建同一套
心智模型。這既緩慢、又耗費 token，且常常不準確：代理錯過了那個唯一重要的
檔案，卻淹沒在五個無關緊要的檔案裡。

KawnGraph 只掃描儲存庫**一次**，建立一張分層、有證據佐證的關係圖，接著針對
特定任務，回答出**少數真正重要的檔案**——再加上相關文件、相關的資料庫表、
要執行的測試，以及要留意的風險。那一整包就是**情境包（Context Pack）**。
圖（graph）是底層基質；情境包才是產品。

> **給代理地圖，而不是整個儲存庫。** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## 快速開始

> **注意：** `kawngraph` npm 套件**尚未發布**，因此今天還
> *無法*使用 `npx kawngraph …`。請改用下方的從原始碼（from-source）路徑；
> `npx` 流程是展示給**發布之後**使用的。

**今天——從原始碼**（此 monorepo，Node ≥ 18 + [pnpm](https://pnpm.io)）：

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**在 npm 發布之後**（預期中的一行指令體驗）：

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

接著打開你的代理，直接描述你的任務——它就會自行拉取那少數真正重要的檔案。
不需要 API 金鑰、不需要遙測，掃描或檢索期間都沒有任何網路呼叫。第一次使用嗎？
請從 **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)** 開始。

---

## 將它連接到你的程式設計代理

KawnGraph 的重點在於：代理會**自動**取用這張地圖。一行指令就能把專案接上你
使用的代理——無需編輯 `CLAUDE.md` 或 `AGENTS.md`，而且每項變更都可還原：

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` 會偵測 **Claude Code**、**Codex** 與 **Cursor**，並安裝一個範圍限定於
該專案的**唯讀 MCP 整合**（`.mcp.json`、`.cursor/mcp.json` 或
`.codex/config.toml`），備份它所觸及的任何檔案，並透過即時握手驗證伺服器。
完整規範：**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**。

**MCP 伺服器**是唯讀的 stdio JSON-RPC，零相依，提供四個工具：

| 工具 | 功能 |
| ---- | ------------ |
| `kawn_context` | 針對任務的、有 token 預算的情境包。 |
| `kawn_query` | 在圖上進行排名後、依模式範圍限定的搜尋。 |
| `kawn_affected` | 反向影響分析：什麼依賴於某個符號。 |
| `kawn_changes` | 當前變更集的影響（未提交，或某分支對某基準 ref）。僅限本機 git。 |

它**只讀取**圖——從不掃描、重建或寫入（當圖看起來過時，它會發出警告並指向
`kawn update`）。

---

## 運作原理

一個專案不只是程式碼。它是程式碼**加上**文件**加上** SQL **加上**測試
**加上**把它們串在一起的設定。KawnGraph 把每一種都建模為一個獨立的**層
（layer）**，因此查詢只要它所需的、絕不多拿——程式碼影響查詢絕不會牽扯進行銷
文件；文件查詢也絕不會回傳原始呼叫圖，除非你明確要求。

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph 以確定性掃描器讀取你的儲存庫，產生一張位於 .kawn/graph.json 的分層圖（code、data、config、docs、test 各層），以唯讀方式提供給 kawn CLI、MCP 伺服器與 Studio。沒有網路、沒有 LLM、沒有遙測。" width="860">
</div>

| 層       | 範例                                                |
| -------- | --------------------------------------------------- |
| `code`   | 檔案、函式、類別、imports、calls、routes             |
| `data`   | SQL 資料表、遷移（migrations）、外鍵                 |
| `config` | 工作區套件、相依套件                                 |
| `docs`   | markdown 章節、連結、提及                            |
| `test`   | 測試以及它們所涵蓋的內容                             |

每一條邊都帶有**證據**（來源路徑、行號範圍、片段）與一個信心等級；每一個節點
都有一個**穩定、可由內容定址的 ID**，因此這張圖在多次掃描之間都能維持可比對
（diffable）。更深入的模型：**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**。

### 一個情境包，從頭到尾

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

同一個情境包可以用 Markdown、JSON，或代理中立的**通用情境協定（Universal
Context Protocol）**（`--format ucp` / `ucp-md`）取得。更多：
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**。

---

## Studio

`kawn map` 會打開 **KawnGraph Studio**——一個本機、**唯讀**的瀏覽器，透過
`127.0.0.1` 提供服務，讀取既有的 `.kawn/graph.json`，從不掃描、重建或寫入。
它提供一個互動式 2D 圖、一個可擴展的 3D「宇宙」星圖（有預算限制，因此絕不會
一次繪製整張大圖）、一個情境包建構器、反向影響分析、Git 變更檢視，以及一個
行為基準（benchmark）檢視。以英文與阿拉伯文（支援 RTL）建置。從原始碼以
`pnpm studio:build && pnpm kawn map` 執行它。

> 下一輪視覺擷取（visual-capture）流程之後，會在 `docs/assets/` 加入一張擷取的
> Studio 螢幕截圖；在那之前，上方的圖示為權威視覺素材。

---

## KawnGraph 與一般儲存庫搜尋的對比

這是對*各種做法*的中立比較（並非攻擊競爭對手）。每一格都站得住腳；「varies」
表示視具體工具而定。

| 能力 | 一般搜尋 | 通用 RAG | 通用圖檢視器 | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| 確定性的本機掃描 | ✅ | varies | ✅ | ✅ |
| 符號層級的關係 | ❌ | varies | ✅ | ✅ |
| 文件 / 資料 / 測試各層 | ❌ | varies | varies | ✅ |
| 每條邊都有證據 | ❌ | ❌ | varies | ✅ |
| 有界限的影響分析 | ❌ | ❌ | varies | ✅ |
| Git 變更情境 | varies | ❌ | ❌ | ✅ |
| 有 token 預算的情境包 | ❌ | varies | ❌ | ✅ |
| 唯讀 MCP 檢索 | ❌ | varies | varies | ✅ |
| 不需要內部 LLM | ✅ | ❌ | ✅ | ✅ |

一份標註日期、附來源、與一個成熟圖工具進行的三欄比較（KawnGraph 領先的能力
**以及**它不領先的能力）放在 **[docs/COMPARISON.md](../COMPARISON.md)**。

---

## 基準測試

KawnGraph 隨附一個**本機 A/B 測試台（harness）**，它讓*同一個*代理在*同一個*
任務上**搭配與不搭配** KawnGraph 各跑一次，並記錄行為。結果誠實且
**取決於任務**——包括中性與負面的案例。

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

方法論、執行環境、樣本數、各項指標的完整表格，以及限制：
**[docs/BENCHMARKS.md](../BENCHMARKS.md)**——由 [`benchmarks/published/`](../../benchmarks/published/)
中已提交、已驗證的成品（artifact）產生。

---

## 支援的掃描器與層

每一種語言／格式都是一個版本化的**掃描器外掛（scanner plugin）**，置於單一
登錄之後（detect → scan → finalize）：確定性順序、逐檔失敗隔離、明確註冊，以及
有界的檔案大小。

| 語言 / 格式 | 擷取內容 |
| ----------------- | --------- |
| TypeScript / JS   | 檔案、頂層函式/類別、imports、calls、Next.js routes、測試 |
| Python            | 頂層 `def`/`async def`/`class`、裝飾器、方法（作為 metadata）、imports、FastAPI/Flask routes、docstrings、測試（透過 `@lezer/python`——純 JS、容錯） |
| SQL               | 資料表（`CREATE`/`ALTER`）、外鍵關係 |
| package.json      | 工作區套件與內部相依 |
| Markdown          | 連結到程式碼、SQL 與 routes 的標題/章節 |

兩個刻意的省略，存在於兩個程式碼掃描器中：方法/巢狀函式絕不會成為獨立節點
（一個方法以 metadata 形式附在它的類別上），而環境宣告檔（`.d.ts`、`.pyi`）絕
不會被認領。細節：**[docs/SCANNERS.md](../SCANNERS.md)**。

---

## 隱私與安全

- **預設無網路。** 掃描與檢索讀取你的儲存庫，並把 JSON 寫到 `.kawn/` 之下。
  沒有任何東西離開本機。
- **無內部 LLM。** 程式碼、文件與 SQL 以結構化方式解析；AI 強化（enrichment）
  須選擇加入（opt-in）且以本機優先。
- **無遙測。預設不記錄查詢。**
- **唯讀 MCP。** 伺服器提供圖；它從不掃描、重建或寫入——並拒絕提供一個其
  schema 無法信任的圖。
- **可還原、範圍限定於專案的整合。** 原子寫入、附時間戳的備份、結構化（而非
  字串）的設定編輯；從不編輯 `CLAUDE.md` / `AGENTS.md`，預設從不觸碰全域設定。

完整模型：**[docs/PRIVACY.md](../PRIVACY.md)**。請透過 **[SECURITY.md](../../SECURITY.md)**
私下回報漏洞。

---

## 狀態與限制

KawnGraph 處於**積極開發中**（`v0.1.0`，尚未發布到 npm）。已端到端建置並測試：
code/data/config/docs/test 圖、文件對程式碼的連結、依模式範圍限定的查詢、影響
分析、Git/PR 影響、有 token 預算的情境包、通用情境協定、唯讀 MCP 伺服器、一行
指令的代理設定（Claude Code / Codex / Cursor）、Studio，以及 A/B 基準測試台。

**誠實的限制。** 已發布的基準測試是**探索性的（每組 n<5——僅供參考方向，不具
統計顯著性）**。KawnGraph 在不熟悉的多檔探索上幫助最大，但在已經聚焦的單檔
任務上可能增加額外開銷。尚未建置：選擇加入的「僅建議」掛鉤（suggest-only
hooks）、視覺層、語意/AI 強化，以及執行時層（runtime layer）——全部按設計皆為
選擇加入。請參閱
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md)。

---

## 文件

| 指南 | 內容 |
| ----- | ------------- |
| [快速上手](../GETTING_STARTED.md) | 安裝、掃描、第一個情境包 |
| [代理整合](../AGENT_INTEGRATION.md) | MCP 設定規範、可還原性 |
| [情境包](../CONTEXT_PACKS.md) | 排名、預算、UCP 傳輸格式 |
| [圖模型](../GRAPH_MODEL.md) | 節點、邊、層、證據、IDs |
| [掃描器](../SCANNERS.md) | 每個語言外掛擷取了什麼 |
| [基準測試](../BENCHMARKS.md) | 方法論、環境、完整結果 |
| [比較](../COMPARISON.md) | 標註日期、附來源的能力比較 |
| [隱私](../PRIVACY.md) | 各層的資料邊界 |
| [疑難排解](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | 常見問題與疑問 |

---

## 貢獻

歡迎貢獻。從原始碼建置、執行測試套件，並閱讀指南：

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

設定、慣例，以及每個 PR 都會通過的隱私審查，請參閱 **[CONTRIBUTING.md](../../CONTRIBUTING.md)**；
社群期望請參閱 **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)**；新增或審查語言請參閱
**[docs/i18n/TRANSLATING.md](TRANSLATING.md)**；提問管道請參閱
**[SUPPORT.md](../../SUPPORT.md)**。

---

## 授權與致謝

**[MIT](../../LICENSE)** © KawnGraph 貢獻者。

**Kawn**（阿拉伯文 **كَوْن**——*宇宙、寰宇、存在*）把儲存庫視為一個鮮活的知識
宇宙；**Graph** 是其核心、有證據佐證的代理情境圖（Agent Context Graph）。以
[TypeScript](https://www.typescriptlang.org/)、
[Vite](https://vitejs.dev/)、[React](https://react.dev/)、
[React Flow](https://reactflow.dev/)、[Three.js](https://threejs.org/) 與
[`@lezer/python`](https://lezer.codemirror.net/) 建置。
</content>
</invoke>
