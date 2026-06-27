<!-- KAWN-TRANSLATION
lang: zh-CN
status: machine-assisted
canonical: README.md
canonical-sha: fa965807adf98799984ab7bd27028a428bac7355a8bf9ef878d0b0254a71fb90
-->

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../brand/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../../brand/logo-light.svg">
  <img src="../../brand/logo.svg" alt="KawnGraph" width="320">
</picture>

### 智能体上下文宇宙

**一个项目宇宙，服务每一个编码智能体。**

KawnGraph 将代码、文档、数据、测试和 Git 变更映射为有证据支撑的 **Context Packs（上下文包）**，让 Claude、Codex 和 Cursor 无需通读整个仓库就能找到正确的文件。

<!-- LANGBAR:START -->

[English](../../README.md) ·
[العربية](../../README.ar.md) ·
[Español](README.es.md) ·
[Français](README.fr.md) ·
[Deutsch](README.de.md) ·
[Português (BR)](README.pt-BR.md) ·
**简体中文** ·
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

[![Website](https://img.shields.io/badge/Website-live-22C7A9.svg?logo=githubpages&logoColor=white)](https://xd7fx.github.io/kawngraph-site/)
[![npm](https://img.shields.io/badge/npm-kawngraph-CB3837.svg?logo=npm&logoColor=white)](https://www.npmjs.com/package/kawngraph)
[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA.svg?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/xd7fx)

> 本翻译为机器辅助生成，可能包含错误。规范英文版本为 [README.md](../../README.md)；翻译状态见 [STATUS.md](STATUS.md)。

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="一个任务（“修复 Zid OAuth 回调”）进入 KawnGraph，后者返回一个有 token 预算的 Context Pack：必读文件、相关文档、数据表、测试、风险、被排除清单，以及置信度分数。" width="860">
</div>

---

## 为什么选择 KawnGraph？

当你把一项任务交给编码智能体时，它通常先从*阅读*开始——而且读得很多。它会打开几十个文件，反复推导路由如何到达数据库，并在每次请求时重建同一套心智模型。这既慢又耗费 token，而且往往不准确：智能体错过了那个唯一重要的文件，却淹没在五个无关紧要的文件里。

KawnGraph 只扫描仓库**一次**，构建一个分层的、有证据支撑的关系图，然后针对某个具体任务，给出**真正重要的少数文件**——外加相关文档、关联的数据库表、需要运行的测试，以及需要警惕的风险。这一捆内容就是一个 **Context Pack**。图是底层基质；Context Pack 才是产品。

> **给智能体地图，而不是整个仓库。** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## 快速开始

只需**一条命令**即可安装并运行 KawnGraph——`npx` 会自动获取它，无需克隆（Node ≥ 18）：

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

**或从源码运行**（本 monorepo，面向贡献者——[pnpm](https://pnpm.io)）：

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

然后打开你的智能体，直接描述你的任务即可——它会自行拉取真正重要的少数文件。无需 API 密钥，无遥测，扫描或检索期间也没有任何网络调用。第一次使用？请从 **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)** 开始。

---

## 将它连接到你的编码智能体

KawnGraph 的关键在于：智能体会**自动**去取用这张地图。一条命令就能把一个项目接入你所用的智能体——无需编辑 `CLAUDE.md` 或 `AGENTS.md`，且每次改动都可逆：

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` 会检测你的编码智能体——**Claude Code**、**Codex**、**Cursor**、**Copilot**、**Gemini CLI** 和 **Aider**（外加一个 `generic` 的 Markdown/JSON 导出，以及一个可选的**本地 LLM**）——并安装一个限定在项目范围内的**只读集成**（`.mcp.json`、`.cursor/mcp.json`、`.codex/config.toml`、`.vscode/mcp.json`、`.gemini/settings.json`，或一个 Aider 上下文文件），对它所触及的一切进行备份，并通过一次实时握手来验证每个 MCP 服务器。完整约定见：**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**。

该 **MCP 服务器**是一个只读的 stdio JSON-RPC 循环，**不使用任何 MCP SDK**（手写实现），提供四个工具：

| 工具 | 作用 |
| ---- | ------------ |
| `kawn_context` | 针对某个任务、有 token 预算的 Context Pack。 |
| `kawn_query` | 在图上进行排序、按模式限定的搜索。 |
| `kawn_affected` | 反向影响：哪些东西依赖某个符号。 |
| `kawn_changes` | 当前变更集（未提交的，或某个分支相对基准引用）的影响。仅限本地 git。 |

它**只读取**图——从不扫描、重建或写入图（当图看起来过期时，它会发出警告并指向 `kawn update`）。

---

## 工作原理

一个项目不只是代码。它是代码**和**文档**和** SQL **和**测试**和**把它们联系在一起的配置。KawnGraph 将每一类都建模为一个独立的**层**，因此一次查询恰好获取它所需要的，而不夹带它不需要的——代码影响查询绝不会拖进营销文档；文档查询除非你主动要求，否则绝不会返回原始调用图。

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph 用确定性扫描器读取你的仓库，汇成位于 .kawn/graph.json 的一张分层图（code、data、config、docs、test 各层），以只读方式提供给 kawn CLI、MCP 服务器和 Studio。无网络、无 LLM、无遥测。" width="860">
</div>

| 层       | 示例                                                |
| -------- | --------------------------------------------------- |
| `code`   | 文件、函数、类、导入、调用、路由                     |
| `data`   | SQL 表、迁移、外键                                   |
| `config` | 工作区包、依赖                                       |
| `docs`   | markdown 章节、链接、提及                            |
| `test`   | 测试以及它们覆盖的内容                               |

每条边都带有**证据**（源路径、行范围、片段）和一个置信度等级——在扫描器能够附上证据的地方，由机制自动推导得出；每个节点都有一个**稳定的、按内容寻址的 ID**，使图在多次扫描之间保持可对比（diffable）。更深入的模型见：**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**。

### 一个 Context Pack，从头到尾

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

同一个包可以以 Markdown、JSON 或与智能体无关的**通用上下文协议（Universal Context Protocol）**（`--format ucp` / `ucp-md`）形式提供。更多内容见：**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**。

---

## Studio

`kawn map` 会打开 **KawnGraph Studio**——一个本地的、**只读**的浏览器，通过 `127.0.0.1` 提供服务，读取既有的 `.kawn/graph.json`，从不扫描、重建或写入。它提供一个交互式 2D 图、一个可扩展的 3D “Universe（宇宙）”星图（有预算限制，因此绝不会一次性绘制整张大图）、一个 Context-Pack 构建器、反向影响、Git 变更视图，以及一个行为基准视图。以英文和阿拉伯文构建（支持 RTL）。可用 `pnpm studio:build && pnpm kawn map` 从源码运行它。

<div align="center">
<img src="../assets/studio-universe.webp" alt="KawnGraph Studio——本仓库自身图的只读 3D “Universe（宇宙）”视图：1,261 个节点按层聚类（Code 815、Docs 430、Config 13、Data 3），带有连接线，外加按层/类型/边的筛选器。" width="860">
<br><sub>3D <b>Universe（宇宙）</b>视图——本仓库自身的图（1,261 个节点），只读。</sub>
</div>

<div align="center">
<img src="../assets/studio-map.webp" alt="KawnGraph Studio——内置示例项目的 2D 图视图：文件、函数、路由、表和文档作为节点，带有标注的、有证据支撑的边（imports、calls、defines、mentions、explains），外加按层/类型/边的筛选器。" width="860">
<br><sub>2D <b>graph（图）</b>视图——内置示例项目，带有 层 / 类型 / 边 筛选器。</sub>
</div>

---

## KawnGraph 对比普通仓库搜索

这是对*方法*的中立比较（并非攻击竞争对手）。每个单元格都站得住脚；“varies（视情况而定）”表示取决于具体工具。

| 能力 | 普通搜索 | 通用 RAG | 通用图查看器 | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| 确定性本地扫描 | ✅ | varies | ✅ | ✅ |
| 符号级关系 | ❌ | varies | ✅ | ✅ |
| 文档 / 数据 / 测试 各层 | ❌ | varies | varies | ✅ |
| 每条边都有证据 | ❌ | ❌ | varies | ✅ |
| 有边界的影响分析 | ❌ | ❌ | varies | ✅ |
| Git 变更上下文 | varies | ❌ | ❌ | ✅ |
| 有 token 预算的 Context Packs | ❌ | varies | ❌ | ✅ |
| 只读 MCP 检索 | ❌ | varies | varies | ✅ |
| 无需内部 LLM | ✅ | ❌ | ✅ | ✅ |

一份标注日期、注明来源的三列对比（对照一款成熟图工具，既包括 KawnGraph 领先的能力**也**包括它不具备的能力）见 **[docs/COMPARISON.md](../COMPARISON.md)**。

---

## 基准测试

KawnGraph 提供一个**本地 A/B 测试框架**，在*同一个*任务上对*同一个*智能体分别**使用与不使用** KawnGraph 运行，并记录其行为。结果是诚实的，且**取决于任务**——其中也包括中性和负面的案例。

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

方法学、运行环境、样本量、逐项指标表格以及局限性：**[docs/BENCHMARKS.md](../BENCHMARKS.md)**——由 [`benchmarks/published/`](../../benchmarks/published/) 中已提交、已验证的产物生成。

---

## 支持的扫描器与层

每种语言/格式都是一个有版本号的**扫描器插件**，统一在一个注册表后面（detect → scan → finalize）：确定性顺序、按文件隔离故障、显式注册，以及有界的文件大小。

| 语言 / 格式 | 提取内容 |
| ----------------- | --------- |
| TypeScript / JS   | 文件、顶层函数/类、导入、调用、Next.js 路由、测试 |
| Python            | 顶层 `def`/`async def`/`class`、装饰器、方法（作为元数据）、导入、FastAPI/Flask 路由、docstring、测试（通过 `@lezer/python`——纯 JS，容错） |
| SQL               | 表（`CREATE`/`ALTER`）、外键关系 |
| package.json      | 工作区包和内部依赖 |
| Markdown          | 链接到代码、SQL 和路由的标题/章节 |

两个代码扫描器都有意省略两点：方法/嵌套函数从不作为独立节点（方法以元数据形式附着在其所属类上），以及环境声明文件（`.d.ts`、`.pyi`）从不被纳入。详情见：**[docs/SCANNERS.md](../SCANNERS.md)**。

---

## 隐私与安全

- **默认无网络。** 扫描与检索读取你的仓库，并在 `.kawn/` 下写入 JSON。没有任何东西离开本机。
- **无内部 LLM。** 代码、文档和 SQL 以结构化方式解析；AI 增强是可选的、本地优先的。
- **无遥测。默认不记录查询日志。**
- **只读 MCP。** 服务器提供图；它从不扫描、重建或写入——并且会拒绝提供其模式（schema）无法信任的图。
- **可逆、限定项目范围的集成。** 原子写入、带时间戳的备份、结构化（而非字符串）配置编辑；从不编辑 `CLAUDE.md` / `AGENTS.md`，默认从不触碰全局配置。

完整模型：**[docs/PRIVACY.md](../PRIVACY.md)**。请通过 **[SECURITY.md](../../SECURITY.md)** 私下报告漏洞。

---

## 状态与局限

KawnGraph 处于**积极开发中**（`v0.1.0`，尚未发布到 npm）。已端到端构建并测试：code/data/config/docs/test 图、文档到代码的链接、按模式限定的查询、影响分析、Git/PR 影响、有 token 预算的 Context Packs、通用上下文协议、只读 MCP 服务器、一条命令的智能体接入（Claude Code、Codex、Cursor、Copilot、Gemini、Aider、generic 导出、本地 LLM）、Studio，以及 A/B 基准框架。

**诚实的局限。** 已发布的基准是**探索性的（每个 arm 的 n<5——具有方向性，而非显著性）**。KawnGraph 在不熟悉的多文件探索上帮助最大，而在已经聚焦的单文件任务上可能增加开销。尚未构建：可选的“仅建议”钩子、视觉层、语义/AI 增强，以及运行时层——这些在设计上都是可选的。见 [PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) · [docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md)。

---

## 文档

| 指南 | 内容简介 |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | 安装、扫描、第一个 Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | MCP 接入约定、可逆性 |
| [Context Packs](../CONTEXT_PACKS.md) | 排序、预算、UCP 线缆格式 |
| [Graph model](../GRAPH_MODEL.md) | 节点、边、层、证据、ID |
| [Scanners](../SCANNERS.md) | 每个语言插件提取的内容 |
| [Benchmarks](../BENCHMARKS.md) | 方法学、环境、完整结果 |
| [Comparison](../COMPARISON.md) | 标注日期、注明来源的能力对比 |
| [Privacy](../PRIVACY.md) | 每层的数据边界 |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | 常见问题与疑问 |

---

## 贡献

欢迎贡献。从源码构建、运行测试套件，并阅读指南：

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

设置、约定，以及每个 PR 都要通过的隐私审查见 **[CONTRIBUTING.md](../../CONTRIBUTING.md)**；社区期望见 **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)**；添加或审查某种语言见 **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**；提问的去处见 **[SUPPORT.md](../../SUPPORT.md)**。

---

## 许可与致谢

**[MIT](../../LICENSE)** © KawnGraph 贡献者。

由 **[Abdulrahman Alnashri](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)** 创建并维护。

**Kawn**（阿拉伯语 **كَوْن**——*宇宙、苍穹、存在*）将一个仓库视为一个鲜活的知识宇宙；**Graph** 则是其核心那张有证据支撑的智能体上下文图（Agent Context Graph）。使用 [TypeScript](https://www.typescriptlang.org/)、[Vite](https://vitejs.dev/)、[React](https://react.dev/)、[React Flow](https://reactflow.dev/)、[Three.js](https://threejs.org/) 和 [`@lezer/python`](https://lezer.codemirror.net/) 构建。
