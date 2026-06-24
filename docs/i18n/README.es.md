<!-- KAWN-TRANSLATION
lang: es
status: machine-assisted
canonical: README.md
canonical-sha: 4f9ba5f5ad01f25dedd1430011946331796d551abc63eba863a77a7ff3477cc0
-->

<div align="center">

<img src="../../brand/logo.svg" alt="KawnGraph" width="320">

### El universo de contexto del agente

**Un único universo de proyecto. Todos los agentes de programación.**

[English](../../README.md) · [العربية](../../README.ar.md) · [Español] (actual) · [estado de las traducciones](STATUS.md)

> Esta traducción es asistida por máquina y puede contener errores. La versión canónica en inglés es [README.md](../../README.md); consulta el [estado de las traducciones](STATUS.md).

</div>

---

## ¿Por qué KawnGraph?

KawnGraph mapea código, documentación, datos, pruebas y cambios de Git en
**Context Packs** respaldados por evidencia, para que Claude, Codex y Cursor
puedan alcanzar los archivos correctos sin leer todo el repositorio.

Cuando le das una tarea a un agente de programación, normalmente empieza por
*leer* — mucho. Abre docenas de archivos, vuelve a deducir cómo las rutas
llegan a la base de datos y reconstruye el mismo modelo mental en cada
solicitud. Eso es lento, costoso en tokens y a menudo inexacto: el agente se
pierde el único archivo que importa y se ahoga en cinco que no importan.

KawnGraph escanea el repositorio **una vez**, construye un grafo por capas y
respaldado por evidencia de cómo se relacionan las cosas, y luego responde,
para una tarea concreta, con los **pocos archivos que importan** — más la
documentación relevante, las tablas de base de datos relacionadas, las pruebas
que ejecutar y los riesgos a vigilar. Ese paquete es un **Context Pack**. El
grafo es el sustrato; el Context Pack es el producto.

> **Dale a los agentes el mapa, no el repositorio.** — اعطِ الإيجنت الخريطة، مو المشروع كامل.

---

## Inicio rápido

> **Atención:** el paquete npm `kawngraph` **aún no está publicado**, así que
> `npx kawngraph …` *no* está disponible hoy. Usa la ruta desde el código
> fuente que aparece abajo; el flujo `npx` se muestra para **después de la
> publicación**.

**Hoy — desde el código fuente** (este monorepo, Node ≥ 18 + [pnpm](https://pnpm.io)):

```bash
pnpm install && pnpm build          # build the workspace
pnpm kawn setup --agent all --yes   # scan + connect Claude Code / Codex / Cursor
pnpm kawn check                     # is the graph fresh? who is connected?
pnpm studio:build && pnpm kawn map  # open the read-only visual explorer
```

**Después de la publicación en npm** (la experiencia prevista de un solo comando):

```bash
npx kawngraph setup   # scan, detect your agents, connect them, verify retrieval
kawn check            # health: is the graph fresh? who is connected?
kawn map              # open the local, read-only visual explorer
```

Luego abre tu agente y simplemente describe tu tarea — él extrae por su cuenta
los pocos archivos que importan. Sin claves de API, sin telemetría, sin
llamadas de red durante el escaneo o la recuperación. ¿Eres nuevo? Empieza con
**[docs/GETTING_STARTED.md](../GETTING_STARTED.md)**.

---

## Conéctalo a tu agente de programación

El objetivo de KawnGraph es que el agente alcance el mapa **automáticamente**.
Un solo comando conecta un proyecto a los agentes que usas — sin editar
`CLAUDE.md` ni `AGENTS.md`, y con cada cambio reversible:

```bash
kawn setup                  # scan if needed, detect agents, connect, verify
kawn setup --agent all --yes   # non-interactive (CI), every supported agent
kawn setup --dry-run        # preview the exact file changes, write nothing
kawn status                 # is the graph fresh? who is connected?
kawn disconnect codex       # cleanly remove only KawnGraph's entry
```

`setup` detecta **Claude Code**, **Codex** y **Cursor** e instala una
**integración MCP de solo lectura** acotada al proyecto (`.mcp.json`,
`.cursor/mcp.json` o `.codex/config.toml`), haciendo copia de seguridad de todo
lo que toca y verificando el servidor con un handshake en vivo. Contrato
completo: **[docs/AGENT_INTEGRATION.md](../AGENT_INTEGRATION.md)**.

El **servidor MCP** es JSON-RPC sobre stdio de solo lectura, sin dependencias y con cuatro herramientas:

| Herramienta | Qué hace |
| ---- | ------------ |
| `kawn_context` | Context Pack con presupuesto de tokens para una tarea. |
| `kawn_query` | Búsqueda clasificada y acotada por modo sobre el grafo. |
| `kawn_affected` | Impacto inverso: qué depende de un símbolo. |
| `kawn_changes` | Impacto del conjunto de cambios actual (sin confirmar, o una rama frente a una referencia base). Solo git local. |

**Solo lee** el grafo — nunca lo escanea, reconstruye ni escribe (advierte
cuando el grafo parece obsoleto y apunta a `kawn update`).

---

## Cómo funciona

Un proyecto no es solo código. Es código **y** documentación **y** SQL **y**
pruebas **y** la configuración que los une. KawnGraph modela cada uno como una
**capa** distinta, de modo que una consulta pide exactamente lo que necesita y
nada que no necesite — una consulta de impacto de código nunca arrastra
documentación de marketing; una consulta de documentación nunca devuelve grafos
de llamadas en crudo a menos que lo pidas.

<div align="center">
<img src="../assets/architecture.svg" alt="KawnGraph lee tu repositorio con escáneres deterministas hacia un único grafo por capas en .kawn/graph.json (capas de código, datos, configuración, documentación y pruebas), servido en modo solo lectura a la CLI kawn, al servidor MCP y a Studio. Sin red, sin LLM, sin telemetría." width="860">
</div>

| Capa    | Ejemplos                                            |
| -------- | --------------------------------------------------- |
| `code`   | archivos, funciones, clases, imports, llamadas, rutas   |
| `data`   | tablas SQL, migraciones, claves foráneas                |
| `config` | paquetes del workspace, dependencias                    |
| `docs`   | secciones de markdown, enlaces, menciones                  |
| `test`   | pruebas y lo que cubren                           |

Cada arista lleva **evidencia** (ruta de origen, rango de líneas, fragmento) y
un nivel de confianza; cada nodo tiene un **ID estable y direccionable por
contenido** para que el grafo siga siendo comparable entre escaneos. Modelo más
profundo: **[docs/GRAPH_MODEL.md](../GRAPH_MODEL.md)**.

### Un Context Pack, de principio a fin

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

El mismo paquete está disponible como Markdown, JSON o el **Universal Context
Protocol** neutral respecto del agente (`--format ucp` / `ucp-md`). Más:
**[docs/CONTEXT_PACKS.md](../CONTEXT_PACKS.md)**.

---

## Studio

`kawn map` abre **KawnGraph Studio** — un explorador local, de **solo lectura**,
servido sobre `127.0.0.1`, que lee el `.kawn/graph.json` existente y nunca
escanea, reconstruye ni escribe. Ofrece un grafo 2D interactivo, un mapa
estelar 3D "Universe" escalable (con presupuesto para que nunca dibuje un grafo
grande completo de una vez), un constructor de Context Packs, impacto inverso,
vistas de cambios de Git y una vista de benchmark de comportamiento. Construido
en inglés y árabe (compatible con RTL). Ejecútalo desde el código fuente con
`pnpm studio:build && pnpm kawn map`.

> Se añadirá una captura de pantalla de Studio a `docs/assets/` tras la próxima
> pasada de captura visual; hasta entonces, los diagramas de arriba son las
> imágenes canónicas.

---

## KawnGraph frente a la búsqueda simple en el repositorio

Una comparación neutral de *enfoques* (no un ataque a competidores). Cada celda
es defendible; "varía" significa que depende de la herramienta específica.

| Capacidad | Búsqueda simple | RAG genérico | Visor de grafos genérico | **KawnGraph** |
| --- | :---: | :---: | :---: | :---: |
| Escaneo local determinista | ✅ | varía | ✅ | ✅ |
| Relaciones a nivel de símbolo | ❌ | varía | ✅ | ✅ |
| Capas de docs / datos / pruebas | ❌ | varía | varía | ✅ |
| Evidencia en cada arista | ❌ | ❌ | varía | ✅ |
| Análisis de impacto acotado | ❌ | ❌ | varía | ✅ |
| Contexto de cambios de Git | varía | ❌ | ❌ | ✅ |
| Context Packs con presupuesto de tokens | ❌ | varía | ❌ | ✅ |
| Recuperación MCP de solo lectura | ❌ | varía | varía | ✅ |
| No requiere LLM interno | ✅ | ❌ | ✅ | ✅ |

Una comparación fechada, con fuentes y de tres columnas frente a una
herramienta de grafos madura (capacidades en las que KawnGraph lidera **y**
capacidades en las que no) vive en **[docs/COMPARISON.md](../COMPARISON.md)**.

---

## Benchmarks

KawnGraph incluye un **arnés A/B local** que ejecuta el *mismo* agente en la
*misma* tarea **con y sin** KawnGraph y registra el comportamiento. Los
resultados son honestos y **dependen de la tarea** — incluyendo casos neutrales
y negativos.

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

Metodología, entorno, tamaños de muestra, las tablas por métrica y las
limitaciones: **[docs/BENCHMARKS.md](../BENCHMARKS.md)** — generado a partir del
artefacto confirmado y validado en [`benchmarks/published/`](../../benchmarks/published/).

---

## Escáneres y capas compatibles

Cada lenguaje/formato es un **plugin de escáner** versionado detrás de un único
registro (detectar → escanear → finalizar): orden determinista, aislamiento de
fallos por archivo, registro explícito y tamaños de archivo acotados.

| Lenguaje / formato | Extraído |
| ----------------- | --------- |
| TypeScript / JS   | archivos, funciones/clases de nivel superior, imports, llamadas, rutas de Next.js, pruebas |
| Python            | `def`/`async def`/`class` de nivel superior, decoradores, métodos (como metadatos), imports, rutas de FastAPI/Flask, docstrings, pruebas (vía `@lezer/python` — JS puro, tolerante a errores) |
| SQL               | tablas (`CREATE`/`ALTER`), relaciones de clave foránea |
| package.json      | paquetes del workspace y dependencias internas |
| Markdown          | encabezados/secciones enlazados a código, SQL y rutas |

Dos omisiones deliberadas en ambos escáneres de código: los métodos/funciones
anidadas nunca son nodos separados (un método va sobre su clase como metadatos),
y los archivos de declaración de ambiente (`.d.ts`, `.pyi`) nunca se reclaman.
Detalles: **[docs/SCANNERS.md](../SCANNERS.md)**.

---

## Privacidad y seguridad

- **Sin red por defecto.** El escaneo y la recuperación leen tu repositorio y
  escriben JSON bajo `.kawn/`. Nada sale de la máquina.
- **Sin LLM interno.** El código, la documentación y el SQL se analizan
  estructuralmente; el enriquecimiento con IA es opcional y local-first.
- **Sin telemetría. Sin registro de consultas por defecto.**
- **MCP de solo lectura.** El servidor sirve el grafo; nunca escanea,
  reconstruye ni escribe — y se niega a servir un grafo cuyo esquema no puede
  confiar.
- **Integraciones reversibles y acotadas al proyecto.** Escrituras atómicas,
  copias de seguridad con marca de tiempo, ediciones de configuración
  estructuradas (no de cadenas); nunca edita `CLAUDE.md` / `AGENTS.md`, nunca
  toca la configuración global por defecto.

Modelo completo: **[docs/PRIVACY.md](../PRIVACY.md)**. Reporta una vulnerabilidad
de forma privada vía **[SECURITY.md](../../SECURITY.md)**.

---

## Estado y limitaciones

KawnGraph está en **desarrollo activo** (`v0.1.0`, aún no publicado en npm).
Construido y probado de extremo a extremo: el grafo de
código/datos/configuración/documentación/pruebas, los enlaces de docs a código,
la consulta acotada por modo, el análisis de impacto, el impacto de Git/PR, los
Context Packs con presupuesto de tokens, el Universal Context Protocol, el
servidor MCP de solo lectura, la configuración de agentes con un solo comando
(Claude Code / Codex / Cursor), Studio y el arnés de benchmark A/B.

**Límites honestos.** El benchmark publicado es **exploratorio (n<5 por brazo —
direccional, no significativo)**. KawnGraph ayuda más en el descubrimiento de
varios archivos no familiares y puede añadir sobrecarga en tareas de un solo
archivo ya enfocadas. Aún no construido: hooks opcionales de solo sugerencia, la
capa visual, el enriquecimiento semántico/con IA y una capa de tiempo de
ejecución — todos opcionales por diseño. Consulta
[PROJECT_PLAN.md](../../PROJECT_PLAN.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) ·
[docs/FAQ.md](../FAQ.md) · [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## Documentación

| Guía | Qué contiene |
| ----- | ------------- |
| [Primeros pasos](../GETTING_STARTED.md) | Instalar, escanear, primer Context Pack |
| [Integración de agentes](../AGENT_INTEGRATION.md) | Contrato de configuración MCP, reversibilidad |
| [Context Packs](../CONTEXT_PACKS.md) | Clasificación, presupuestos, formato de cable UCP |
| [Modelo de grafo](../GRAPH_MODEL.md) | Nodos, aristas, capas, evidencia, IDs |
| [Escáneres](../SCANNERS.md) | Qué extrae el plugin de cada lenguaje |
| [Benchmarks](../BENCHMARKS.md) | Metodología, entorno, resultados completos |
| [Comparación](../COMPARISON.md) | Comparación de capacidades fechada y con fuentes |
| [Privacidad](../PRIVACY.md) | Límites de datos por capa |
| [Solución de problemas](../TROUBLESHOOTING.md) · [FAQ](../FAQ.md) | Problemas y preguntas comunes |

---

## Contribuir

Las contribuciones son bienvenidas. Construye desde el código fuente, ejecuta la
suite y lee la guía:

```bash
pnpm install && pnpm build
pnpm test            # node:test suite (graph, context, MCP, agents, Studio)
pnpm pack:check      # packaging audit (packs every package, installs from tarballs)
```

Consulta **[CONTRIBUTING.md](../../CONTRIBUTING.md)** para la configuración, las
convenciones y la revisión de privacidad que pasa cada PR;
**[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)** para las expectativas de la
comunidad; **[docs/i18n/TRANSLATING.md](TRANSLATING.md)** para añadir o revisar
un idioma; y **[SUPPORT.md](../../SUPPORT.md)** para dónde hacer preguntas.

---

## Licencia y agradecimientos

**[MIT](../../LICENSE)** © colaboradores de KawnGraph.

**Kawn** (árabe **كَوْن** — *cosmos, universo, existencia*) trata un repositorio
como un universo vivo de conocimiento; **Graph** es el Agent Context Graph
respaldado por evidencia que está en su núcleo. Construido con
[TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/),
[React](https://react.dev/), [React Flow](https://reactflow.dev/),
[Three.js](https://threejs.org/), y [`@lezer/python`](https://lezer.codemirror.net/).
