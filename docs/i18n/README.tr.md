<!-- KAWN-TRANSLATION
lang: tr
status: machine-assisted
canonical: README.md
canonical-sha: a44355ad023fc7763703de5efcdb856a6a88d87164b81a92b8897248083454e5
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### Ajan Bağlam Evreni

**Tek bir proje evreni. Her kodlama ajanı.**

[English](../../README.md) · [العربية](../../README.ar.md) · [Türkçe] (mevcut) · [çeviri durumu](STATUS.md)

> Bu çeviri makine destekli olup hatalar içerebilir. Kaynak (canonical) İngilizce sürüm [README.md](../../README.md) belgesidir; ayrıntılar için bkz. [STATUS.md](STATUS.md).

</div>

---

## KawnGraph neden?

Bir kodlama ajanına bir görev verdiğinizde, genellikle işe *okumakla* başlar — hem de çok. Onlarca dosyayı açar, rotaların veritabanına nasıl ulaştığını yeniden çıkarır ve her istekte aynı zihinsel modeli yeniden kurar. Bu yavaştır, token açısından pahalıdır ve çoğu zaman yanlıştır: ajan önemli olan tek dosyayı kaçırır ve önemsiz beş dosyada boğulur.

KawnGraph depoyu **bir kez** tarar, her şeyin birbiriyle nasıl ilişkili olduğuna dair katmanlı, kanıta dayalı bir grafik oluşturur, ardından belirli bir görev için **önemli olan birkaç dosya** ile yanıt verir — ayrıca ilgili belgeler, ilişkili veritabanı tabloları, çalıştırılacak testler ve dikkat edilecek riskler. Bu paket bir **Context Pack**'tir. Grafik altyapıdır; Context Pack ise üründür.

> **Ajanlara depoyu değil, haritayı verin.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Hızlı Başlangıç

> **Dikkat:** `kawngraph` npm paketi **henüz yayımlanmadı**, bu nedenle `npx kawngraph …` bugün *kullanılamaz*. Aşağıdaki kaynaktan kurulum yolunu kullanın; `npx` akışı **yayımlandıktan sonra** için gösterilmiştir.

**Bugün — kaynaktan** (bu monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**npm yayımından sonra** (amaçlanan tek komutluk deneyim):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Ardından ajanınızı açın ve görevinizi yalnızca anlatın — önemli olan birkaç dosyayı kendi başına çeker. API anahtarı yok, telemetri yok, tarama veya getirme sırasında ağ çağrısı yok. Yeni misiniz? **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)** ile başlayın.

---

## Kodlama ajanınıza bağlayın

KawnGraph'ın amacı, ajanın haritaya **otomatik olarak** uzanmasıdır. Tek bir komut, bir projeyi kullandığınız ajanlara bağlar — `CLAUDE.md` veya `AGENTS.md` düzenlenmeden, her değişiklik geri alınabilir biçimde:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup`, **Claude Code**, **Codex** ve **Cursor**'u algılar ve projeye kapsamlı (`.mcp.json`, `.cursor/mcp.json` veya `.codex/config.toml`), **salt okunur bir MCP entegrasyonu** kurar; dokunduğu her şeyi yedekler ve sunucuyu canlı bir el sıkışmayla doğrular. Tam sözleşme: **[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

**MCP sunucusu**, sıfır bağımlılığı ve dört aracı olan salt okunur stdio JSON-RPC'dir:

| Araç | Ne yapar |
| ---- | ------------ |
| `kawn_context` | Bir görev için token bütçeli Context Pack. |
| `kawn_query` | Grafik üzerinde sıralı, moda kapsamlı arama. |
| `kawn_affected` | Ters etki: bir sembole neyin bağlı olduğu. |
| `kawn_changes` | Mevcut değişiklik kümesinin etkisi (commit edilmemiş ya da bir dal ile bir taban referansı). Yalnızca yerel git. |

Grafiği **yalnızca okur** — onu asla taramaz, yeniden oluşturmaz veya yazmaz (grafik bayatlamış göründüğünde uyarır ve `kawn update`'e yönlendirir).

---

## Nasıl Çalışır

Bir proje yalnızca koddan ibaret değildir. Koddur **ve** belgelerdir **ve** SQL'dir **ve** testlerdir **ve** bunları bir araya bağlayan yapılandırmadır. KawnGraph her birini ayrı bir **katman** olarak modeller; böylece bir sorgu tam olarak ihtiyaç duyduğu şeyi ister, ihtiyaç duymadığı hiçbir şeyi istemez — bir kod etkisi sorgusu asla pazarlama belgelerini içine çekmez; bir belge sorgusu, siz istemedikçe asla ham çağrı grafiklerini döndürmez.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph deponuzu deterministik tarayıcılarla .kawn/graph.json içindeki tek bir katmanlı grafiğe (code, data, config, docs, test katmanları) okur ve bunu kawn CLI'ye, MCP sunucusuna ve Studio'ya salt okunur olarak sunar. Ağ yok, LLM yok, telemetri yok." width="860">
</div>

| Katman    | Örnekler                                            |
| -------- | --------------------------------------------------- |
| `code`   | dosyalar, fonksiyonlar, sınıflar, import'lar, çağrılar, rotalar   |
| `data`   | SQL tabloları, migration'lar, yabancı anahtarlar                |
| `config` | workspace paketleri, bağımlılıklar                    |
| `docs`   | markdown bölümleri, bağlantılar, sözedimler                  |
| `test`   | testler ve neyi kapsadıkları                           |

Her kenar **kanıt** (kaynak yolu, satır aralığı, snippet) ve bir güven düzeyi taşır; her düğümün **kararlı, içerik adresli bir ID**'si vardır; böylece grafik taramalar arasında diff alınabilir kalır. Daha derin model: **[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Bir Context Pack, baştan sona

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

Aynı paket Markdown, JSON veya ajandan bağımsız **Universal Context Protocol** (`--format ucp` / `ucp-md`) olarak da kullanılabilir. Daha fazlası: **[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map`, **KawnGraph Studio**'yu açar — `127.0.0.1` üzerinden sunulan, mevcut `.kawn/graph.json`'u okuyan ve asla taramayan, yeniden oluşturmayan veya yazmayan yerel, **salt okunur** bir gezgin. Etkileşimli bir 2D grafik, ölçeklenebilir bir 3D "Universe" yıldız haritası (büyük bir grafiğin tamamını asla tek seferde çizmemesi için bütçelenmiş), bir Context-Pack oluşturucu, ters etki, Git değişiklik görünümleri ve davranışsal bir benchmark görünümü sunar. İngilizce ve Arapça (RTL uyumlu) olarak hazırlanmıştır. Kaynaktan `pnpm studio:build && pnpm kawn map` ile çalıştırın.

> Bir sonraki görsel yakalama geçişinden sonra yakalanan bir Studio ekran görüntüsü `docs/assets/`'e eklenecek; o zamana kadar yukarıdaki diyagramlar kanonik görsellerdir.

---

## KawnGraph ile düz depo araması karşılaştırması

*Yaklaşımların* tarafsız bir karşılaştırması (bir rakibe saldırı değil). Her hücre savunulabilirdir; "değişir" belirli araca bağlı olduğu anlamına gelir.

| Yetenek | Düz arama | Genel RAG | Genel grafik görüntüleyici | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Deterministik yerel tarama | ✅ | değişir | ✅ | ✅ |
| Sembol düzeyinde ilişkiler | ❌ | değişir | ✅ | ✅ |
| Docs / data / test katmanları | ❌ | değişir | değişir | ✅ |
| Her kenarda kanıt | ❌ | ❌ | değişir | ✅ |
| Sınırlı etki analizi | ❌ | ❌ | değişir | ✅ |
| Git değişiklik bağlamı | değişir | ❌ | ❌ | ✅ |
| Token bütçeli Context Pack'ler | ❌ | değişir | ❌ | ✅ |
| Salt okunur MCP getirme | ❌ | değişir | değişir | ✅ |
| Dahili LLM gerektirmez | ✅ | ❌ | ✅ | ✅ |

Olgun bir grafik aracına karşı tarihli, kaynaklı, üç sütunlu bir karşılaştırma (KawnGraph'ın önde olduğu yetenekler **ve** olmadığı yetenekler) şurada bulunur: **[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmark'lar

KawnGraph, *aynı* görevi *aynı* ajanla KawnGraph **olmadan ve KawnGraph ile** çalıştıran ve davranışı kaydeden bir **yerel A/B düzeneği** sunar. Sonuçlar dürüsttür ve **göreve bağlıdır** — nötr ve olumsuz durumlar dahil.

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

Metodoloji, ortam, örneklem boyutları, metrik bazlı tablolar ve sınırlamalar: **[docs/BENCHMARKS.md](../BENCHMARKS.md)** — [`benchmarks/published/`](../../benchmarks/published/) içindeki commit edilmiş, doğrulanmış yapaylıktan (artifact) üretilmiştir.

---

## Desteklenen tarayıcılar ve katmanlar

Her dil/format, tek bir kayıt defterinin (registry) arkasında sürümlenmiş bir **tarayıcı eklentisidir** (detect → scan → finalize): deterministik sıra, dosya başına hata yalıtımı, açık kayıt ve sınırlı dosya boyutları.

| Dil / format | Çıkarılanlar |
| ----------------- | --------- |
| TypeScript / JS   | dosyalar, üst düzey fonksiyonlar/sınıflar, import'lar, çağrılar, Next.js rotaları, testler |
| Python            | üst düzey `def`/`async def`/`class`, decorator'lar, metotlar (metadata olarak), import'lar, FastAPI/Flask rotaları, docstring'ler, testler (`@lezer/python` aracılığıyla — saf JS, hataya dayanıklı) |
| SQL               | tablolar (`CREATE`/`ALTER`), yabancı anahtar ilişkileri |
| package.json      | workspace paketleri ve dahili bağımlılıklar |
| Markdown          | code, SQL ve rotalara bağlı başlıklar/bölümler |

Her iki kod tarayıcısında da iki bilinçli atlama vardır: metotlar/iç içe fonksiyonlar asla ayrı düğümler değildir (bir metot, sınıfının üzerinde metadata olarak taşınır) ve ortam (ambient) bildirim dosyaları (`.d.ts`, `.pyi`) asla sahiplenilmez. Ayrıntılar: **[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Gizlilik ve güvenlik

- **Varsayılan olarak ağ yok.** Tarama ve getirme deponuzu okur ve `.kawn/` altına JSON yazar. Hiçbir şey makineden ayrılmaz.
- **Dahili LLM yok.** Kod, belgeler ve SQL yapısal olarak ayrıştırılır; yapay zeka zenginleştirmesi opt-in ve yerel önceliklidir.
- **Telemetri yok. Varsayılan olarak sorgu günlüğü tutulmaz.**
- **Salt okunur MCP.** Sunucu grafiği sunar; asla taramaz, yeniden oluşturmaz veya yazmaz — ve şemasına güvenemediği bir grafiği sunmayı reddeder.
- **Geri alınabilir, proje kapsamlı entegrasyonlar.** Atomik yazmalar, zaman damgalı yedekler, yapılandırılmış (dize değil) config düzenlemeleri; asla `CLAUDE.md` / `AGENTS.md` düzenlemez, varsayılan olarak küresel yapılandırmaya asla dokunmaz.

Tam model: **[docs/PRIVACY.md](../PRIVACY.md)**. Bir güvenlik açığını gizli olarak **[SECURITY.md](../../SECURITY.md)** üzerinden bildirin.

---

## Durum ve sınırlamalar

KawnGraph **aktif geliştirme** aşamasındadır (`v0.1.0`, henüz npm'e yayımlanmadı). Uçtan uca derlenip test edilmiştir: code/data/config/docs/test grafiği, belge-koda bağlantılar, moda kapsamlı sorgu, etki analizi, Git/PR etkisi, token bütçeli Context Pack'ler, Universal Context Protocol, salt okunur MCP sunucusu, tek komutluk ajan kurulumu (Claude Code / Codex / Cursor), Studio ve A/B benchmark düzeneği.

**Dürüst sınırlar.** Yayımlanan benchmark **keşifseldir (kol başına n<5 — yönlendirici, anlamlı değil)**. KawnGraph en çok tanıdık olmayan çok dosyalı keşifte yardımcı olur ve halihazırda odaklanmış tek dosyalı görevlerde ek yük getirebilir. Henüz yapılmadı: opt-in yalnızca-öneren hook'lar, görsel katman, semantik/AI zenginleştirmesi ve bir çalışma zamanı (runtime) katmanı — hepsi tasarımı gereği opt-in. Bkz. [PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) · [docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Belgeler

| Kılavuz | İçeriği |
| ----- | ------------- |
| [Getting started](../GETTING_STARTED.md) | Kurulum, tarama, ilk Context Pack |
| [Agent integration](../AGENT_INTEGRATION.md) | MCP kurulum sözleşmesi, geri alınabilirlik |
| [Context Packs](../CONTEXT_PACKS.md) | Sıralama, bütçeler, UCP wire formatı |
| [Graph model](../GRAPH_MODEL.md) | Düğümler, kenarlar, katmanlar, kanıt, ID'ler |
| [Scanners](../SCANNERS.md) | Her dil eklentisinin neyi çıkardığı |
| [Benchmarks](../BENCHMARKS.md) | Metodoloji, ortam, tam sonuçlar |
| [Comparison](../COMPARISON.md) | Tarihli, kaynaklı yetenek karşılaştırması |
| [Privacy](../PRIVACY.md) | Katman bazında veri sınırları |
| [Troubleshooting](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Yaygın sorunlar ve sorular |

---

## Katkıda bulunma

Katkılar memnuniyetle karşılanır. Kaynaktan derleyin, test paketini çalıştırın ve kılavuzu okuyun:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Kurulum, kurallar ve her PR'ın geçtiği gizlilik incelemesi için bkz. **[CONTRIBUTING.md](../../CONTRIBUTING.md)**; topluluk beklentileri için **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)**; bir dil eklemek veya incelemek için **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**; ve soru sorulacak yerler için **[SUPPORT.md](../../SUPPORT.md)**.

---

## Lisans ve teşekkürler

**[MIT](../../LICENSE)** © KawnGraph katkıda bulunanları.

**Kawn** (Arapça **كَوْن** — *kozmos, evren, varoluş*) bir depoyu yaşayan bir bilgi evreni olarak ele alır; **Graph** ise onun merkezindeki kanıta dayalı Agent Context Graph'tir. Şunlarla geliştirilmiştir: [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [React](https://react.dev/), [React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/) ve [`@lezer/python`](https://lezer.codemirror.net/).
