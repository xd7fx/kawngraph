<!-- KAWN-TRANSLATION
lang: id
status: machine-assisted
canonical: README.md
canonical-sha: b3379a444f5d5d0daf397ab919fb327c75e9b8b3d32b6ddd35e37ea76a810dc2
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### Semesta Konteks Agen

**Satu semesta proyek. Setiap agen koding.**

KawnGraph memetakan kode, dokumen, data, pengujian (test), dan perubahan Git ke dalam
**Context Pack** yang didukung bukti, sehingga Claude, Codex, dan Cursor dapat menjangkau
file yang tepat tanpa membaca seluruh repositori.

[English](../../README.md) · [العربية](../../README.ar.md) · [Bahasa Indonesia] (saat ini) · [status terjemahan](STATUS.md)

> Terjemahan ini dibuat dengan bantuan mesin (machine-assisted) dan mungkin mengandung
> kesalahan. Sumber kanonis berbahasa Inggris adalah [README.md](../../README.md); lihat
> [STATUS.md](STATUS.md).

</div>

---

## Mengapa KawnGraph?

Saat Anda memberi sebuah agen koding sebuah tugas, ia biasanya memulai dengan *membaca* —
banyak sekali. Ia membuka puluhan file, menurunkan ulang bagaimana route mencapai database,
dan membangun ulang model mental yang sama pada setiap permintaan. Itu lambat, boros token,
dan sering kali tidak akurat: agen melewatkan satu file yang penting dan tenggelam dalam lima
file yang tidak penting.

KawnGraph memindai repositori **sekali**, membangun graf berlapis yang didukung bukti tentang
bagaimana segala sesuatu saling berhubungan, lalu menjawab, untuk sebuah tugas tertentu, dengan
**sedikit file yang penting** — ditambah dokumen yang relevan, tabel database terkait, pengujian
(test) yang perlu dijalankan, dan risiko yang perlu diwaspadai. Bundel itu adalah **Context Pack**.
Graf adalah substratnya; Context Pack adalah produknya.

> **Beri agen petanya, bukan reponya.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Mulai Cepat

> **Perhatian:** paket npm `kawngraph` **belum dipublikasikan**, jadi
> `npx kawngraph …` *belum* tersedia hari ini. Gunakan jalur dari-sumber (from-source) di bawah;
> alur `npx` ditampilkan untuk **setelah publikasi**.

**Hari ini — dari sumber** (monorepo ini, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Setelah publikasi npm** (pengalaman satu-perintah yang dimaksudkan):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Lalu buka agen Anda dan cukup jelaskan tugas Anda — ia akan menarik sendiri sedikit file yang
penting. Tanpa API key, tanpa telemetri, tanpa panggilan jaringan selama pemindaian (scan) atau
pengambilan (retrieval). Baru mengenalnya? Mulai dengan **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Hubungkan ke agen koding Anda

Inti dari KawnGraph adalah agen menjangkau peta itu **secara otomatis**.
Satu perintah menyambungkan sebuah proyek ke agen yang Anda gunakan — tanpa mengedit `CLAUDE.md`
atau `AGENTS.md`, dan setiap perubahan dapat dibatalkan (reversible):

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` mendeteksi **Claude Code**, **Codex**, dan **Cursor** lalu memasang
**integrasi MCP read-only** yang dibatasi cakupannya ke proyek (`.mcp.json`,
`.cursor/mcp.json`, atau `.codex/config.toml`), mencadangkan (backup) apa pun yang disentuhnya, dan
memverifikasi server dengan handshake langsung. Kontrak lengkap:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**Server MCP** adalah stdio JSON-RPC read-only tanpa dependensi dan dengan empat tool:

| Tool | Apa yang dilakukannya |
| ---- | ------------ |
| `kawn_context` | Context Pack dengan anggaran token (token-budgeted) untuk sebuah tugas. |
| `kawn_query` | Pencarian berperingkat, terbatas-mode, di atas graf. |
| `kawn_affected` | Dampak terbalik: apa yang bergantung pada sebuah simbol. |
| `kawn_changes` | Dampak dari set perubahan saat ini (belum di-commit, atau sebuah branch vs sebuah base ref). Hanya git lokal. |

Ia **hanya membaca** graf — tidak pernah memindai, membangun ulang, atau menulisnya (ia memberi
peringatan saat graf tampak usang dan mengarahkan ke `kawn update`).

---

## Cara Kerjanya

Sebuah proyek bukan hanya kode. Ia adalah kode **dan** dokumen **dan** SQL **dan** pengujian (test)
**dan** konfigurasi yang mengikat semuanya. KawnGraph memodelkan masing-masing sebagai sebuah
**lapisan (layer)** yang berbeda, sehingga sebuah kueri meminta persis apa yang dibutuhkannya dan
tidak yang tidak dibutuhkannya — kueri dampak-kode tidak pernah menyeret dokumen pemasaran; kueri
dokumen tidak pernah mengembalikan call graph mentah kecuali Anda memintanya.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph membaca repo Anda dengan pemindai (scanner) deterministik menjadi satu graf berlapis di .kawn/graph.json (lapisan code, data, config, docs, test), disajikan read-only ke CLI kawn, server MCP, dan Studio. Tanpa jaringan, tanpa LLM, tanpa telemetri." width="860">
</div>

| Lapisan  | Contoh                                              |
| -------- | --------------------------------------------------- |
| `code`   | file, fungsi, kelas, import, panggilan (call), route |
| `data`   | tabel SQL, migrasi, foreign key                     |
| `config` | paket workspace, dependensi                         |
| `docs`   | bagian markdown, tautan, penyebutan                 |
| `test`   | pengujian dan apa yang dicakupnya                   |

Setiap edge membawa **bukti** (path sumber, rentang baris, cuplikan) dan sebuah tingkat keyakinan
(confidence); setiap node memiliki **ID yang stabil dan content-addressable** sehingga graf tetap
dapat di-diff antar pemindaian. Model lebih dalam:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Sebuah Context Pack, dari awal hingga akhir

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

Pack yang sama tersedia sebagai Markdown, JSON, atau **Universal Context Protocol** yang netral-agen
(`--format ucp` / `ucp-md`). Selengkapnya:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` membuka **KawnGraph Studio** — sebuah penjelajah (explorer) lokal yang **read-only**,
disajikan di atas `127.0.0.1`, yang membaca `.kawn/graph.json` yang sudah ada dan tidak pernah
memindai, membangun ulang, atau menulis. Ia menawarkan graf 2D interaktif, peta-bintang "Universe"
3D yang skalabel (dianggarkan agar tidak pernah menggambar seluruh graf besar sekaligus), pembangun
Context-Pack, dampak-terbalik, tampilan perubahan-Git, dan tampilan benchmark perilaku. Dibangun
dalam bahasa Inggris dan Arab (sadar-RTL). Jalankan dari sumber dengan `pnpm studio:build &&
pnpm kawn map`.

> Sebuah tangkapan layar (screenshot) Studio akan ditambahkan ke `docs/assets/` setelah
> pengambilan-visual berikutnya; sampai saat itu, diagram di atas adalah visual kanonis.

---

## KawnGraph vs. pencarian repositori biasa

Sebuah perbandingan netral atas *pendekatan* (bukan serangan terhadap pesaing). Setiap sel dapat
dipertahankan; "varies" berarti tergantung pada tool tertentu.

| Kapabilitas | Pencarian biasa | RAG umum | Penampil graf generik | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Pemindaian lokal deterministik | ✅ | varies | ✅ | ✅ |
| Hubungan tingkat-simbol | ❌ | varies | ✅ | ✅ |
| Lapisan docs / data / test | ❌ | varies | varies | ✅ |
| Bukti pada setiap edge | ❌ | ❌ | varies | ✅ |
| Analisis dampak terbatas | ❌ | ❌ | varies | ✅ |
| Konteks perubahan-Git | varies | ❌ | ❌ | ✅ |
| Context Pack dengan anggaran token | ❌ | varies | ❌ | ✅ |
| Pengambilan MCP read-only | ❌ | varies | varies | ✅ |
| Tidak butuh LLM internal | ✅ | ❌ | ✅ | ✅ |

Perbandingan tiga-kolom yang bertanggal dan bersumber terhadap sebuah tool graf yang matang
(kapabilitas yang diungguli KawnGraph **dan** kapabilitas yang tidak) ada di
**[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmark

KawnGraph menyertakan sebuah **harness A/B lokal** yang menjalankan agen yang *sama* pada tugas yang
*sama* **dengan vs tanpa** KawnGraph dan merekam perilakunya. Hasilnya jujur dan
**bergantung-tugas** — termasuk kasus netral dan negatif.

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

Metodologi, lingkungan, ukuran sampel, tabel per-metrik, dan keterbatasan:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — dihasilkan dari artefak yang sudah di-commit dan
divalidasi di [`benchmarks/published/`](../../benchmarks/published/).

---

## Pemindai (scanner) & lapisan yang didukung

Setiap bahasa/format adalah sebuah **plugin pemindai (scanner)** berversi di balik satu registry
(detect → scan → finalize): urutan deterministik, isolasi kegagalan per-file, registrasi eksplisit,
dan ukuran file yang dibatasi.

| Bahasa / format | Yang diekstraksi |
| ----------------- | --------- |
| TypeScript / JS   | files, top-level functions/classes, imports, calls, Next.js routes, tests |
| Python            | top-level `def`/`async def`/`class`, decorators, methods (as metadata), imports, FastAPI/Flask routes, docstrings, tests (via `@lezer/python` — pure-JS, error-tolerant) |
| SQL               | tables (`CREATE`/`ALTER`), foreign-key relationships |
| package.json      | workspace packages and internal dependencies |
| Markdown          | headings/sections linked to code, SQL, and routes |

Dua kelalaian yang disengaja di kedua pemindai kode: metode/fungsi bersarang tidak pernah menjadi
node terpisah (sebuah metode menumpang pada kelasnya sebagai metadata), dan file deklarasi ambient
(`.d.ts`, `.pyi`) tidak pernah diklaim. Detail:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Privasi & keamanan

- **Tanpa jaringan secara default.** Pemindaian dan pengambilan membaca repo Anda dan menulis JSON
  di bawah `.kawn/`. Tidak ada yang meninggalkan mesin.
- **Tanpa LLM internal.** Kode, dokumen, dan SQL diurai secara struktural; pengayaan (enrichment) AI
  bersifat opt-in dan local-first.
- **Tanpa telemetri. Tanpa pencatatan kueri secara default.**
- **MCP read-only.** Server menyajikan graf; ia tidak pernah memindai, membangun ulang, atau
  menulis — dan menolak menyajikan graf yang skemanya tidak dapat ia percaya.
- **Integrasi yang dapat dibatalkan dan dibatasi-proyek.** Penulisan atomik, cadangan (backup)
  berstempel-waktu, suntingan konfigurasi terstruktur (bukan string); tidak pernah mengedit
  `CLAUDE.md` / `AGENTS.md`, tidak pernah menyentuh konfigurasi global secara default.

Model lengkap: **[docs/PRIVACY.md](../PRIVACY.md)**. Laporkan kerentanan secara privat melalui
**[SECURITY.md](../../SECURITY.md)**.

---

## Status & keterbatasan

KawnGraph sedang dalam **pengembangan aktif** (`v0.1.0`, belum dipublikasikan ke npm). Dibangun dan
diuji secara menyeluruh (end-to-end): graf code/data/config/docs/test, tautan docs-ke-kode, kueri
terbatas-mode, analisis dampak, dampak Git/PR, Context Pack dengan anggaran token, Universal Context
Protocol, server MCP read-only, penyiapan agen satu-perintah (Claude Code / Codex / Cursor), Studio,
dan harness benchmark A/B.

**Batasan yang jujur.** Benchmark yang dipublikasikan bersifat **eksploratif (n<5 per arm —
direksional, tidak signifikan)**. KawnGraph paling membantu pada penemuan multi-file yang asing dan
dapat menambah overhead pada tugas satu-file yang sudah terfokus. Belum dibangun: hook opt-in yang
hanya-menyarankan (suggest-only), lapisan visual, pengayaan (enrichment) semantik/AI, dan sebuah
lapisan runtime — semuanya opt-in by design. Lihat
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Dokumentasi

| Panduan | Apa isinya |
| ----- | ------------- |
| [Mulai cepat](../GETTING_STARTED.md) | Pasang, pindai, Context Pack pertama |
| [Integrasi agen](../AGENT_INTEGRATION.md) | Kontrak penyiapan MCP, reversibilitas |
| [Context Packs](../CONTEXT_PACKS.md) | Peringkatan, anggaran, format kawat UCP |
| [Model graf](../GRAPH_MODEL.md) | Node, edge, lapisan, bukti, ID |
| [Pemindai (scanner)](../SCANNERS.md) | Apa yang diekstraksi tiap plugin bahasa |
| [Benchmark](../BENCHMARKS.md) | Metodologi, lingkungan, hasil lengkap |
| [Perbandingan](../COMPARISON.md) | Perbandingan kapabilitas bertanggal & bersumber |
| [Privasi](../PRIVACY.md) | Batas data per lapisan |
| [Pemecahan masalah](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Masalah & pertanyaan umum |

---

## Berkontribusi

Kontribusi sangat disambut. Build dari sumber, jalankan rangkaian pengujian, dan baca panduannya:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Lihat **[CONTRIBUTING.md](../../CONTRIBUTING.md)** untuk penyiapan, konvensi, dan tinjauan privasi
yang dilalui setiap PR; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** untuk ekspektasi
komunitas; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)** untuk menambah atau meninjau sebuah bahasa;
dan **[SUPPORT.md](../../SUPPORT.md)** untuk tempat mengajukan pertanyaan.

---

## Lisensi & ucapan terima kasih

**[MIT](../../LICENSE)** © kontributor KawnGraph.

**Kawn** (bahasa Arab **كَوْن** — *kosmos, semesta, eksistensi*) memperlakukan sebuah repositori
sebagai semesta pengetahuan yang hidup; **Graph** adalah Agent Context Graph yang didukung bukti di
intinya. Dibangun dengan [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/), dan
[`@lezer/python`](https://lezer.codemirror.net/).
</content>
</invoke>
