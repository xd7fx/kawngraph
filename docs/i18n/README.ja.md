<!-- KAWN-TRANSLATION
lang: ja
status: machine-assisted
canonical: README.md
canonical-sha: 9ae23d43afac34187e2ed17d64244ea5b65352f88f470cbc2818ff41eb15e312
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### エージェント・コンテキストの宇宙

**一つのプロジェクト宇宙。あらゆるコーディングエージェントへ。**

KawnGraph は、コード・ドキュメント・データ・テスト・Git の変更を、エビデンスに裏付けられた
**Context Pack** にマッピングします。これにより Claude、Codex、Cursor は、リポジトリ全体を
読み込むことなく、本当に必要なファイルへたどり着けます。

[English](../../README.md) · [العربية](../../README.ar.md) · [日本語] (current) · [translation status](STATUS.md)

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA.svg?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/xd7fx)

> この翻訳は機械支援（machine-assisted）によるもので、誤りを含む可能性があります。正典（canonical）となる英語版は [README.md](../../README.md) です。翻訳の状況は [STATUS.md](STATUS.md) を参照してください。

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="タスク（「Zid の OAuth コールバックを修正する」）が KawnGraph に流れ込み、トークン予算内に収まる Context Pack を返す様子。必読ファイル、関連ドキュメント、テーブル、テスト、リスク、除外リスト、信頼度スコアが含まれる。" width="860">
</div>

---

## なぜ KawnGraph なのか？

コーディングエージェントにタスクを与えると、たいていまず *読み込み* から始めます。それも大量に。
何十ものファイルを開き、ルートがどのようにデータベースへ到達するのかを毎回導き直し、リクエストの
たびに同じメンタルモデルを再構築します。これは遅く、トークンを消費し、しばしば不正確です。
エージェントは肝心の一つのファイルを見落とし、関係のない五つのファイルに溺れてしまうのです。

KawnGraph はリポジトリを**一度だけ**スキャンし、物事がどう関連するかを階層化されたエビデンス付きの
グラフとして構築します。そして特定のタスクに対して、**本当に重要な数ファイル**を答えます。
あわせて関連ドキュメント、関連するデータベーステーブル、実行すべきテスト、注意すべきリスクも返します。
この束が **Context Pack** です。グラフは土台（substrate）であり、Context Pack が成果物（product）です。

> **エージェントには地図を渡せ、リポジトリそのものではなく。** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## クイックスタート

> **注意:** `kawngraph` の npm パッケージは**まだ公開されていません**。そのため、
> `npx kawngraph …` は現時点では*利用できません*。下記のソースからの手順を使ってください。
> `npx` のフローは**公開後**のために示してあります。

**現在 — ソースから** (このモノレポ、Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**npm 公開後** (意図された 1 コマンドの体験):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

あとはエージェントを開き、タスクを説明するだけです。エージェントは自分で、本当に重要な数ファイルを
取り寄せます。API キーも、テレメトリも、スキャンや取得中のネットワーク通信もありません。
初めての方は **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)** から始めてください。

---

## コーディングエージェントへの接続

KawnGraph の要点は、エージェントが**自動的に**地図へ手を伸ばすことです。
1 つのコマンドで、利用しているエージェントにプロジェクトを配線します。`CLAUDE.md` や
`AGENTS.md` を編集することなく、すべての変更を元に戻せます。

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` は **Claude Code**、**Codex**、**Cursor** を検出し、プロジェクトにスコープされた
**読み取り専用の MCP 連携**をインストールします（`.mcp.json`、`.cursor/mcp.json`、または
`.codex/config.toml`）。触れたものはすべてバックアップし、ライブのハンドシェイクでサーバーを
検証します。完全な仕様は **[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)** を参照してください。

**MCP サーバー**は、依存関係ゼロの読み取り専用の stdio JSON-RPC で、4 つのツールを備えます。

| ツール | 役割 |
| ---- | ------------ |
| `kawn_context` | タスク向けの、トークン予算内に収まる Context Pack。 |
| `kawn_query` | グラフ上のランク付け・モードスコープ付き検索。 |
| `kawn_affected` | 逆方向の影響: あるシンボルに何が依存しているか。 |
| `kawn_changes` | 現在の変更セット（未コミット、またはブランチとベース ref の比較）の影響。ローカルの git のみ。 |

これはグラフを**読み取るだけ**で、スキャン・再構築・書き込みは一切行いません（グラフが古く見える
ときは警告を出し、`kawn update` を案内します）。

---

## 仕組み

プロジェクトはコードだけではありません。コード**と**ドキュメント**と** SQL **と**テスト**と**、
それらを結びつける設定です。KawnGraph はそれぞれを別個の**レイヤー**としてモデル化します。
そのため、クエリは必要なものだけを、不要なものは何一つ含めずに要求できます。コード影響のクエリが
マーケティングドキュメントを引きずり込むことはなく、ドキュメントのクエリが、求めない限り生のコール
グラフを返すこともありません。

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph は決定論的なスキャナーでリポジトリを読み取り、.kawn/graph.json にある一つの階層化グラフ（code、data、config、docs、test の各レイヤー）にまとめ、kawn CLI、MCP サーバー、Studio に読み取り専用で提供する。ネットワークなし、LLM なし、テレメトリなし。" width="860">
</div>

| レイヤー    | 例                                            |
| -------- | --------------------------------------------------- |
| `code`   | ファイル、関数、クラス、import、call、ルート   |
| `data`   | SQL テーブル、マイグレーション、外部キー                |
| `config` | ワークスペースパッケージ、依存関係                    |
| `docs`   | markdown のセクション、リンク、言及                  |
| `test`   | テストと、それがカバーする対象                           |

すべてのエッジは**エビデンス**（ソースパス、行範囲、スニペット）と信頼度レベルを持ち、すべての
ノードは**安定した、内容アドレス指定の ID** を持つため、グラフはスキャンをまたいで差分可能な
ままです。より深いモデル: **[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**。

### Context Pack を端から端まで

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

同じパックは Markdown、JSON、またはエージェント中立の **Universal Context Protocol**
（`--format ucp` / `ucp-md`）として利用できます。詳細:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**。

---

## Studio

`kawn map` は **KawnGraph Studio** を開きます。これは `127.0.0.1` 上で提供される、ローカルで
**読み取り専用**のエクスプローラーで、既存の `.kawn/graph.json` を読み取り、スキャン・再構築・
書き込みは決して行いません。インタラクティブな 2D グラフ、スケーラブルな 3D の「Universe」星図
（予算管理されており、巨大なグラフ全体を一度に描画することはありません）、Context Pack ビルダー、
逆方向の影響分析、Git 変更ビュー、そして挙動ベンチマークのビューを備えます。英語とアラビア語
（RTL 対応）で構築されています。ソースからは `pnpm studio:build && pnpm kawn map` で実行できます。

> Studio のスクリーンショットは、次回のビジュアルキャプチャの工程ののち `docs/assets/` に
> 追加されます。それまでは、上記の図が正典となるビジュアルです。

---

## KawnGraph と素のリポジトリ検索の比較

これは*アプローチ*の中立な比較であり（競合への攻撃ではありません）。すべてのセルは妥当であり、
「varies（場合による）」とは、具体的なツールに依存することを意味します。

| 能力 | 素の検索 | 汎用 RAG | 汎用グラフビューア | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| 決定論的なローカルスキャン | ✅ | varies | ✅ | ✅ |
| シンボルレベルの関係 | ❌ | varies | ✅ | ✅ |
| docs / data / test の各レイヤー | ❌ | varies | varies | ✅ |
| すべてのエッジにエビデンス | ❌ | ❌ | varies | ✅ |
| 範囲限定の影響分析 | ❌ | ❌ | varies | ✅ |
| Git 変更のコンテキスト | varies | ❌ | ❌ | ✅ |
| トークン予算内の Context Pack | ❌ | varies | ❌ | ✅ |
| 読み取り専用の MCP 取得 | ❌ | varies | varies | ✅ |
| 内部 LLM が不要 | ✅ | ❌ | ✅ | ✅ |

成熟したグラフツールに対する、日付入り・出典付きの 3 カラム比較（KawnGraph が勝る能力**と**
勝らない能力の両方）は **[docs/COMPARISON.md](../COMPARISON.md)** にあります。

---

## ベンチマーク

KawnGraph は、*同じ*エージェントを*同じ*タスクに対して KawnGraph **あり対なし**で実行し、
挙動を記録する**ローカル A/B ハーネス**を同梱しています。結果は正直で、**タスク依存**です。
中立なケースやネガティブなケースも含みます。

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

方法論、環境、サンプルサイズ、メトリクスごとのテーブル、そして制約事項:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — コミット済みで検証済みのアーティファクト
[`benchmarks/published/`](../../benchmarks/published/) から生成されています。

---

## 対応スキャナーとレイヤー

各言語・各フォーマットは、一つのレジストリの背後にあるバージョン管理された**スキャナープラグイン**
です（detect → scan → finalize）。決定論的な順序、ファイル単位での失敗の隔離、明示的な登録、
そして境界づけられたファイルサイズを備えます。

| 言語 / フォーマット | 抽出される内容 |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

両方のコードスキャナーには、意図的な省略が 2 つあります。メソッドやネストされた関数は決して
別個のノードにはならず（メソッドはメタデータとしてそのクラスに付随します）、アンビエント宣言
ファイル（`.d.ts`、`.pyi`）は決して取り込みません。詳細:
**[docs/SCANNERS.md](../SCANNERS.md)**。

---

## プライバシーとセキュリティ

- **デフォルトでネットワークなし。** スキャンと取得はリポジトリを読み取り、JSON を `.kawn/` の
  下に書き込みます。何一つマシンの外へ出ません。
- **内部 LLM なし。** コード、ドキュメント、SQL は構造的に解析されます。AI による拡張は
  オプトインかつローカルファーストです。
- **テレメトリなし。デフォルトでクエリのログ記録なし。**
- **読み取り専用の MCP。** サーバーはグラフを提供するだけで、スキャン・再構築・書き込みは
  決して行わず、スキーマを信頼できないグラフの提供は拒否します。
- **元に戻せる、プロジェクトスコープの連携。** アトミックな書き込み、タイムスタンプ付きの
  バックアップ、（文字列ではなく）構造化された設定編集。`CLAUDE.md` / `AGENTS.md` を編集する
  ことは決してなく、デフォルトでグローバル設定に触れることもありません。

完全なモデル: **[docs/PRIVACY.md](../PRIVACY.md)**。脆弱性は **[SECURITY.md](../../SECURITY.md)**
を通じて非公開で報告してください。

---

## ステータスと制約

KawnGraph は**活発に開発中**です（`v0.1.0`、まだ npm には未公開）。エンドツーエンドで構築・
テスト済み: code/data/config/docs/test のグラフ、docs から code へのリンク、モードスコープの
クエリ、影響分析、Git/PR の影響、トークン予算内の Context Pack、Universal Context Protocol、
読み取り専用の MCP サーバー、1 コマンドのエージェントセットアップ（Claude Code / Codex /
Cursor）、Studio、そして A/B ベンチマークハーネス。

**正直な制約。** 公開されたベンチマークは**探索的（exploratory、各アーム n<5 ——
方向性を示すだけで、有意ではありません）**です。KawnGraph は、不慣れな複数ファイルにまたがる
発見作業で最も役立ち、すでに焦点の定まった単一ファイルのタスクではオーバーヘッドを加えることが
あります。まだ構築されていないもの: オプトインの提案専用フック、ビジュアルレイヤー、
セマンティック / AI による拡張、そしてランタイムレイヤー —— いずれも設計上オプトインです。
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md) を参照してください。

---

## ドキュメント

| ガイド | 内容 |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | インストール、スキャン、最初の Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | MCP セットアップの仕様、元に戻せること |
| [Context Packs](../CONTEXT_PACKS.md) | ランキング、予算、UCP のワイヤーフォーマット |
| [Graph model](../GRAPH_MODEL.md) | ノード、エッジ、レイヤー、エビデンス、ID |
| [Scanners](../SCANNERS.md) | 各言語プラグインが抽出する内容 |
| [Benchmarks](../BENCHMARKS.md) | 方法論、環境、完全な結果 |
| [Comparison](../COMPARISON.md) | 日付入り・出典付きの能力比較 |
| [Privacy](../PRIVACY.md) | レイヤーごとのデータ境界 |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | よくある問題と質問 |

---

## コントリビューション

コントリビューションを歓迎します。ソースからビルドし、スイートを実行し、ガイドを読んでください。

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

セットアップ、規約、そしてすべての PR が通るプライバシーレビューについては
**[CONTRIBUTING.md](../../CONTRIBUTING.md)** を、コミュニティへの期待については
**[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** を、言語の追加やレビューについては
**[docs/i18n/TRANSLATING.md](TRANSLATING.md)** を、質問の場所については
**[SUPPORT.md](../../SUPPORT.md)** を参照してください。

---

## ライセンスと謝辞

**[MIT](../../LICENSE)** © KawnGraph contributors.

**Kawn**（アラビア語 **كَوْن** —— *コスモス、宇宙、存在*）はリポジトリを、生きた知識の宇宙として
扱います。**Graph** は、その中核にあるエビデンスに裏付けられた Agent Context Graph です。
[TypeScript](https://www.typescriptlang.org/)、[Vite](https://vitejs.dev/)、
[React](https://react.dev/)、[React Flow](https://reactflow.dev/)、
[Three.js](https://threejs.org/)、[`@lezer/python`](https://lezer.codemirror.net/) で
構築されています。
