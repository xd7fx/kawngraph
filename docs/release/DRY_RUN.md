# v0.1.0 Release Dry Run

A complete, **publish-free** rehearsal of the release. Reproduce any time with
`pnpm release:check` (build → test → pack:check → publish --dry-run). **Nothing is
published; no tag, no GitHub release.**

## Commands run

```bash
pnpm build                              # tsc -b — workspace compiles
pnpm test                              # node --test → 399/399 pass
pnpm pack:check                        # pack every pkg, install closure from tarballs, smoke the CLI + MCP + Studio
pnpm -r publish --dry-run --no-git-checks   # what publish WOULD do (publishes nothing)
```

## Tarballs that would be published (10 packages, dependency order)

`workspace:*` is rewritten to `0.1.0` by pnpm at pack time (verified inside the
`@kawngraph/agents` tarball). Each ships `dist/` + `package.json` + `LICENSE` only
(no `src/`, `tsconfig`, or `*.tsbuildinfo`).

| Package | Tarball | Files |
| --- | --- | --- |
| `@kawngraph/shared` | `kawngraph-shared-0.1.0.tgz` | 30 |
| `@kawngraph/scanner-sdk` | `kawngraph-scanner-sdk-0.1.0.tgz` | 34 |
| `@kawngraph/scanners` | `kawngraph-scanners-0.1.0.tgz` | 110 |
| `@kawngraph/context-protocol` | `kawngraph-context-protocol-0.1.0.tgz` | 38 |
| `@kawngraph/core` | `kawngraph-core-0.1.0.tgz` | 86 |
| `@kawngraph/mcp` | `kawngraph-mcp-0.1.0.tgz` | 7 |
| `@kawngraph/agents` | `kawngraph-agents-0.1.0.tgz` | 102 |
| `@kawngraph/studio-server` | `kawngraph-studio-server-0.1.0.tgz` | 26 |
| `@kawngraph/benchmark` | `kawngraph-benchmark-0.1.0.tgz` | 70 |
| `kawngraph` (CLI) | `kawngraph-0.1.0.tgz` | 84 (incl. bundled `studio-dist/`) |

Each line ended with: `Publishing to https://registry.npmjs.org/ with tag latest
and public access (dry-run)`. Root `kawngraph-monorepo` is `private` → never packed.

## Installed-from-tarball smoke results (pack:check)

| Check | Result |
| --- | --- |
| Consumer `npm install` resolves the whole `@kawngraph/*` closure from tarballs | ✓ |
| `kawn version` | ✓ → `0.1.0` |
| `kawn scan <fixture>` writes `.kawn/graph.json` | ✓ |
| `kawn setup --agent all --yes` writes `.mcp.json`, `.cursor/mcp.json`, `.codex/config.toml` | ✓ |
| **MCP stdio handshake** (`initialize` + `tools/list`) on the installed `@kawngraph/mcp` | ✓ — serverInfo `kawn`; tools `kawn_context`, `kawn_query`, `kawn_affected`, `kawn_changes` |
| CLI tarball ships the bundled Studio UI (`studio-dist/index.html`) | ✓ |
| **`kawn map` serves the UI** — `HTTP 200` + `index.html` at `127.0.0.1:47319` | ✓ |
| `kawn disconnect codex` removes only `[mcp_servers.kawn]` (reversible) | ✓ |

## Privacy / safety during the run

- No network during `scan` / context retrieval (local-first; only `pnpm`/`npm`
  registry traffic for the *install* step of the throwaway consumer).
- MCP server is read-only — `initialize`/`tools/list` only; it never scanned or wrote.
- Generated files were confined to `.kawn/` + the expected agent config files; the
  repo's `examples/` tree was copied, never mutated.

## Status

**Dry run is GREEN.** Not published. The only remaining gates before a real release
are the manual live adapter QA ([ADAPTER_QA.md](ADAPTER_QA.md)) and the maintainer's
explicit `npm login` + `pnpm release:publish` + tag + GitHub release
([../RELEASING.md](../RELEASING.md)).
