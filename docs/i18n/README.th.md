<!-- KAWN-TRANSLATION
lang: th
status: machine-assisted
canonical: README.md
canonical-sha: 9ae23d43afac34187e2ed17d64244ea5b65352f88f470cbc2818ff41eb15e312
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### จักรวาลบริบทสำหรับเอเจนต์ (The Agent Context Universe)

**จักรวาลโปรเจกต์เดียว สำหรับเอเจนต์เขียนโค้ดทุกตัว**

KawnGraph จับคู่โค้ด เอกสาร ข้อมูล เทสต์ และการเปลี่ยนแปลงใน Git ให้กลายเป็น
**Context Pack** ที่มีหลักฐานรองรับ เพื่อให้ Claude, Codex และ Cursor เข้าถึงไฟล์ที่ถูกต้องได้
โดยไม่ต้องอ่านทั้งรีโพซิทอรี

[English](../../README.md) · [العربية](../../README.ar.md) · [ภาษาไทย] (current) · [translation status](STATUS.md)

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA.svg?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/xd7fx)

> คำแปลนี้จัดทำโดยเครื่องช่วยแปล (machine-assisted) และอาจมีข้อผิดพลาด ฉบับภาษาอังกฤษคือฉบับต้นทาง (canonical) ที่ [README.md](../../README.md) ดูสถานะการแปลได้ที่ [STATUS.md](STATUS.md)

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="งานหนึ่ง ('แก้ไข Zid OAuth callback') ไหลเข้าสู่ KawnGraph ซึ่งคืนค่า Context Pack ที่อยู่ในงบประมาณโทเคน ได้แก่ ไฟล์ที่ต้องอ่าน เอกสารที่เกี่ยวข้อง ตาราง เทสต์ ความเสี่ยง รายการที่ถูกตัดออก และคะแนนความเชื่อมั่น" width="860">
</div>

---

## ทำไมต้อง KawnGraph?

เมื่อคุณมอบงานให้เอเจนต์เขียนโค้ด มันมักจะเริ่มด้วยการ *อ่าน* — อ่านเยอะมาก
มันเปิดไฟล์นับสิบ ไล่ดูใหม่ว่า route เชื่อมไปถึงฐานข้อมูลอย่างไร และสร้างแบบจำลองความคิด
เดิมขึ้นใหม่ในทุก ๆ คำขอ นั่นทั้งช้า สิ้นเปลืองโทเคน และมักไม่แม่นยำ คือเอเจนต์พลาดไฟล์
สำคัญเพียงไฟล์เดียว แล้วจมอยู่กับไฟล์ที่ไม่เกี่ยวอีกห้าไฟล์

KawnGraph สแกนรีโพซิทอรี **เพียงครั้งเดียว** สร้างกราฟแบบเป็นชั้น (layered) ที่มีหลักฐาน
รองรับว่าสิ่งต่าง ๆ เกี่ยวข้องกันอย่างไร แล้วตอบสำหรับงานเฉพาะหนึ่ง ๆ ด้วย **ไฟล์ไม่กี่ไฟล์
ที่สำคัญจริง ๆ** — พร้อมกับเอกสารที่เกี่ยวข้อง ตารางฐานข้อมูลที่เกี่ยวข้อง เทสต์ที่ต้องรัน และ
ความเสี่ยงที่ต้องเฝ้าระวัง ชุดนี้แหละคือ **Context Pack** กราฟคือพื้นฐาน (substrate) ส่วน
Context Pack คือผลิตภัณฑ์ (product)

> **มอบแผนที่ให้เอเจนต์ ไม่ใช่ทั้งรีโพ** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## เริ่มต้นอย่างรวดเร็ว (Quick Start)

> **โปรดทราบ:** แพ็กเกจ npm ชื่อ `kawngraph` **ยังไม่ได้เผยแพร่** ดังนั้น
> `npx kawngraph …` จึง *ยังไม่พร้อมใช้งาน* ในตอนนี้ ให้ใช้เส้นทางจากซอร์สด้านล่างแทน
> ส่วนขั้นตอน `npx` แสดงไว้สำหรับ **หลังการเผยแพร่**

**ตอนนี้ — จากซอร์ส** (โมโนรีโพนี้, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**หลังการเผยแพร่บน npm** (ประสบการณ์แบบคำสั่งเดียวตามที่ตั้งใจไว้):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

จากนั้นเปิดเอเจนต์ของคุณแล้วเพียงแค่อธิบายงานของคุณ — มันจะดึงไฟล์ไม่กี่ไฟล์ที่สำคัญมาเอง
ไม่มี API key ไม่มี telemetry ไม่มีการเรียกผ่านเครือข่ายระหว่างการสแกนหรือการดึงข้อมูล
เพิ่งเริ่มใช้งานใช่ไหม? เริ่มที่ **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**

---

## เชื่อมต่อกับเอเจนต์เขียนโค้ดของคุณ

ประเด็นสำคัญของ KawnGraph คือ เอเจนต์เอื้อมไปหยิบแผนที่ **โดยอัตโนมัติ**
คำสั่งเดียวเชื่อมโปรเจกต์เข้ากับเอเจนต์ที่คุณใช้ — โดยไม่ต้องแก้ไข `CLAUDE.md`
หรือ `AGENTS.md` และทุกการเปลี่ยนแปลงย้อนกลับได้:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` จะตรวจหา **Claude Code**, **Codex** และ **Cursor** แล้วติดตั้ง
**การเชื่อมต่อ MCP แบบอ่านอย่างเดียว** ที่จำกัดขอบเขตเฉพาะโปรเจกต์ (`.mcp.json`,
`.cursor/mcp.json` หรือ `.codex/config.toml`) พร้อมสำรองข้อมูลทุกอย่างที่มันแตะต้อง และ
ตรวจสอบเซิร์ฟเวอร์ด้วยการ handshake แบบสด สัญญาฉบับเต็ม:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**

**เซิร์ฟเวอร์ MCP** เป็น stdio JSON-RPC แบบอ่านอย่างเดียว ไม่มี dependency และมีเครื่องมือสี่ตัว:

| เครื่องมือ | หน้าที่ |
| ---- | ------------ |
| `kawn_context` | Context Pack ในงบประมาณโทเคนสำหรับงานหนึ่ง ๆ |
| `kawn_query` | การค้นหาในกราฟแบบจัดอันดับและจำกัดตามโหมด |
| `kawn_affected` | ผลกระทบย้อนกลับ: อะไรขึ้นอยู่กับสัญลักษณ์ (symbol) หนึ่ง ๆ |
| `kawn_changes` | ผลกระทบของชุดการเปลี่ยนแปลงปัจจุบัน (ยังไม่ commit หรือ branch เทียบกับ base ref) เฉพาะ git ในเครื่องเท่านั้น |

มัน **อ่านอย่างเดียว** จากกราฟ — ไม่เคยสแกน สร้างใหม่ หรือเขียนกราฟ (จะเตือนเมื่อกราฟ
ดูเก่าและชี้ไปที่ `kawn update`)

---

## หลักการทำงาน

โปรเจกต์ไม่ได้มีแค่โค้ด แต่เป็นโค้ด **และ** เอกสาร **และ** SQL **และ** เทสต์
**และ** การตั้งค่าที่ผูกทุกอย่างเข้าด้วยกัน KawnGraph สร้างแบบจำลองแต่ละส่วนเป็น **ชั้น (layer)**
ที่แยกจากกัน เพื่อให้แต่ละ query ขอเฉพาะสิ่งที่มันต้องการและไม่ได้สิ่งที่ไม่ต้องการ — query
เรื่องผลกระทบของโค้ดจะไม่ลากเอกสารการตลาดเข้ามา และ query เอกสารจะไม่คืน call graph ดิบ
เว้นแต่คุณจะร้องขอ

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph อ่านรีโพของคุณด้วยสแกนเนอร์แบบกำหนดผลแน่นอน รวมเป็นกราฟแบบเป็นชั้นเดียวที่ .kawn/graph.json (ชั้น code, data, config, docs, test) ให้บริการแบบอ่านอย่างเดียวแก่ kawn CLI, เซิร์ฟเวอร์ MCP และ Studio ไม่มีเครือข่าย ไม่มี LLM ไม่มี telemetry" width="860">
</div>

| ชั้น    | ตัวอย่าง                                            |
| -------- | --------------------------------------------------- |
| `code`   | files, functions, classes, imports, calls, routes   |
| `data`   | SQL tables, migrations, foreign keys                |
| `config` | workspace packages, dependencies                    |
| `docs`   | markdown sections, links, mentions                  |
| `test`   | tests and what they cover                           |

ทุกเส้นเชื่อม (edge) พก **หลักฐาน** (เส้นทางต้นทาง ช่วงบรรทัด สนิปเป็ต) และระดับ
ความเชื่อมั่น ทุกโหนดมี **ID ที่เสถียรและอ้างอิงตามเนื้อหา (content-addressable)** ดังนั้น
กราฟจึงยังคงเทียบความต่าง (diffable) ได้ข้ามการสแกนแต่ละครั้ง แบบจำลองเชิงลึก:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**

### Context Pack ตั้งแต่ต้นจนจบ (A Context Pack, end to end)

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

แพ็กชุดเดียวกันนี้มีให้ในรูปแบบ Markdown, JSON หรือ **Universal Context Protocol**
ที่เป็นกลางต่อเอเจนต์ (`--format ucp` / `ucp-md`) เพิ่มเติม:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**

---

## Studio

`kawn map` เปิด **KawnGraph Studio** — ตัวสำรวจในเครื่องแบบ **อ่านอย่างเดียว** ที่ให้บริการ
ผ่าน `127.0.0.1` ซึ่งอ่าน `.kawn/graph.json` ที่มีอยู่ และไม่เคยสแกน สร้างใหม่ หรือเขียน
มันมีกราฟ 2D แบบโต้ตอบได้ แผนที่ดาว "Universe" แบบ 3D ที่ขยายขนาดได้ (มีงบประมาณกำกับ
จึงไม่เคยวาดกราฟขนาดใหญ่ทั้งหมดในคราวเดียว) ตัวสร้าง Context Pack การวิเคราะห์ผลกระทบ
ย้อนกลับ มุมมองการเปลี่ยนแปลงใน Git และมุมมองเบนช์มาร์กเชิงพฤติกรรม สร้างด้วยภาษาอังกฤษ
และภาษาอาหรับ (รองรับ RTL) รันจากซอร์สด้วย `pnpm studio:build && pnpm kawn map`

> ภาพหน้าจอ Studio ที่ถ่ายไว้จะถูกเพิ่มลงใน `docs/assets/` หลังจากรอบการเก็บภาพ
> ครั้งถัดไป จนกว่าจะถึงตอนนั้น แผนภาพด้านบนคือภาพต้นทาง (canonical)

---

## KawnGraph เทียบกับการค้นหารีโพแบบธรรมดา

นี่คือการเปรียบเทียบ *แนวทาง* อย่างเป็นกลาง (ไม่ใช่การโจมตีคู่แข่ง) ทุกช่องมีเหตุผลรองรับได้
"varies" หมายถึงขึ้นอยู่กับเครื่องมือเฉพาะตัว

| ความสามารถ | ค้นหาแบบธรรมดา | RAG ทั่วไป | โปรแกรมดูกราฟทั่วไป | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| การสแกนในเครื่องแบบกำหนดผลแน่นอน | ✅ | varies | ✅ | ✅ |
| ความสัมพันธ์ระดับสัญลักษณ์ (symbol) | ❌ | varies | ✅ | ✅ |
| ชั้น docs / data / test | ❌ | varies | varies | ✅ |
| หลักฐานบนทุกเส้นเชื่อม | ❌ | ❌ | varies | ✅ |
| การวิเคราะห์ผลกระทบแบบมีขอบเขต | ❌ | ❌ | varies | ✅ |
| บริบทการเปลี่ยนแปลงใน Git | varies | ❌ | ❌ | ✅ |
| Context Pack ในงบประมาณโทเคน | ❌ | varies | ❌ | ✅ |
| การดึงข้อมูลผ่าน MCP แบบอ่านอย่างเดียว | ❌ | varies | varies | ✅ |
| ไม่ต้องใช้ LLM ภายใน | ✅ | ❌ | ✅ | ✅ |

การเปรียบเทียบสามคอลัมน์ที่มีวันที่และแหล่งอ้างอิง เทียบกับเครื่องมือกราฟที่พัฒนาเต็มที่
(ทั้งความสามารถที่ KawnGraph เหนือกว่า **และ** ความสามารถที่มันไม่เหนือกว่า) อยู่ที่
**[docs/COMPARISON.md](../COMPARISON.md)**

---

## เบนช์มาร์ก

KawnGraph มาพร้อม **ฮาร์เนส A/B ในเครื่อง** ที่รันเอเจนต์ *ตัวเดียวกัน* กับงาน *เดียวกัน*
**โดยมีและไม่มี** KawnGraph แล้วบันทึกพฤติกรรม ผลลัพธ์ซื่อสัตย์และ **ขึ้นอยู่กับงาน** —
รวมถึงกรณีที่เป็นกลางและกรณีเชิงลบ

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

ระเบียบวิธี สภาพแวดล้อม ขนาดตัวอย่าง ตารางแยกตามเมตริก และข้อจำกัด:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — สร้างขึ้นจากอาร์ติแฟกต์ที่ commit แล้วและ
ผ่านการตรวจสอบ ใน [`benchmarks/published/`](../../benchmarks/published/)

---

## สแกนเนอร์และชั้นที่รองรับ

ทุกภาษา/รูปแบบคือ **ปลั๊กอินสแกนเนอร์** ที่มีเวอร์ชันกำกับ อยู่หลัง registry เดียว
(detect → scan → finalize): ลำดับแบบกำหนดผลแน่นอน การแยกความล้มเหลวรายไฟล์
การลงทะเบียนอย่างชัดเจน และขนาดไฟล์ที่มีขอบเขตจำกัด

| ภาษา / รูปแบบ | สิ่งที่สกัดออกมา |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

มีการละเว้นโดยเจตนาสองอย่างในสแกนเนอร์โค้ดทั้งสองตัว: เมท็อด/ฟังก์ชันซ้อน (nested functions)
ไม่เคยเป็นโหนดแยกต่างหาก (เมท็อดติดอยู่กับคลาสของมันในรูปเมทาดาตา) และไฟล์ประกาศแบบ
ambient (`.d.ts`, `.pyi`) ไม่เคยถูกอ้างสิทธิ์ รายละเอียด:
**[docs/SCANNERS.md](../SCANNERS.md)**

---

## ความเป็นส่วนตัวและความปลอดภัย

- **ไม่มีเครือข่ายโดยค่าเริ่มต้น** การสแกนและการดึงข้อมูลอ่านรีโพของคุณและเขียน JSON
  ไว้ใต้ `.kawn/` ไม่มีอะไรออกจากเครื่อง
- **ไม่มี LLM ภายใน** โค้ด เอกสาร และ SQL ถูกแจงวิเคราะห์เชิงโครงสร้าง การเสริมด้วย AI
  เป็นแบบ opt-in และเน้นในเครื่องก่อน (local-first)
- **ไม่มี telemetry ไม่มีการบันทึก query โดยค่าเริ่มต้น**
- **MCP แบบอ่านอย่างเดียว** เซิร์ฟเวอร์ให้บริการกราฟ แต่ไม่เคยสแกน สร้างใหม่ หรือ
  เขียน — และปฏิเสธที่จะให้บริการกราฟที่มี schema ที่มันไว้ใจไม่ได้
- **การเชื่อมต่อที่ย้อนกลับได้และจำกัดขอบเขตเฉพาะโปรเจกต์** การเขียนแบบ atomic การสำรอง
  ข้อมูลที่มี timestamp การแก้ไขการตั้งค่าแบบมีโครงสร้าง (ไม่ใช่สตริง) ไม่เคยแก้ไข
  `CLAUDE.md` / `AGENTS.md` และไม่เคยแตะการตั้งค่าระดับ global โดยค่าเริ่มต้น

แบบจำลองฉบับเต็ม: **[docs/PRIVACY.md](../PRIVACY.md)** รายงานช่องโหว่เป็นการส่วนตัวผ่าน
**[SECURITY.md](../../SECURITY.md)**

---

## สถานะและข้อจำกัด

KawnGraph อยู่ระหว่าง **การพัฒนาอย่างต่อเนื่อง** (`v0.1.0` ยังไม่ได้เผยแพร่บน npm) สร้างและ
ทดสอบครบวงจรแบบ end-to-end แล้ว ได้แก่ กราฟ code/data/config/docs/test, ลิงก์จาก docs
ไปยัง code, query ที่จำกัดตามโหมด, การวิเคราะห์ผลกระทบ, ผลกระทบจาก Git/PR, Context Pack
ในงบประมาณโทเคน, Universal Context Protocol, เซิร์ฟเวอร์ MCP แบบอ่านอย่างเดียว, การติดตั้ง
เอเจนต์ด้วยคำสั่งเดียว (Claude Code / Codex / Cursor), Studio และฮาร์เนสเบนช์มาร์ก A/B

**ข้อจำกัดอย่างซื่อสัตย์** เบนช์มาร์กที่เผยแพร่เป็นแบบ **เชิงสำรวจ (exploratory — n<5 ต่ออาร์ม
บ่งทิศทางเท่านั้น ไม่มีนัยสำคัญ)** KawnGraph ช่วยได้มากที่สุดกับงานค้นหาแบบหลายไฟล์ที่
ไม่คุ้นเคย และอาจเพิ่มภาระให้กับงานไฟล์เดียวที่มีจุดโฟกัสอยู่แล้ว สิ่งที่ยังไม่ได้สร้าง: ฮุก
แบบ opt-in ที่เพียงให้คำแนะนำ (suggest-only), ชั้นภาพ (visual layer), การเสริมเชิง
ความหมาย/AI และชั้น runtime — ทั้งหมดเป็นแบบ opt-in โดยการออกแบบ ดูที่
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md)

---

## เอกสารประกอบ

| คู่มือ | เนื้อหาภายใน |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | ติดตั้ง สแกน Context Pack แรก |
| [Agent integration](../AGENT_INTEGRATION.md) | สัญญาการติดตั้ง MCP การย้อนกลับได้ |
| [Context Packs](../CONTEXT_PACKS.md) | การจัดอันดับ งบประมาณ รูปแบบ wire ของ UCP |
| [Graph model](../GRAPH_MODEL.md) | โหนด เส้นเชื่อม ชั้น หลักฐาน ID |
| [Scanners](../SCANNERS.md) | สิ่งที่ปลั๊กอินแต่ละภาษาสกัดออกมา |
| [Benchmarks](../BENCHMARKS.md) | ระเบียบวิธี สภาพแวดล้อม ผลลัพธ์ฉบับเต็ม |
| [Comparison](../COMPARISON.md) | การเปรียบเทียบความสามารถที่มีวันที่และแหล่งอ้างอิง |
| [Privacy](../PRIVACY.md) | ขอบเขตข้อมูลในแต่ละชั้น |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | ปัญหาและคำถามที่พบบ่อย |

---

## การร่วมพัฒนา

ยินดีรับการร่วมพัฒนา สร้างจากซอร์ส รันชุดทดสอบ และอ่านคู่มือ:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

ดู **[CONTRIBUTING.md](../../CONTRIBUTING.md)** สำหรับการติดตั้ง ข้อตกลง และการตรวจสอบ
ความเป็นส่วนตัวที่ทุก PR ต้องผ่าน; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** สำหรับ
ความคาดหวังของชุมชน; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)** สำหรับการเพิ่มหรือ
ตรวจทานภาษา; และ **[SUPPORT.md](../../SUPPORT.md)** สำหรับช่องทางถามคำถาม

---

## สัญญาอนุญาตและกิตติกรรมประกาศ

**[MIT](../../LICENSE)** © KawnGraph contributors.

**Kawn** (ภาษาอาหรับ **كَوْن** — *จักรวาล เอกภพ การดำรงอยู่*) มองรีโพซิทอรีเป็นจักรวาล
แห่งความรู้ที่มีชีวิต; **Graph** คือ Agent Context Graph ที่มีหลักฐานรองรับซึ่งเป็นแกนกลาง
สร้างด้วย [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/),
[React](https://react.dev/), [React Flow](https://reactflow.dev/),
[Three.js](https://threejs.org/) และ [`@lezer/python`](https://lezer.codemirror.net/)
