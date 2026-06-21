# @kawngraph/studio

A local, **read-only** explorer for the KawnGraph graph — built with **Vite + React +
[@xyflow/react](https://reactflow.dev)**. Browse layers, follow evidence-backed
edges, build token-budgeted context packs, trace impact, and walk flows between
two nodes. It reads the existing `.kawn/graph.json`; it never scans, rebuilds,
or writes anything.

> The Studio is a convenience viewer, **not** the product. KawnGraph's core output is
> the graph and the context packs built from it — the map, not the repo. The
> Studio exists to *explain* that retrieval, not to replace it. Once you've run
> [`kawn setup`](../../docs/AGENT_INTEGRATION.md), your coding agent retrieves
> context over MCP directly — the Studio is then **optional**, for humans who
> want to inspect the graph.

## Run it

```bash
# 1) build the graph for a project (once)
pnpm kawn scan ./path/to/your/project

# 2) build the Studio frontend (dist/ is gitignored)
pnpm studio:build

# 3) launch the local server (binds 127.0.0.1, opens a browser)
pnpm studio ./path/to/your/project
# or against the bundled example:
pnpm studio examples/nextjs-supabase --port 4199
```

Flags: `kawn studio [path] [--port <n>] [--no-open]`. The default port is `4173`
and falls back to the next free port if it is busy. The server binds to
`127.0.0.1` only — it is never exposed on the network.

For frontend development with hot reload:

```bash
pnpm --filter @kawngraph/studio dev   # Vite dev server (proxies /api to the studio server)
```

## What's inside

- **Tabs:** Graph · Universe · Context · Impact · Flow · Docs · Data · Settings.
- **Graph:** pan / zoom / fit / minimap, selectable nodes **and** edges, search +
  focus, layer / node-type / edge-type filters, hide-isolated, 1st/2nd-order
  neighborhood focus, color-by-layer, icon-by-type, a render cap with progressive
  "show more", and a large-graph warning. Selecting a node or edge shows its full
  metadata and evidence.
- **Universe:** a 3D star-map of the same (filtered) graph, built to scale —
  every node is one `THREE.Points` draw call, edges are budgeted and labels are
  capped, with a bounded node budget, so it never tries to draw a whole large
  graph at once. Nodes cluster into per-layer "galaxies" via a deterministic
  layout; click to select (which dims unrelated stars and shows a marker), and
  rendering is on-demand (only on interaction / data / selection / theme / resize).
  Three.js is code-split, so it loads only when you open the tab, and the view
  falls back to a clear message when WebGL is unavailable.
- **Context:** task input, token budget, mode (`code` / `docs` / `all`), include
  tests / data toggles. Renders confidence, token usage, must-read, related docs,
  tables, tests, risks, and the excluded list with reasons — copyable as Markdown
  or JSON. Uses the same `buildContextPack` engine as the CLI and MCP server.
- **Impact:** reverse reachability ("what depends on this?") via the existing
  `affected` engine, with per-result evidence.
- **Flow:** a bounded shortest path between two nodes, each step backed by edge
  evidence, with a clear no-path state.
- **Docs / Data:** focused views over the docs and data layers.
- **Settings:** theme (light default + dark) and harmless view preferences,
  persisted to `localStorage` with a one-click clear.

## Architecture

Two packages cooperate:

| Package | Role |
| ------- | ---- |
| `@kawngraph/studio-server` (`packages/studio-server`) | Zero-dependency Node `http` server. Loads `<root>/.kawn/graph.json` once, serves the built frontend, and exposes a **read-only** JSON API. Reuses `@kawngraph/core` for query / context / impact / flow — no duplicated graph logic. |
| `@kawngraph/studio` (`apps/studio`) | The Vite + React single-page app served by the studio server. |

### Read-only HTTP API

All endpoints are local-only. `GET`s read; `POST`s are **computational only** —
they run the existing engines over the in-memory graph and never mutate it or
touch disk.

| Method + path | Purpose |
| ------------- | ------- |
| `GET /api/health` | Server status, resolved root, graph presence. |
| `GET /api/graph` | The normalized graph (nodes + edges + stats). |
| `GET /api/summary` | Counts by layer / type / edge type. |
| `POST /api/query` | Ranked, mode-scoped search. |
| `POST /api/context` | Token-budgeted context pack. |
| `POST /api/affected` | Reverse impact for a node. |
| `POST /api/flow` | Bounded shortest path between two nodes. |

Inputs are validated and outputs are capped with strict limits. The server never
writes to `.kawn/`, never scans, and makes no external network calls.

## License

MIT — see [LICENSE](../../LICENSE).
