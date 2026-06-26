# Context Packs

> The product. A **Context Pack** is a task-scoped, token-budgeted slice of the
> [Agent Context Graph](../README.md): the few files, docs, and tables an agent
> should read for *one specific task* — and nothing else. Built with no LLM and
> no network, deterministically, with every item grounded in evidence.

You ask a question (`kawn ask "<task>"`), KawnGraph ranks the graph against it,
and you get back a small, ordered set of things to read instead of the whole
tree. The pack is the unit every consumer shares — the [CLI](../README.md),
the MCP server, and [Studio](../apps/studio/README.md) all serve the
same pack.

- [What a pack contains](#what-a-pack-contains)
- [How ranking works](#how-ranking-works)
- [The mandatory floor](#the-mandatory-floor-tables-and-tests)
- [Modes (`--mode`)](#modes---mode)
- [The Universal Context Protocol (UCP)](#the-universal-context-protocol-ucp)
- [Studio: copy as Markdown / JSON](#studio-copy-as-markdown--json)

---

## What a pack contains

Every pack carries a small header plus four ordered buckets, a risk list, and an
excluded list. The buckets are kept **separate per layer** — code, docs, tables,
and tests are never mixed blindly into one list.

| Part | What it is |
| --- | --- |
| **Must-read code** (`mustRead`) | The code units to open first — files, functions, classes, routes, symbols, env. Ranked, most relevant first. |
| **Related docs** (`relatedDocs`) | Documentation and doc sections that explain the code above. |
| **Tables** (`tables`) | Database tables and migrations in scope. Part of the [mandatory floor](#the-mandatory-floor-tables-and-tests). |
| **Tests** (`tests`) | Tests covering the code in the pack. Part of the [mandatory floor](#the-mandatory-floor-tables-and-tests). |
| **Risks** (`risks`) | Evidence-backed flags that should make an agent slow down (see below). |
| **Excluded** (`excluded`) | Lower-ranked items that were ranked but didn't fit the budget — surfaced *with a reason* (e.g. `over budget (~420 tok)`), never silently lost. |
| **Confidence** (`confidence`) | A `0..1` score for how much to trust the pack. |

Each item in a bucket records its `id` (the [stable, content-addressable node
id](../README.md)), `type`, `label`, `sourcePath` with optional line range, the
**reason** it earned a place, its ranking `score`, a `tier`
(`exact` / `direct` / `second-order` — how many hops from a keyword match), and a
rough `tokensEstimate`.

**Risks** are heuristic and aggregated by kind so the list stays high-signal —
one auth flag listing the surfaces, not one per file. The built-in signals look
for auth/secret/token surfaces, data writes, and tenant-isolation keys (e.g.
`store_id`). They are hints, not guarantees.

**Confidence** is computed deterministically, not guessed: it blends how much of
the task's vocabulary the included items actually cover with a bump for being
grounded in real code/tables rather than docs alone. A pack that matches few of
your task words, or that found only docs, reports lower confidence on purpose.

**Token estimates never embed file contents.** A pack *points at* code; the token
cost is an estimate (roughly characters ÷ 4) of what an agent would spend if it
opened each item. It exists to keep a pack inside a budget — not to bill anyone.

**Freshness.** When the pack is built by the CLI or served by MCP, it can carry a
`freshness` block (when the graph was scanned, the git HEAD, and remediation like
`kawn update` if stale) so a consumer never silently trusts a stale map. Pure
in-memory builds (tests/benchmark) omit it.

### Example

```bash
# installed: npx kawngraph ask "…"   ·   or from source: pnpm install && pnpm build
pnpm kawn ask "fix the OAuth callback" --budget 8000 --mode auto
```

---

## How ranking works

Ranking is **deterministic and LLM-free** — the same graph + task + budget + mode
always produces a byte-identical pack. It combines a handful of structural signals
over the graph:

1. **Keyword seeds.** The task is reduced to keywords (lowercased, stopwords and
   1-char tokens dropped). Nodes whose label or path matches — including
   `camelCase` split into words — become **seeds**. Keyword relevance dominates
   the score; everything else only breaks ties.

2. **Graph proximity (BFS).** From the seeds, a breadth-first walk expands outward
   along edges. Closer nodes score higher; the walk is bounded by `--depth`
   (the pack builder uses a shallow default so it stays focused). Expansion may
   *cross layers* — so a code seed can reach the SQL table that explains it even
   in `code` mode — but the returned set is scoped back to the requested mode.

3. **Degree centrality, signed by keyword overlap.** A well-connected node that
   *also* matched the task is the topic's **orchestrator** (the entrypoint wiring
   things together) and gets a small bonus. A well-connected node with *no*
   keyword overlap is a generic **bridge** (a barrel/index/global README that
   "connects to everything" but means nothing for this task) and is penalized.
   Degree alone can't tell an orchestrator from a barrel — keyword overlap can.

4. **Specificity & doc penalties.** A precise unit you can read in seconds — a
   function, route, or class — outranks the whole file that merely contains it
   when both match equally, so "must read" points at the symbol, not its
   container. Generically-named or no-keyword docs are pushed down so they never
   crowd out the code that actually matters.

Ties break totally and deterministically: by score, then shallower depth, then
node id. Visual-layer nodes are never ranked into a pack.

> Implementation: [`packages/core/src/context/rankContext.ts`](../packages/core/src/context/rankContext.ts)
> and [`buildContextPack.ts`](../packages/core/src/context/buildContextPack.ts).

---

## The mandatory floor: tables and tests

Budgets are real, but two things are **never dropped to make room**:

- **Tables and migrations** — SQL is load-bearing. If a table is in scope, it
  stays in the pack regardless of the budget.
- **Tests** — they're cheap and they show how the code is exercised.

Their token cost is charged against the budget *first*; only then is the
remaining budget spent on must-read code (highest-ranked first), then related
docs. Anything that doesn't fit lands in **excluded** with a reason — so you can
see what was left out and raise `--budget` if you need it.

---

## Modes (`--mode`)

`--mode` scopes *where retrieval starts and what comes back*. Default is `all`.

| Mode | Scope |
| --- | --- |
| `auto` | Infer the scope from the task text. Conservative: it only narrows to a single layer when the task is unambiguous (e.g. mentions `table`/`schema`/`migration` → `data`; `test`/`spec`/`pytest` → `tests`; `docs`/`readme`/`guide` → `docs`), otherwise falls back to `all` so recall is never sacrificed. |
| `code` | Everything but docs (code, data, config, tests, runtime). |
| `docs` | Documentation only. |
| `data` | Tables/migrations **plus the code that touches them**; never docs. |
| `tests` | Tests **plus the code under test**; never docs. |
| `all` | Everything but visual assets. |

A produced pack always reports the **concrete** mode it actually used — `auto` is
resolved to one of the others before the pack is built, so you never see an
ambiguous `auto` in the output.

```bash
pnpm kawn ask "add a column to the orders table" --mode data
```

---

## The Universal Context Protocol (UCP)

A pack is most useful when *any* coding agent can consume it without knowing
KawnGraph's internals. The **Universal Context Protocol** is the agent-neutral,
versioned wire format for that. It's produced by
[`packages/context-protocol`](../packages/context-protocol) — pure, deterministic
conversion, no model, no network.

Two output forms, both off the same pack:

```bash
pnpm kawn ask "fix the OAuth callback" --format ucp      # canonical JSON
pnpm kawn ask "fix the OAuth callback" --format ucp-md   # drop-in Markdown
```

- **`--format ucp`** — the **canonical JSON** Universal Context Pack. Object keys
  are emitted in sorted order at every level, so identical content yields
  byte-identical JSON — safe to hash, cache, and diff.
- **`--format ucp-md`** — the same pack rendered to **drop-in Markdown** for an
  agent that won't parse JSON: paste it straight into a prompt and get the same
  structured guidance.

(`--format text` is the default human view; `--format json` emits the raw
internal pack. `ask` and `context` are the same command.)

### Self-describing by design

The protocol is built so a reader can **negotiate rather than guess**:

- **Role-tagged sections.** Buckets carry a semantic `role` —
  `primary` (must-read), `supporting` (docs), `data` (tables),
  `verification` (tests) — so a consumer can treat them generically without
  hard-coding KawnGraph's section names.
- **Self-explaining items.** Every item carries the four things an agent needs to
  decide whether and how to use it: **why** it's here (deterministic,
  human-readable), which **layer** it belongs to, its **evidence** (provenance —
  the item's own source location plus the bounded, deduped evidence of the edges
  that earned it a place; never empty), and its **rank** (score + 1-based
  position in its section).
- **Capability negotiation.** The producer advertises a `capabilities` block —
  flags like `evidence`, `explanations`, `ranking`, `tokenBudget`,
  `layeredSections`, `deterministic`, `noLlm`, plus the node kinds and layers it
  may emit — alongside a `major.minor` `protocolVersion`. A consumer states what
  it `require`s and what kinds/layers it can handle; `negotiate()` checks version
  compatibility, required guarantees, and coverage, returning sorted,
  human-readable reasons when it can't rely on the pack.
- **Versioning.** `major.minor`. Same-major is always readable: a newer reader
  tolerates an older pack (new fields absent) and an older reader tolerates a
  newer pack (it ignores fields it doesn't know). Cross-major is **refused**, not
  guessed. The current protocol version is `1.0`.
- **Structural validator.** `validateUniversalPack()` / `assertUniversalPack()`
  check an untrusted pack before you act on it: protocol compatibility, every
  promised field present and well-typed, enumerations in range (mode, section
  role, node kind, layer, risk level), numbers sound (budgets and token estimates
  ≥ 0, ranks 1-based integers), and — the protocol's core promise — that **every
  item carries a non-empty evidence array**. Errors are collected, not thrown, so
  a caller sees all problems at once.

> Implementation: [`packages/context-protocol/src`](../packages/context-protocol/src)
> — `schema.ts`, `capabilities.ts`, `negotiate.ts`, `validate.ts`, `json.ts`,
> `markdown.ts`, `version.ts`, `fromContextPack.ts`.

---

## Studio: copy as Markdown / JSON

In [Studio](../apps/studio/README.md), the **Ask** (context) view renders the
pack — must-read code, related docs, tables, tests, risks, confidence, and the
excluded list with reasons. Two buttons let you take it with you:

- **Copy Markdown** — the pack as readable Markdown to paste into a prompt.
- **Copy JSON** — the structured pack.

Studio is **read-only**: it serves and displays packs from the existing graph; it
never scans, rebuilds, or writes. Building and refreshing the graph is always an
explicit CLI step (`kawn scan` / `kawn update`).

---

## See also

- [README](../README.md) — the project overview and quick start.
- [Agent integration](AGENT_INTEGRATION.md) — how agents consume packs over the read-only MCP server.
- [Studio](../apps/studio/README.md) — the read-only visual explorer.
