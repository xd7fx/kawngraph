<!-- KAWN-TRANSLATION
lang: pt-BR
status: machine-assisted
canonical: README.md
canonical-sha: 9ae23d43afac34187e2ed17d64244ea5b65352f88f470cbc2818ff41eb15e312
-->

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../brand/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="../../brand/logo-light.svg">
  <img src="../../brand/logo.svg" alt="KawnGraph" width="320">
</picture>

### O Universo de Contexto do Agente

**Um universo de projeto. Todo agente de programação.**

O KawnGraph mapeia código, documentos, dados, testes e mudanças do Git em
**Context Packs** fundamentados em evidências, para que Claude, Codex e Cursor
possam chegar aos arquivos certos sem ler o repositório inteiro.

[![License: MIT](https://img.shields.io/badge/License-MIT-22C7A9.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518-4C8DFF.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-4C8DFF.svg)](tsconfig.base.json)
[![Local-first](https://img.shields.io/badge/Local--first-no%20cloud-42D392.svg)](docs/PRIVACY.md)
[![No telemetry](https://img.shields.io/badge/Telemetry-none-42D392.svg)](docs/PRIVACY.md)
[![Support](https://img.shields.io/badge/Support-get%20help-4C8DFF.svg)](SUPPORT.md)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Abdulrahman%20Alnashri-0A66C2.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)
[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA.svg?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/xd7fx)

<!-- LANGBAR:START -->

[English](../../README.md) ·
[العربية](../../README.ar.md) ·
[Español](README.es.md) ·
[Français](README.fr.md) ·
[Deutsch](README.de.md) ·
**Português (BR)** ·
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

> Esta tradução é **assistida por máquina** e pode conter erros. A versão canônica em inglês é [README.md](../../README.md); consulte o [STATUS.md](STATUS.md).

**[Início Rápido](#início-rápido)** ·
**[Como Funciona](#como-funciona)** ·
**[Studio](#studio)** ·
**[Benchmarks](#benchmarks)** ·
**[Documentação](#documentação)** ·
**[Contribuindo](#contribuindo)**

</div>

---

<div align="center">
<img src="../assets/context-pack-flow.svg" alt="Uma tarefa ('Corrigir o callback do OAuth do Zid') flui para dentro do KawnGraph, que retorna um Context Pack com orçamento de tokens: arquivos de leitura obrigatória, documentos relacionados, tabelas, testes, riscos, uma lista de exclusões e uma pontuação de confiança." width="860">
</div>

---

## Por que o KawnGraph?

Quando você dá uma tarefa a um agente de programação, ele geralmente começa *lendo* — muito. Ele
abre dezenas de arquivos, redescobre como as rotas chegam ao banco de dados e reconstrói o
mesmo modelo mental a cada requisição. Isso é lento, caro em tokens e muitas vezes
impreciso: o agente perde o único arquivo que importa e se afoga em cinco que não
importam.

O KawnGraph escaneia o repositório **uma vez**, constrói um grafo em camadas e fundamentado
em evidências de como as coisas se relacionam e, então, responde, para uma tarefa específica, com os
**poucos arquivos que importam** — além dos documentos relevantes, das tabelas de banco de dados
relacionadas, dos testes a executar e dos riscos a observar. Esse pacote é um **Context Pack**.
O grafo é o substrato; o Context Pack é o produto.

> **Dê aos agentes o mapa, não o repositório.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Início Rápido

> **Atenção:** o pacote npm `kawngraph` **ainda não foi publicado**, então
> `npx kawngraph …` *não* está disponível hoje. Use o caminho a partir do código-fonte abaixo; o
> fluxo `npx` é mostrado para **depois da publicação**.

**Hoje — a partir do código-fonte** (este monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Após a publicação no npm** (a experiência pretendida de um único comando):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Então abra seu agente e apenas descreva sua tarefa — ele puxa por conta própria os poucos arquivos que
importam. Sem chaves de API, sem telemetria, sem chamadas de rede durante o escaneamento ou a recuperação.
É novo nisto? Comece com **[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Conecte-o ao seu agente de programação

O ponto do KawnGraph é que o agente recorre ao mapa **automaticamente**.
Um único comando conecta um projeto aos agentes que você usa — sem editar `CLAUDE.md`
ou `AGENTS.md`, com toda mudança reversível:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

O `setup` detecta seus agentes de programação — **Claude Code**, **Codex**, **Cursor**,
**Copilot**, **Gemini CLI** e **Aider** (além de uma exportação `generic` em Markdown/JSON
e um **LLM local** opcional) — e instala uma **integração somente leitura** com escopo no
projeto (`.mcp.json`, `.cursor/mcp.json`, `.codex/config.toml`,
`.vscode/mcp.json`, `.gemini/settings.json` ou um arquivo de contexto do Aider), fazendo backup
de tudo que toca e verificando cada servidor MCP com um handshake ao vivo. Contrato completo:
**[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

O **servidor MCP** é um laço JSON-RPC stdio somente leitura, **sem MCP SDK** (feito à mão) e com quatro ferramentas:

| Ferramenta | O que ela faz |
| ---- | ------------ |
| `kawn_context` | Context Pack com orçamento de tokens para uma tarefa. |
| `kawn_query` | Busca ranqueada e com escopo por modo sobre o grafo. |
| `kawn_affected` | Impacto reverso: o que depende de um símbolo. |
| `kawn_changes` | Impacto do conjunto de mudanças atual (não commitado, ou um branch vs. uma ref base). Apenas git local. |

Ele **apenas lê** o grafo — nunca o escaneia, reconstrói ou grava (ele avisa
quando o grafo parece desatualizado e aponta para `kawn update`).

---

## Como Funciona

Um projeto não é só código. É código **e** documentos **e** SQL **e** testes
**e** a configuração que os une. O KawnGraph modela cada um como uma
**camada** distinta, de modo que uma consulta pede exatamente o que precisa e nada do que não
precisa — uma consulta de impacto de código nunca arrasta documentos de marketing; uma consulta de documentos nunca
retorna grafos de chamadas brutos, a menos que você peça.

<div align="center">
<img src="../assets/architecture.svg" alt="O KawnGraph lê seu repositório com scanners determinísticos para um único grafo em camadas em .kawn/graph.json (camadas de código, dados, configuração, documentos, testes), servido somente leitura para a CLI kawn, o servidor MCP e o Studio. Sem rede, sem LLM, sem telemetria." width="860">
</div>

| Camada   | Exemplos                                            |
| -------- | --------------------------------------------------- |
| `code`   | arquivos, funções, classes, imports, chamadas, rotas   |
| `data`   | tabelas SQL, migrações, chaves estrangeiras                |
| `config` | pacotes do workspace, dependências                    |
| `docs`   | seções markdown, links, menções                  |
| `test`   | testes e o que eles cobrem                           |

Cada aresta carrega **evidências** (caminho de origem, intervalo de linhas, trecho) e um
nível de confiança — derivado mecanicamente onde o scanner consegue anexá-lo; cada nó tem um
**ID estável e endereçável por conteúdo**, para que o grafo permaneça comparável (diffável) entre escaneamentos.
Modelo mais aprofundado:
**[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Um Context Pack, de ponta a ponta

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

O mesmo pack está disponível como Markdown, JSON ou o **Universal
Context Protocol** neutro em relação ao agente (`--format ucp` / `ucp-md`). Mais:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` abre o **KawnGraph Studio** — um explorador local e **somente leitura** servido
sobre `127.0.0.1` que lê o `.kawn/graph.json` existente e nunca escaneia,
reconstrói ou grava. Ele oferece um grafo 2D interativo, um mapa estelar 3D escalável do "Universo"
(com orçamento, para que nunca desenhe um grafo grande inteiro de uma vez), um construtor de Context Pack,
impacto reverso, visões de mudanças do Git e uma visão de benchmark comportamental. Construído
em inglês e árabe (com suporte a RTL). Execute-o a partir do código-fonte com `pnpm studio:build &&
pnpm kawn map`.

<div align="center">
<img src="../assets/studio-universe.webp" alt="KawnGraph Studio — a visão 3D 'Universo' somente leitura do próprio grafo deste repositório: 1.261 nós agrupados por camada (Code 815, Docs 430, Config 13, Data 3) com linhas de conexão, além de filtros por camada/tipo/aresta." width="860">
<br><sub>A visão 3D <b>Universo</b> — o próprio grafo deste repositório (1.261 nós), somente leitura.</sub>
</div>

<div align="center">
<img src="../assets/studio-map.webp" alt="KawnGraph Studio — a visão de grafo 2D do projeto de exemplo incluído: arquivos, funções, rotas, tabelas e documentos como nós com arestas rotuladas e fundamentadas em evidências (imports, chamadas, defines, menções, explicações), além de filtros por camada/tipo/aresta." width="860">
<br><sub>A visão de <b>grafo</b> 2D — o projeto de exemplo incluído, com filtros por camada / tipo / aresta.</sub>
</div>

---

## KawnGraph vs. busca simples no repositório

Uma comparação neutra de *abordagens* (não um ataque a concorrentes). Cada célula é
defensável; "varia" significa que depende da ferramenta específica.

| Capacidade | Busca simples | RAG genérico | Visualizador de grafo genérico | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Escaneamento local determinístico | ✅ | varia | ✅ | ✅ |
| Relações em nível de símbolo | ❌ | varia | ✅ | ✅ |
| Camadas de docs / dados / testes | ❌ | varia | varia | ✅ |
| Evidência em cada aresta | ❌ | ❌ | varia | ✅ |
| Análise de impacto limitada | ❌ | ❌ | varia | ✅ |
| Contexto de mudanças do Git | varia | ❌ | ❌ | ✅ |
| Context Packs com orçamento de tokens | ❌ | varia | ❌ | ✅ |
| Recuperação MCP somente leitura | ❌ | varia | varia | ✅ |
| Sem LLM interno necessário | ✅ | ❌ | ✅ | ✅ |

Uma comparação datada, com fontes e três colunas contra uma ferramenta de grafo madura
(capacidades em que o KawnGraph lidera **e** capacidades em que não lidera) está em
**[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmarks

O KawnGraph traz um **harness A/B local** que executa o *mesmo* agente na *mesma*
tarefa **com vs. sem** o KawnGraph e registra o comportamento. Os resultados são honestos e
**dependentes da tarefa** — incluindo casos neutros e negativos.

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

Metodologia, ambiente, tamanhos de amostra, as tabelas por métrica e limitações:
**[docs/BENCHMARKS.md](../BENCHMARKS.md)** — gerado a partir do artefato commitado e
validado em [`benchmarks/published/`](../../benchmarks/published/).

---

## Scanners e camadas suportados

Cada linguagem/formato é um **plugin de scanner** versionado por trás de um único registro
(detect → scan → finalize): ordem determinística, isolamento de falhas por arquivo,
registro explícito e tamanhos de arquivo limitados.

| Linguagem / formato | Extraído |
| ----------------- | --------- |
| TypeScript / JS   | arquivos, funções/classes de nível superior, imports, chamadas, rotas Next.js, testes |
| Python            | `def`/`async def`/`class` de nível superior, decoradores, métodos (como metadados), imports, rotas FastAPI/Flask, docstrings, testes (via `@lezer/python` — JS puro, tolerante a erros) |
| SQL               | tabelas (`CREATE`/`ALTER`), relações de chave estrangeira |
| package.json      | pacotes do workspace e dependências internas |
| Markdown          | títulos/seções vinculados a código, SQL e rotas |

Duas omissões deliberadas em ambos os scanners de código: métodos/funções aninhadas nunca são
nós separados (um método viaja junto com sua classe como metadados), e arquivos de declaração
ambiente (`.d.ts`, `.pyi`) nunca são reivindicados. Detalhes:
**[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Privacidade e segurança

- **Sem rede por padrão.** O escaneamento e a recuperação leem seu repositório e gravam JSON
  em `.kawn/`. Nada sai da máquina.
- **Sem LLM interno.** Código, documentos e SQL são analisados estruturalmente; o enriquecimento
  por IA é opcional (opt-in) e local-first.
- **Sem telemetria. Sem registro de consultas por padrão.**
- **MCP somente leitura.** O servidor serve o grafo; nunca escaneia, reconstrói ou
  grava — e se recusa a servir um grafo cujo esquema ele não pode confiar.
- **Integrações reversíveis e com escopo no projeto.** Gravações atômicas, backups
  com data e hora, edições de configuração estruturadas (não por string); nunca edita `CLAUDE.md` /
  `AGENTS.md`, nunca toca na configuração global por padrão.

Modelo completo: **[docs/PRIVACY.md](../PRIVACY.md)**. Relate uma vulnerabilidade
de forma privada via **[SECURITY.md](../../SECURITY.md)**.

---

## Status e limitações

O KawnGraph está em **desenvolvimento ativo** (`v0.1.0`, ainda não publicado no npm). Construído
e testado de ponta a ponta: o grafo de código/dados/configuração/documentos/testes, links de documentos para código,
consulta com escopo por modo, análise de impacto, impacto de Git/PR, Context Packs com orçamento de tokens,
o Universal Context Protocol, o servidor MCP somente leitura, configuração de agente em um único comando
(Claude Code, Codex, Cursor, Copilot, Gemini, Aider, exportação genérica, LLM local),
o Studio e o harness de benchmark A/B.

**Limites honestos.** O benchmark publicado é **exploratório (n<5 por braço —
direcional, não significativo)**. O KawnGraph ajuda mais na descoberta de múltiplos arquivos não
familiares e pode adicionar sobrecarga em tarefas de arquivo único já focadas. Ainda não
construído: hooks opcionais de apenas sugestão, a camada visual, o enriquecimento semântico/por IA e uma
camada de runtime — todos opt-in por design. Veja
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Documentação

| Guia | O que tem dentro |
| ----- | ------------- |
| [Início rápido](../GETTING_STARTED.md) | Instalar, escanear, primeiro Context Pack |
| [Integração com agentes](../AGENT_INTEGRATION.md) | Contrato de configuração MCP, reversibilidade |
| [Context Packs](../CONTEXT_PACKS.md) | Ranqueamento, orçamentos, formato de fio UCP |
| [Modelo de grafo](../GRAPH_MODEL.md) | Nós, arestas, camadas, evidências, IDs |
| [Scanners](../SCANNERS.md) | O que cada plugin de linguagem extrai |
| [Benchmarks](../BENCHMARKS.md) | Metodologia, ambiente, resultados completos |
| [Comparação](../COMPARISON.md) | Comparação de capacidades datada e com fontes |
| [Privacidade](../PRIVACY.md) | Fronteiras de dados por camada |
| [Solução de problemas](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Problemas e perguntas comuns |

---

## Contribuindo

Contribuições são bem-vindas. Construa a partir do código-fonte, execute a suíte e leia o guia:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Veja **[CONTRIBUTING.md](../../CONTRIBUTING.md)** para configuração, convenções e a
revisão de privacidade que todo PR passa; **[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** para
as expectativas da comunidade; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)**
para adicionar ou revisar um idioma; e **[SUPPORT.md](../../SUPPORT.md)** para onde fazer
perguntas.

---

## Licença e agradecimentos

**[MIT](../../LICENSE)** © contribuidores do KawnGraph.

Criado e mantido por **[Abdulrahman Alnashri](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)**.

**Kawn** (em árabe **كَوْن** — *cosmos, universo, existência*) trata um repositório como
um universo vivo de conhecimento; **Graph** é o Agent Context Graph fundamentado em evidências
em seu núcleo. Construído com [TypeScript](https://www.typescriptlang.org/),
[Vite](https://vitejs.dev/), [React](https://react.dev/),
[React Flow](https://reactflow.dev/), [Three.js](https://threejs.org/) e
[`@lezer/python`](https://lezer.codemirror.net/).
