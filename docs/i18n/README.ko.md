<!-- KAWN-TRANSLATION
lang: ko
status: machine-assisted
canonical: README.md
canonical-sha: 378fe71dbff6e5a8bebc6ce9c8c96d427ad754aaaf43ef147000acf36ac4e022
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### 에이전트 컨텍스트 유니버스

**하나의 프로젝트 유니버스. 모든 코딩 에이전트.**

[English](../../README.md) · [العربية](../../README.ar.md) · [한국어] (현재) · [translation status](STATUS.md)

> 이 번역은 기계 보조(machine-assisted) 번역이며 오류가 있을 수 있습니다. 정본(canonical)은 영어 [README.md](../../README.md)입니다. 번역 상태는 [STATUS.md](STATUS.md)를 참고하세요.

</div>

---

## KawnGraph란?

코딩 에이전트에게 작업을 맡기면, 보통 *읽는 것*부터 시작합니다 — 그것도 아주 많이.
수십 개의 파일을 열고, 라우트가 어떻게 데이터베이스에 도달하는지 다시 추론하며,
매 요청마다 동일한 멘탈 모델을 재구성합니다. 이는 느리고, 토큰 비용이 크며, 종종
부정확합니다: 에이전트는 정작 중요한 단 하나의 파일을 놓치고 중요하지 않은 다섯
개의 파일에 빠져 버립니다.

KawnGraph는 리포지토리를 **한 번** 스캔하여, 요소들이 서로 어떻게 관련되는지를
담은 계층적이고 증거 기반의 그래프를 구축한 다음, 특정 작업에 대해 **정말 중요한
몇 개의 파일** — 그리고 관련 문서, 연관된 데이터베이스 테이블, 실행할 테스트,
주의해야 할 위험 요소 — 로 답합니다. 그 묶음이 **Context Pack**입니다. 그래프는
기반(substrate)이고, Context Pack은 결과물(product)입니다.

> **에이전트에게 리포지토리가 아니라 지도를 주세요.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## 빠른 시작

> **유의 사항:** `kawngraph` npm 패키지는 **아직 게시되지 않았으므로**,
> `npx kawngraph …` 는 오늘 기준으로 *사용할 수 없습니다*. 아래의 소스 기반
> 경로를 사용하세요. `npx` 방식은 **게시 이후**를 위해 표시해 둔 것입니다.

**오늘 — 소스에서** (이 모노레포, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**npm 게시 이후** (의도된 단일 명령 경험):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

그런 다음 에이전트를 열고 작업을 설명하기만 하면 됩니다 — 정말 중요한 몇 개의
파일을 스스로 가져옵니다. 스캔이나 검색 중에 API 키도, 텔레메트리도, 네트워크
호출도 없습니다. 처음 사용하시나요? **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)** 로 시작하세요.

---

## 코딩 에이전트에 연결하기

KawnGraph의 핵심은 에이전트가 **자동으로** 지도를 가져온다는 점입니다.
하나의 명령으로 프로젝트를 사용하는 에이전트들과 연결합니다 — `CLAUDE.md`나
`AGENTS.md`를 편집하지 않으며, 모든 변경은 되돌릴 수 있습니다:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup`은 **Claude Code**, **Codex**, **Cursor**를 감지하여 프로젝트 범위로
한정된 **읽기 전용 MCP 통합**(`.mcp.json`, `.cursor/mcp.json`, 또는
`.codex/config.toml`)을 설치하고, 건드리는 모든 것을 백업하며, 라이브 핸드셰이크로
서버를 검증합니다. 전체 계약(contract):
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**MCP 서버**는 의존성이 전혀 없는 읽기 전용 stdio JSON-RPC이며 네 가지 도구를 제공합니다:

| 도구 | 하는 일 |
| ---- | ------------ |
| `kawn_context` | 작업에 맞춘 토큰 예산형 Context Pack. |
| `kawn_query` | 그래프에 대한 순위 기반·모드 한정 검색. |
| `kawn_affected` | 역방향 영향: 어떤 심볼에 무엇이 의존하는지. |
| `kawn_changes` | 현재 변경 집합(커밋되지 않은 것, 또는 브랜치 대 베이스 ref)의 영향. 로컬 git 전용. |

이 서버는 그래프를 **읽기만** 합니다 — 절대 스캔하거나, 재구축하거나, 기록하지
않습니다(그래프가 오래된 것으로 보이면 경고하고 `kawn update`를 안내합니다).

---

## 작동 방식

프로젝트는 단순히 코드만이 아닙니다. 코드 **그리고** 문서 **그리고** SQL
**그리고** 테스트 **그리고** 이들을 묶는 구성(configuration)입니다. KawnGraph는
각각을 별개의 **레이어(layer)** 로 모델링하므로, 쿼리는 필요한 것을 정확히
요청하고 필요 없는 것은 가져오지 않습니다 — 코드 영향 쿼리는 마케팅 문서를 절대
끌어오지 않고, 문서 쿼리는 요청하지 않는 한 원시 콜 그래프를 절대 반환하지
않습니다.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph는 결정론적 스캐너로 리포지토리를 읽어 .kawn/graph.json에 하나의 계층적 그래프(code, data, config, docs, test 레이어)를 구축하고, 이를 kawn CLI, MCP 서버, Studio에 읽기 전용으로 제공합니다. 네트워크도, LLM도, 텔레메트리도 없습니다." width="860">
</div>

| 레이어    | 예시                                                |
| -------- | --------------------------------------------------- |
| `code`   | 파일, 함수, 클래스, import, 호출, 라우트              |
| `data`   | SQL 테이블, 마이그레이션, 외래 키                    |
| `config` | 워크스페이스 패키지, 의존성                          |
| `docs`   | 마크다운 섹션, 링크, 언급(mention)                  |
| `test`   | 테스트와 그것이 커버하는 대상                        |

모든 엣지(edge)는 **증거(evidence)**(소스 경로, 줄 범위, 스니펫)와 신뢰 수준을
지니고, 모든 노드(node)는 **안정적이고 콘텐츠 주소 지정형(content-addressable)
ID**를 가지므로 그래프는 스캔 간에 diff 가능한 상태를 유지합니다. 더 깊은 모델:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Context Pack, 처음부터 끝까지

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

동일한 팩은 Markdown, JSON, 또는 에이전트 중립적인 **Universal Context
Protocol**(`--format ucp` / `ucp-md`) 형태로도 제공됩니다. 더 보기:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map`은 **KawnGraph Studio**를 엽니다 — `127.0.0.1`로 제공되는 로컬
**읽기 전용** 탐색기로, 기존 `.kawn/graph.json`을 읽기만 하며 절대 스캔하거나,
재구축하거나, 기록하지 않습니다. 인터랙티브 2D 그래프, 확장 가능한 3D "Universe"
별자리 지도(한 번에 큰 그래프 전체를 그리지 않도록 예산이 적용됨), Context-Pack
빌더, 역방향 영향, Git 변경 뷰, 그리고 행동 기반 벤치마크 뷰를 제공합니다. 영어와
아랍어(RTL 지원)로 구축되었습니다. 소스에서 `pnpm studio:build &&
pnpm kawn map`으로 실행하세요.

> 캡처된 Studio 스크린샷은 다음 시각 캡처 작업 이후 `docs/assets/`에 추가될
> 예정입니다. 그때까지는 위의 다이어그램이 정본 시각 자료입니다.

---

## KawnGraph 대 일반 리포지토리 검색

*접근 방식*에 대한 중립적 비교입니다(경쟁사 공격이 아닙니다). 모든 셀은 옹호
가능하며, "varies"는 특정 도구에 따라 달라짐을 뜻합니다.

| 역량 | 일반 검색 | 일반 RAG | 범용 그래프 뷰어 | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| 결정론적 로컬 스캔 | ✅ | varies | ✅ | ✅ |
| 심볼 수준 관계 | ❌ | varies | ✅ | ✅ |
| 문서 / 데이터 / 테스트 레이어 | ❌ | varies | varies | ✅ |
| 모든 엣지에 증거 | ❌ | ❌ | varies | ✅ |
| 경계가 있는 영향 분석 | ❌ | ❌ | varies | ✅ |
| Git 변경 컨텍스트 | varies | ❌ | ❌ | ✅ |
| 토큰 예산형 Context Pack | ❌ | varies | ❌ | ✅ |
| 읽기 전용 MCP 검색 | ❌ | varies | varies | ✅ |
| 내부 LLM 불필요 | ✅ | ❌ | ✅ | ✅ |

성숙한 그래프 도구와의 날짜 표기·출처 기반 3열 비교(KawnGraph가 앞서는 역량
**그리고** 그렇지 않은 역량)는
**[docs/COMPARISON.md](../COMPARISON.md)** 에 있습니다.

---

## 벤치마크

KawnGraph는 *같은* 에이전트를 *같은* 작업에 대해 **KawnGraph 유무**에 따라
실행하고 행동을 기록하는 **로컬 A/B 하니스(harness)** 를 제공합니다. 결과는
정직하며 **작업에 따라 달라집니다** — 중립적 사례와 부정적 사례를 포함합니다.

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

방법론, 환경, 표본 크기, 메트릭별 표, 그리고 한계:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — 커밋되고 검증된 산출물(artifact)인
[`benchmarks/published/`](../../benchmarks/published/)에서 생성됩니다.

---

## 지원되는 스캐너 및 레이어

모든 언어/형식은 하나의 레지스트리 뒤에 있는 버전 관리되는 **스캐너 플러그인**입니다
(detect → scan → finalize): 결정론적 순서, 파일별 실패 격리, 명시적 등록, 그리고
파일 크기 제한.

| 언어 / 형식 | 추출 대상 |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

두 코드 스캐너 모두에 의도적인 두 가지 생략이 있습니다: 메서드/중첩 함수는 절대
별도의 노드가 되지 않으며(메서드는 메타데이터로서 그 클래스에 얹힘), 앰비언트
선언 파일(`.d.ts`, `.pyi`)은 절대 다뤄지지 않습니다. 자세히:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## 개인정보 보호 및 보안

- **기본적으로 네트워크 없음.** 스캔과 검색은 리포지토리를 읽고 `.kawn/` 아래에
  JSON을 기록합니다. 어떤 것도 머신을 떠나지 않습니다.
- **내부 LLM 없음.** 코드, 문서, SQL은 구조적으로 파싱됩니다. AI 보강(enrichment)은
  옵트인이며 로컬 우선입니다.
- **텔레메트리 없음. 기본적으로 쿼리 로깅 없음.**
- **읽기 전용 MCP.** 서버는 그래프를 제공하기만 합니다. 절대 스캔하거나,
  재구축하거나, 기록하지 않으며 — 스키마를 신뢰할 수 없는 그래프는 제공을
  거부합니다.
- **되돌릴 수 있고 프로젝트 범위로 한정된 통합.** 원자적(atomic) 쓰기, 타임스탬프
  백업, 문자열이 아닌 구조적 구성 편집. `CLAUDE.md` / `AGENTS.md`를 절대 편집하지
  않으며, 기본적으로 전역 구성을 절대 건드리지 않습니다.

전체 모델: **[docs/PRIVACY.md](../PRIVACY.md)**. 취약점은
**[SECURITY.md](../../SECURITY.md)** 를 통해 비공개로 보고하세요.

---

## 상태 및 한계

KawnGraph는 **활발히 개발 중**입니다(`v0.1.0`, npm에는 아직 게시되지 않음). 다음은
엔드 투 엔드로 구축되고 테스트되었습니다: code/data/config/docs/test 그래프,
문서-코드 링크, 모드 한정 쿼리, 영향 분석, Git/PR 영향, 토큰 예산형 Context Pack,
Universal Context Protocol, 읽기 전용 MCP 서버, 단일 명령 에이전트 setup
(Claude Code / Codex / Cursor), Studio, 그리고 A/B 벤치마크 하니스.

**정직한 한계.** 게시된 벤치마크는 **탐색적이며(arm당 n<5 — 방향성 참고용이고
유의미하지 않음)**입니다. KawnGraph는 익숙하지 않은 다중 파일 탐색에서 가장 도움이
되며, 이미 초점이 맞춰진 단일 파일 작업에서는 오버헤드를 더할 수 있습니다. 아직
구축되지 않음: 옵트인 제안 전용(suggest-only) 훅, 시각 레이어, 시맨틱/AI 보강,
그리고 런타임 레이어 — 모두 설계상 옵트인입니다. 참고:
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## 문서

| 가이드 | 내용 |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | 설치, 스캔, 첫 Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | MCP 설정 계약, 되돌림 가능성 |
| [Context Packs](../CONTEXT_PACKS.md) | 순위, 예산, UCP 와이어 포맷 |
| [Graph model](../GRAPH_MODEL.md) | 노드, 엣지, 레이어, 증거, ID |
| [Scanners](../SCANNERS.md) | 각 언어 플러그인이 추출하는 것 |
| [Benchmarks](../BENCHMARKS.md) | 방법론, 환경, 전체 결과 |
| [Comparison](../COMPARISON.md) | 날짜 표기·출처 기반 역량 비교 |
| [Privacy](../PRIVACY.md) | 레이어별 데이터 경계 |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | 흔한 문제 및 질문 |

---

## 기여

기여를 환영합니다. 소스에서 빌드하고, 테스트 스위트를 실행하고, 가이드를 읽어 보세요:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

설정, 컨벤션, 그리고 모든 PR이 통과하는 개인정보 검토는
**[CONTRIBUTING.md](../../CONTRIBUTING.md)** 를, 커뮤니티 기대 사항은
**[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** 를, 언어를 추가하거나 검토하려면
**[docs/i18n/TRANSLATING.md](TRANSLATING.md)** 를, 질문할 곳은
**[SUPPORT.md](../../SUPPORT.md)** 를 참고하세요.

---

## 라이선스 및 감사의 말

**[MIT](../../LICENSE)** © KawnGraph contributors.

**Kawn**(아랍어 **كَوْن** — *코스모스, 우주, 존재*)은 리포지토리를 살아 있는
지식의 우주로 다루며, **Graph**는 그 중심에 있는 증거 기반의 Agent Context
Graph입니다. [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/), 그리고
[`@lezer/python`](https://lezer.codemirror.net/)로 구축되었습니다.
