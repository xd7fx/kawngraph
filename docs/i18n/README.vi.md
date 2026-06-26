<!-- KAWN-TRANSLATION
lang: vi
status: machine-assisted
canonical: README.md
canonical-sha: 4ee6b7e69d4b76a495518d81d0f489290e0a9a198ba47984ed732e6cb691ea6c
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### Vũ trụ ngữ cảnh cho agent

**Một vũ trụ dự án. Mọi agent lập trình.**

[English](../../README.md) · [العربية](../../README.ar.md) · [Tiếng Việt] (hiện tại) · [trạng thái dịch thuật](STATUS.md)

> Bản dịch này được hỗ trợ bằng máy (machine-assisted) và có thể chứa lỗi. Bản tiếng Anh tại [README.md](../../README.md) là bản chuẩn (canonical). Xem [STATUS.md](STATUS.md) để biết tình trạng dịch thuật.

</div>

---

## Tại sao chọn KawnGraph?

Khi bạn giao một tác vụ cho agent lập trình, nó thường bắt đầu bằng việc *đọc* — rất nhiều. Nó mở hàng chục tệp, suy luận lại cách các route đi đến cơ sở dữ liệu, và dựng lại cùng một mô hình tư duy trong mỗi lần yêu cầu. Điều đó chậm, tốn token, và thường không chính xác: agent bỏ lỡ đúng tệp quan trọng và chìm trong năm tệp không quan trọng.

KawnGraph quét kho mã **một lần**, dựng nên một đồ thị phân lớp, có bằng chứng đi kèm, về cách mọi thứ liên hệ với nhau, rồi trả lời, cho một tác vụ cụ thể, với **vài tệp thực sự quan trọng** — cộng thêm các tài liệu liên quan, các bảng cơ sở dữ liệu liên quan, các bài kiểm thử cần chạy, và các rủi ro cần để ý. Gói đó là một **Context Pack**. Đồ thị là nền tảng; Context Pack là sản phẩm.

> **Hãy đưa cho agent tấm bản đồ, không phải cả kho mã.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Bắt đầu nhanh

> **Lưu ý:** gói npm `kawngraph` **chưa được xuất bản**, nên
> `npx kawngraph …` *chưa* khả dụng hôm nay. Hãy dùng đường dẫn từ mã nguồn bên dưới; luồng
> `npx` được hiển thị cho **sau khi xuất bản**.

**Hôm nay — từ mã nguồn** (monorepo này, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Sau khi xuất bản npm** (trải nghiệm một lệnh như dự định):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Sau đó mở agent của bạn và chỉ cần mô tả tác vụ — nó tự kéo về vài tệp quan trọng, một cách tự động. Không cần khóa API, không telemetry, không lệnh gọi mạng trong lúc quét hay truy xuất. Mới làm quen? Hãy bắt đầu với **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Kết nối nó với agent lập trình của bạn

Điểm cốt lõi của KawnGraph là agent tự tìm đến tấm bản đồ **một cách tự động**.
Một lệnh sẽ nối một dự án với các agent bạn dùng — mà không cần chỉnh sửa `CLAUDE.md`
hay `AGENTS.md`, mọi thay đổi đều có thể hoàn tác:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` phát hiện **Claude Code**, **Codex**, và **Cursor** rồi cài đặt một
**tích hợp MCP chỉ đọc** giới hạn trong phạm vi dự án (`.mcp.json`,
`.cursor/mcp.json`, hoặc `.codex/config.toml`), sao lưu mọi thứ mà nó chạm vào và
xác minh máy chủ bằng một lần bắt tay trực tiếp. Hợp đồng đầy đủ:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**Máy chủ MCP** là stdio JSON-RPC chỉ đọc, không phụ thuộc gì, với bốn công cụ:

| Công cụ | Nó làm gì |
| ---- | ------------ |
| `kawn_context` | Context Pack giới hạn theo ngân sách token cho một tác vụ. |
| `kawn_query` | Tìm kiếm có xếp hạng, giới hạn theo chế độ trên đồ thị. |
| `kawn_affected` | Tác động ngược: cái gì phụ thuộc vào một ký hiệu (symbol). |
| `kawn_changes` | Tác động của tập thay đổi hiện tại (chưa commit, hoặc một nhánh so với một ref nền). Chỉ git cục bộ. |

Nó **chỉ đọc** đồ thị — không bao giờ quét, dựng lại, hay ghi (nó cảnh báo
khi đồ thị có vẻ cũ và chỉ tới `kawn update`).

---

## Cách hoạt động

Một dự án không chỉ là mã nguồn. Nó là mã nguồn **và** tài liệu **và** SQL **và** bài kiểm thử
**và** cấu hình gắn kết tất cả lại. KawnGraph mô hình hóa từng thứ thành một
**lớp (layer)** riêng biệt, để một truy vấn yêu cầu đúng những gì nó cần và không gì nó không
cần — một truy vấn tác động mã sẽ không bao giờ kéo theo tài liệu marketing; một truy vấn tài liệu không bao giờ
trả về đồ thị lệnh gọi thô trừ khi bạn yêu cầu.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph đọc kho mã của bạn bằng các trình quét xác định (deterministic scanners) thành một đồ thị phân lớp tại .kawn/graph.json (các lớp code, data, config, docs, test), phục vụ chỉ đọc cho CLI kawn, máy chủ MCP, và Studio. Không mạng, không LLM, không telemetry." width="860">
</div>

| Lớp    | Ví dụ                                            |
| -------- | --------------------------------------------------- |
| `code`   | tệp, hàm, lớp, import, lệnh gọi, route   |
| `data`   | bảng SQL, migration, khóa ngoại                |
| `config` | gói workspace, phụ thuộc                    |
| `docs`   | mục markdown, liên kết, đề cập                  |
| `test`   | bài kiểm thử và những gì chúng bao phủ                           |

Mỗi cạnh mang theo **bằng chứng** (đường dẫn nguồn, khoảng dòng, đoạn trích) và một
mức độ tin cậy; mỗi nút có một **ID ổn định, có thể định địa chỉ theo nội dung** để
đồ thị có thể so sánh khác biệt (diffable) qua các lần quét. Mô hình sâu hơn:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Một Context Pack, từ đầu đến cuối

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

Cùng gói đó cũng có sẵn dưới dạng Markdown, JSON, hoặc **Universal
Context Protocol** trung lập với agent (`--format ucp` / `ucp-md`). Thêm:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` mở **KawnGraph Studio** — một trình khám phá cục bộ, **chỉ đọc**, phục vụ
qua `127.0.0.1`, đọc tệp `.kawn/graph.json` hiện có và không bao giờ quét,
dựng lại, hay ghi. Nó cung cấp một đồ thị 2D tương tác, một bản đồ sao "Universe" 3D có thể mở rộng
(giới hạn theo ngân sách để không bao giờ vẽ cả một đồ thị lớn cùng lúc), một trình dựng Context-Pack,
tác động ngược, các khung xem thay đổi Git, và một khung xem benchmark hành vi. Được dựng
bằng tiếng Anh và tiếng Ả Rập (nhận biết RTL). Chạy nó từ mã nguồn với `pnpm studio:build &&
pnpm kawn map`.

> Một ảnh chụp màn hình Studio sẽ được thêm vào `docs/assets/` sau lượt
> chụp hình ảnh kế tiếp; cho đến lúc đó các sơ đồ ở trên là hình ảnh chuẩn (canonical).

---

## KawnGraph so với tìm kiếm kho mã thông thường

Một so sánh trung lập về *cách tiếp cận* (không phải đả kích đối thủ). Mọi ô đều
có thể bảo vệ được; "varies" nghĩa là tùy thuộc vào công cụ cụ thể.

| Năng lực | Tìm kiếm thuần | RAG tổng quát | Trình xem đồ thị chung | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Quét cục bộ xác định | ✅ | varies | ✅ | ✅ |
| Quan hệ ở cấp ký hiệu (symbol) | ❌ | varies | ✅ | ✅ |
| Các lớp docs / data / test | ❌ | varies | varies | ✅ |
| Bằng chứng trên mọi cạnh | ❌ | ❌ | varies | ✅ |
| Phân tích tác động có giới hạn | ❌ | ❌ | varies | ✅ |
| Ngữ cảnh thay đổi Git | varies | ❌ | ❌ | ✅ |
| Context Pack giới hạn theo token | ❌ | varies | ❌ | ✅ |
| Truy xuất MCP chỉ đọc | ❌ | varies | varies | ✅ |
| Không cần LLM nội bộ | ✅ | ❌ | ✅ | ✅ |

Một bản so sánh ba cột có ghi ngày tháng, có nguồn, đối chiếu với một công cụ đồ thị trưởng thành
(các năng lực KawnGraph dẫn đầu **và** các năng lực nó chưa có) nằm tại
**[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmark

KawnGraph đi kèm một **bộ thử A/B cục bộ** chạy *cùng* một agent trên *cùng* một
tác vụ **có vs không có** KawnGraph và ghi lại hành vi. Kết quả là trung thực và
**phụ thuộc vào tác vụ** — bao gồm cả các trường hợp trung lập và tiêu cực.

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

Phương pháp luận, môi trường, kích thước mẫu, các bảng theo từng chỉ số, và các giới hạn:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — được sinh ra từ tạo phẩm đã commit,
đã được xác thực trong [`benchmarks/published/`](../../benchmarks/published/).

---

## Các trình quét & lớp được hỗ trợ

Mỗi ngôn ngữ/định dạng là một **scanner plugin** có phiên bản đứng sau một registry chung
(detect → scan → finalize): thứ tự xác định, cô lập lỗi theo từng tệp,
đăng ký tường minh, và giới hạn kích thước tệp.

| Ngôn ngữ / định dạng | Trích xuất |
| ----------------- | --------- |
| TypeScript / JS   | tệp, hàm/lớp ở cấp cao nhất, import, lệnh gọi, route Next.js, bài kiểm thử |
| Python            | `def`/`async def`/`class` ở cấp cao nhất, decorator, phương thức (dưới dạng metadata), import, route FastAPI/Flask, docstring, bài kiểm thử (qua `@lezer/python` — thuần JS, chịu lỗi tốt) |
| SQL               | bảng (`CREATE`/`ALTER`), quan hệ khóa ngoại |
| package.json      | gói workspace và phụ thuộc nội bộ |
| Markdown          | tiêu đề/mục liên kết tới code, SQL, và route |

Hai sự lược bỏ có chủ đích trong cả hai trình quét mã: phương thức/hàm lồng nhau
không bao giờ là nút riêng (một phương thức gắn vào lớp của nó dưới dạng metadata), và các
tệp khai báo ambient (`.d.ts`, `.pyi`) không bao giờ được nhận. Chi tiết:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Quyền riêng tư & bảo mật

- **Không mạng theo mặc định.** Quét và truy xuất đọc kho mã của bạn và ghi JSON
  dưới `.kawn/`. Không gì rời khỏi máy.
- **Không có LLM nội bộ.** Mã, tài liệu, và SQL được phân tích về mặt cấu trúc; làm giàu bằng AI
  là tùy chọn (opt-in) và ưu tiên cục bộ (local-first).
- **Không telemetry. Không ghi nhật ký truy vấn theo mặc định.**
- **MCP chỉ đọc.** Máy chủ phục vụ đồ thị; nó không bao giờ quét, dựng lại, hay
  ghi — và từ chối phục vụ một đồ thị có lược đồ mà nó không thể tin cậy.
- **Tích hợp có thể hoàn tác, giới hạn theo dự án.** Ghi nguyên tử (atomic), bản sao lưu
  có dấu thời gian, chỉnh sửa cấu hình có cấu trúc (không phải chuỗi); không bao giờ chỉnh `CLAUDE.md` /
  `AGENTS.md`, không bao giờ chạm vào cấu hình toàn cục theo mặc định.

Mô hình đầy đủ: **[docs/PRIVACY.md](../PRIVACY.md)**. Báo cáo lỗ hổng
một cách riêng tư qua **[SECURITY.md](../../SECURITY.md)**.

---

## Trạng thái & giới hạn

KawnGraph đang trong **giai đoạn phát triển tích cực** (`v0.1.0`, chưa xuất bản lên npm). Đã được dựng
và kiểm thử từ đầu đến cuối: đồ thị code/data/config/docs/test, liên kết docs-to-code,
truy vấn giới hạn theo chế độ, phân tích tác động, tác động Git/PR, Context Pack giới hạn theo token,
Universal Context Protocol, máy chủ MCP chỉ đọc, thiết lập agent một lệnh
(Claude Code / Codex / Cursor), Studio, và bộ thử benchmark A/B.

**Giới hạn trung thực.** Benchmark đã xuất bản mang tính **thăm dò (n<5 mỗi nhánh —
chỉ định hướng, không có ý nghĩa thống kê)**. KawnGraph giúp ích nhiều nhất với việc khám phá nhiều tệp
chưa quen và có thể làm tăng chi phí với các tác vụ một tệp đã tập trung sẵn. Chưa được dựng:
hook chỉ-gợi-ý tùy chọn, lớp trực quan, làm giàu ngữ nghĩa/AI, và một
lớp runtime — tất cả đều là tùy chọn theo thiết kế. Xem
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Tài liệu

| Hướng dẫn | Nội dung bên trong |
| ----- | ------------- |
| [Bắt đầu](../GETTING_STARTED.md) | Cài đặt, quét, Context Pack đầu tiên |
| [Tích hợp agent](../AGENT_INTEGRATION.md) | Hợp đồng thiết lập MCP, khả năng hoàn tác |
| [Context Pack](../CONTEXT_PACKS.md) | Xếp hạng, ngân sách, định dạng truyền UCP |
| [Mô hình đồ thị](../GRAPH_MODEL.md) | Nút, cạnh, lớp, bằng chứng, ID |
| [Trình quét](../SCANNERS.md) | Mỗi plugin ngôn ngữ trích xuất gì |
| [Benchmark](../BENCHMARKS.md) | Phương pháp luận, môi trường, kết quả đầy đủ |
| [So sánh](../COMPARISON.md) | So sánh năng lực có ghi ngày tháng, có nguồn |
| [Quyền riêng tư](../PRIVACY.md) | Ranh giới dữ liệu theo từng lớp |
| [Khắc phục sự cố](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Vấn đề & câu hỏi thường gặp |

---

## Đóng góp

Hoan nghênh các đóng góp. Hãy build từ mã nguồn, chạy bộ kiểm thử, và đọc hướng dẫn:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Xem **[CONTRIBUTING.md](../../CONTRIBUTING.md)** để biết thiết lập, quy ước, và quy trình
soát xét quyền riêng tư mà mọi PR phải qua; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** để biết
kỳ vọng cộng đồng; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**
để thêm hoặc soát xét một ngôn ngữ; và **[SUPPORT.md](../../SUPPORT.md)** để biết nơi đặt
câu hỏi.

---

## Giấy phép & ghi nhận

**[MIT](../../LICENSE)** © những người đóng góp KawnGraph.

**Kawn** (tiếng Ả Rập **كَوْن** — *vũ trụ, không gian, sự tồn tại*) coi một kho mã như
một vũ trụ tri thức sống động; **Graph** là Agent Context
Graph có bằng chứng đi kèm ở lõi của nó. Được dựng với [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/), và
[`@lezer/python`](https://lezer.codemirror.net/).
