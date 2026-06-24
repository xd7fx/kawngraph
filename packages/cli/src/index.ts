#!/usr/bin/env node
import { createLogger, LogLevel, ContextMode, KAWN_VERSION } from "@kawngraph/shared";
import { isAgentId, type AdapterOptions, type Scope } from "@kawngraph/agents";
import { runPack, type PackFormat } from "./commands/pack";
import { runInit } from "./commands/init";
import { runScan } from "./commands/scan";
import { runUpdate } from "./commands/update";
import { runAffected } from "./commands/affected";
import { runContext, type ContextFormat } from "./commands/context";
import { runChanges, type ChangesView, type ChangesArgs } from "./commands/changes";
import { runQuery } from "./commands/query";
import { runStudio } from "./commands/studio";
import { runSetup, runConnect } from "./commands/setup";
import { runDisconnect } from "./commands/disconnect";
import { runMigrate } from "./commands/migrate";
import { runDoctorCommand } from "./commands/doctor";
import { runStatus } from "./commands/status";
import { runAgents } from "./commands/agents";
import { runBenchmarkCommand, runBenchmarkInitCommand, runBenchmarkMergeCommand } from "./commands/benchmark";

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

// Flags that consume the following token as their value (e.g. `--depth 3`).
// Everything else is treated as a boolean switch (e.g. `--verbose`).
const VALUE_FLAGS = new Set([
  "root", "ignore", "depth", "mode", "budget", "out", "limit", "port", "agent", "scope",
  "project", "projects-file", "repeat", "seed", "timeout", "out-dir", "task", "format",
  "base", "head", "provider", "model", "base-url",
]);

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else if (VALUE_FLAGS.has(body) && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags[body] = argv[++i];
      } else {
        flags[body] = true;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, flags };
}

function levelFrom(flags: Record<string, string | boolean>): LogLevel {
  if (flags.quiet) return "error";
  if (flags.debug) return "debug";
  if (flags.verbose) return "info";
  return "info";
}

function str(value: string | boolean | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function modeFrom(value: string | boolean | undefined, fallback: ContextMode): ContextMode {
  return value === "code" ||
    value === "docs" ||
    value === "all" ||
    value === "data" ||
    value === "tests" ||
    value === "auto"
    ? value
    : fallback;
}

function numFrom(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// Resolve the `kawn context` output format. An explicit `--format` wins;
// otherwise the legacy `--json` switch maps to the native JSON pack; default text.
function contextFormatFrom(value: string | boolean | undefined, jsonFlag: boolean): ContextFormat {
  if (value === "text" || value === "json" || value === "ucp" || value === "ucp-md") return value;
  return jsonFlag ? "json" : "text";
}

function scopeFrom(value: string | boolean | undefined): Scope {
  return value === "user" ? "user" : "project";
}

function packFormatFrom(value: string | boolean | undefined): PackFormat {
  return value === "json" ? "json" : "markdown";
}

/** Adapter-specific options from flags (e.g. `setup local --provider ollama`). */
function adapterOptionsFrom(flags: Record<string, string | boolean>): AdapterOptions | undefined {
  const provider = flags.provider === "ollama" || flags.provider === "lmstudio" ? flags.provider : undefined;
  const baseUrl = typeof flags["base-url"] === "string" ? flags["base-url"] : undefined;
  const model = typeof flags.model === "string" ? flags.model : undefined;
  if (!provider && !baseUrl && !model) return undefined;
  return { provider, baseUrl, model };
}

/**
 * `kawn setup [<agent>] [path]` — accept the agent as a positional
 * (`kawn setup claude`, `kawn setup local`) as well as `--agent`. Returns the
 * resolved agent selector and the project root.
 */
function setupTargetFrom(positionals: string[], flags: Record<string, string | boolean>): { agent: string; root: string } {
  const p0 = positionals[0];
  if (p0 && (p0 === "auto" || p0 === "all" || isAgentId(p0))) {
    return { agent: p0, root: positionals[1] ?? str(flags.root, ".") };
  }
  return { agent: str(flags.agent, "auto"), root: p0 ?? str(flags.root, ".") };
}

// Shared argument shape for the diff-driven commands (diff/pr-impact/pr-context).
function changesArgsFrom(positionals: string[], flags: Record<string, string | boolean>, logger: ReturnType<typeof createLogger>): ChangesArgs {
  return {
    root: positionals[0] ?? str(flags.root, "."),
    base: typeof flags.base === "string" ? flags.base : undefined,
    head: typeof flags.head === "string" ? flags.head : undefined,
    depth: numFrom(flags.depth),
    budget: numFrom(flags.budget),
    mode: modeFrom(flags.mode, "all"),
    json: flags.json === true,
    out: typeof flags.out === "string" ? flags.out : undefined,
    logger,
  };
}

const HELP = `kawn — KawnGraph: the Agent Context Universe (v${KAWN_VERSION})

One project universe. Every coding agent.
Build a token-efficient map of your repo so coding agents read the few files
that matter, not the whole tree.

Quick start:
  npx kawngraph setup        Connect this project to your coding agents,
                             then open Claude Code / Codex / Cursor and just
                             describe your task — they retrieve context for you.

Usage:
  kawn <command> [path] [options]

Commands:
  setup [path]             Do it all in one step: scan, detect your agents,
                           connect them, and verify retrieval actually works
  update [path]            Re-scan after code changes (keep the map fresh)
  map [path]               Open the visual map — a local, read-only explorer
  ask "<task>"             Get the few files that matter for a task
  impact <symbol>          See what depends on a symbol (what breaks if you change it)
  changes [path]           What you changed, mapped onto the graph
                           (--impact = blast radius · --context = a pack to work it)
  check [path]             Health check — is everything set up and fresh?
  bench [path]             Measure the difference KawnGraph makes (A/B test)

  version                  Print the KawnGraph version
  help                     Show this help (full command list under "Advanced")

Common options:
  --root <path>            Repo root (default: positional path or ".")
  --yes                    Assume "yes" — non-interactive (required in CI)
  --json                   Emit machine-readable JSON
  --budget <n>             Token budget for ask / changes --context (default: 8000)
  --mode <auto|code|docs|data|tests|all>   Scope ask to a layer (default: all)
  --depth <n>              Max impact depth for impact / changes (default: 6)
  --base <ref>             changes: compare against a base ref (PR mode: base...head)
  --agent <sel>            setup target: auto|all|claude|codex|cursor|copilot|gemini|aider (default auto)
                           (or pass it positionally, e.g. kawn setup claude)
  --port <n>               Port for map (default: 4173, falls back if busy)
  --no-open                Don't open a browser when launching map

Examples:
  npx kawngraph setup                       # one-command setup for your agents
  kawn ask "fix the OAuth callback"         # the files that matter for this task
  kawn impact getSession                    # what depends on getSession
  kawn changes --impact --base main         # blast radius of this branch vs main
  kawn map                                  # open the visual explorer
  kawn check                                # is the graph fresh? who is connected?

────────────────────────────────────────────────────────────────────────────
Advanced

Each beginner command above is a friendly alias for one of the lower-level
commands below. The technical names remain fully supported for fine-grained
control and scripting.

Build (run by setup; use directly for control):
  init [path]              Create .kawn/ config and a starter .kawnignore
  scan [path]              Scan the repo and write .kawn/graph.json + report.md

Query — behind ask / impact / map:
  context "<task>"         Build a token-budgeted Context Pack            (= ask)
                           (--format text|json|ucp|ucp-md; ucp = portable protocol)
  pack "<task>"            Export the pack for ANY tool                   (--format markdown|json)
                           markdown = ready-to-paste prompt · --local = condense via local LLM
  query "<text>"           Search the graph (mode-scoped), ranked hits
  affected <symbol>        Reverse impact of a symbol                     (= impact)
  studio [path]            The local, read-only graph explorer            (= map)

Change impact — behind changes (local git only; no network, no GitHub API):
  diff [path]              Changed files mapped onto the graph            (= changes)
  pr-impact [path]         Blast radius: dependents + files to re-check   (= changes --impact)
  pr-context [path]        A budgeted Context Pack to work the change     (= changes --context)

Agent integration — behind setup / check (one core graph · an adapter per tool):
  setup <agent> [path]     Connect one agent: claude|codex|cursor|copilot|gemini|aider|generic
  setup local --provider <p>   Record an OPTIONAL local LLM (ollama|lmstudio); never required
  connect <agent> [path]   Install one agent's integration (alias of setup <agent>)
  disconnect <agent>       Remove only KawnGraph's entry from an agent's config
  status [path]            Graph freshness + which agents are connected
  doctor [path]            Read-only health check (PASS/WARN/FAIL, exit code)  (= check)
  agents [path]            The integration matrix (tools · capabilities · files)
  agents status [path]     Compact connection state per agent
  agents uninstall <id>    Remove one agent's KawnGraph integration

Maintenance:
  migrate [path]           Move a legacy .athar/ data dir to .kawn/ (safe; --dry-run)
                           Never deletes .athar/; never overwrites an existing .kawn/

Benchmark — behind bench (subscription auth — no API keys):
  benchmark [path]         A/B test agents WITH vs WITHOUT KawnGraph      (= bench)
  benchmark init           Scaffold a LOCAL-ONLY draft suite for an external repo
  benchmark merge          Stitch chunked report JSONs into one unified report

Advanced options:
  --ignore <a,b,c>         Extra comma-separated ignore patterns (scan/update)
  --head <ref>             changes: head ref for PR mode (default: HEAD)
  --limit <n>              Max hits for query (default: 25)
  --scope <project|user>   Integration scope (default project; user is not modified)
  --force                  Replace a pre-existing non-KawnGraph entry of the same name
  --dry-run                setup: show what would change, write nothing
  --skip-probe             check/doctor: skip the live MCP handshake
  --impact                 changes: show the blast radius instead of the diff
  --context                changes: emit a budgeted Context Pack for the change
  --format <fmt>           ask/context: text|json|ucp|ucp-md · pack: markdown|json
                           ucp/ucp-md = agent-neutral Universal Context Protocol
  --provider <p>           setup local: ollama | lmstudio (local LLM endpoint)
  --base-url <url>         setup local: override the local endpoint base URL
  --model <id>             pack/ask --local: local model id for condensing
  --local                  pack/ask: condense the pack via the local LLM (optional)
  --out <file>             Write output to a file instead of stdout

Benchmark options:
  --project <path>         Single project to benchmark (or pass as a positional)
  --projects-file <file>   JSON suite of projects + tasks + gold sets
  --agent <sel>            claude | codex | both (default: claude)
  --repeat <n>             Repeats per condition (default: 3; randomized A/B order)
  --seed <n>               Seed for the A/B order (default: 1; reproducible)
  --mode <retrieval|e2e>   retrieval (read-only) or e2e (edit + run tests)
  --timeout <sec>          Per-session timeout in seconds (default: 480)
  --out-dir <dir>          Report/transcript dir (default: benchmark-results/)

benchmark init options (external repos, never committed):
  --project <path>         The external project to benchmark (required)
  --task "<prompt>"        A prompt; KawnGraph suggests a draft gold set for it
  --mode <retrieval|e2e>   Mode for the --task task (default: retrieval)
  --out <file>             Draft suite path (default: benchmarks/local/<id>.bench.json)
  --force                  Overwrite an existing draft

benchmark merge options (combine chunked runs into one report):
  <report.json|dir> …      One or more report JSONs, or dirs of benchmark-*.json
  --out-dir <dir>          Where to write merged-*.{json,csv,md} (default: benchmark-results/)

  --quiet                  Only print errors
  --verbose                Print info logs (default)
  --debug                  Print debug logs

Advanced examples:
  kawn setup --agent all --yes       # non-interactive, all agents
  kawn setup --dry-run               # preview the exact file changes
  kawn connect claude                # wire up just Claude Code
  kawn disconnect codex              # cleanly remove KawnGraph from Codex
  kawn doctor --json                 # health check for CI (exits non-zero on FAIL)
  kawn context "fix the OAuth callback" --root examples/nextjs-supabase --budget 6000
  kawn benchmark --project examples/nextjs-supabase --agent claude --repeat 3
  kawn benchmark --projects-file benchmarks/projects.json --agent both
  kawn benchmark init --project ../lamha --task "trace the checkout flow"
  kawn benchmark merge benchmark-results/                 # fold every chunk into one
`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { positionals, flags } = parseArgs(argv);
  const command = positionals.shift();
  const logger = createLogger(levelFrom(flags));

  const ignore =
    typeof flags.ignore === "string"
      ? flags.ignore.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

  switch (command) {
    case "init": {
      const root = positionals[0] ?? str(flags.root, ".");
      await runInit({ root, logger });
      break;
    }
    case "scan": {
      const root = positionals[0] ?? str(flags.root, ".");
      await runScan({ root, ignore, logger });
      break;
    }
    case "update": {
      const root = positionals[0] ?? str(flags.root, ".");
      await runUpdate({ root, ignore, logger });
      break;
    }
    case "impact": // beginner alias
    case "affected": {
      const root = str(flags.root, ".");
      const depth = typeof flags.depth === "string" ? Number(flags.depth) : undefined;
      await runAffected({ root, query: positionals[0], depth, logger });
      break;
    }
    case "changes": // beginner alias: diff by default; --impact / --context select the deeper views
    case "diff":
    case "pr-impact":
    case "pr-context": {
      const view: ChangesView =
        command === "diff"
          ? "diff"
          : command === "pr-impact"
            ? "impact"
            : command === "pr-context"
              ? "context"
              : flags.context === true
                ? "context"
                : flags.impact === true
                  ? "impact"
                  : "diff";
      await runChanges(changesArgsFrom(positionals, flags, logger), view);
      break;
    }
    case "ask": // beginner alias
    case "context": {
      const root = str(flags.root, ".");
      // `kawn ask "task" --local` condenses the pack via a local LLM (optional).
      if (command === "ask" && flags.local === true) {
        await runPack({
          root,
          task: positionals[0],
          budget: numFrom(flags.budget),
          mode: modeFrom(flags.mode, "all"),
          format: "markdown",
          out: typeof flags.out === "string" ? flags.out : undefined,
          local: true,
          model: typeof flags.model === "string" ? flags.model : undefined,
          logger,
        });
        break;
      }
      await runContext({
        root,
        task: positionals[0],
        budget: numFrom(flags.budget),
        mode: modeFrom(flags.mode, "all"),
        format: contextFormatFrom(flags.format, flags.json === true),
        out: typeof flags.out === "string" ? flags.out : undefined,
        logger,
      });
      break;
    }
    case "query": {
      const root = str(flags.root, ".");
      await runQuery({
        root,
        query: positionals[0],
        mode: modeFrom(flags.mode, "all"),
        limit: numFrom(flags.limit),
        json: flags.json === true,
        logger,
      });
      break;
    }
    case "map": // beginner alias
    case "studio": {
      const root = positionals[0] ?? str(flags.root, ".");
      await runStudio({
        root,
        port: numFrom(flags.port),
        open: flags["no-open"] !== true,
        logger,
      });
      break;
    }
    case "setup": {
      const { agent, root } = setupTargetFrom(positionals, flags);
      await runSetup({
        root,
        agent,
        scope: scopeFrom(flags.scope),
        yes: flags.yes === true,
        force: flags.force === true,
        dryRun: flags["dry-run"] === true,
        json: flags.json === true,
        ignore,
        options: adapterOptionsFrom(flags),
        logger,
      });
      break;
    }
    case "pack": {
      const root = str(flags.root, ".");
      await runPack({
        root,
        task: positionals[0],
        budget: numFrom(flags.budget),
        mode: modeFrom(flags.mode, "all"),
        format: packFormatFrom(flags.format),
        out: typeof flags.out === "string" ? flags.out : undefined,
        local: flags.local === true,
        model: typeof flags.model === "string" ? flags.model : undefined,
        logger,
      });
      break;
    }
    case "connect": {
      const agent = positionals[0];
      if (!agent) {
        logger.error("usage: kawn connect <claude|codex|cursor> [path]");
        process.exitCode = 1;
        break;
      }
      const root = positionals[1] ?? str(flags.root, ".");
      await runConnect(agent, {
        root,
        scope: scopeFrom(flags.scope),
        yes: flags.yes === true,
        force: flags.force === true,
        dryRun: flags["dry-run"] === true,
        json: flags.json === true,
        ignore,
        logger,
      });
      break;
    }
    case "disconnect": {
      const agent = positionals[0];
      if (!agent) {
        logger.error("usage: kawn disconnect <claude|codex|cursor> [path]");
        process.exitCode = 1;
        break;
      }
      const root = positionals[1] ?? str(flags.root, ".");
      await runDisconnect({ root, agent, scope: scopeFrom(flags.scope), json: flags.json === true, logger });
      break;
    }
    case "migrate": {
      const root = positionals[0] ?? str(flags.root, ".");
      await runMigrate({
        root,
        dryRun: flags["dry-run"] === true,
        json: flags.json === true,
        logger,
      });
      break;
    }
    case "check": // beginner alias
    case "doctor": {
      const root = positionals[0] ?? str(flags.root, ".");
      await runDoctorCommand({
        root,
        scope: scopeFrom(flags.scope),
        json: flags.json === true,
        skipProbe: flags["skip-probe"] === true,
        logger,
      });
      break;
    }
    case "status": {
      const root = positionals[0] ?? str(flags.root, ".");
      await runStatus({ root, scope: scopeFrom(flags.scope), json: flags.json === true, logger });
      break;
    }
    case "agents": {
      const sub = positionals[0];
      if (sub === "uninstall") {
        const id = positionals[1];
        if (!id) {
          logger.error("usage: kawn agents uninstall <id> [path]");
          process.exitCode = 1;
          break;
        }
        const root = positionals[2] ?? str(flags.root, ".");
        await runDisconnect({ root, agent: id, scope: scopeFrom(flags.scope), json: flags.json === true, logger });
        break;
      }
      if (sub === "status") {
        const root = positionals[1] ?? str(flags.root, ".");
        await runAgents({ root, scope: scopeFrom(flags.scope), json: flags.json === true, view: "status", logger });
        break;
      }
      const root = sub ?? str(flags.root, "."); // `kawn agents [path]`
      await runAgents({ root, scope: scopeFrom(flags.scope), json: flags.json === true, view: "list", logger });
      break;
    }
    case "bench": // beginner alias
    case "benchmark": {
      if (positionals[0] === "init") {
        await runBenchmarkInitCommand({
          project: typeof flags.project === "string" ? flags.project : positionals[1],
          outFile: typeof flags.out === "string" ? flags.out : undefined,
          task: typeof flags.task === "string" ? flags.task : undefined,
          mode: flags.mode === "e2e" ? "e2e" : "retrieval",
          force: flags.force === true,
          logger,
        });
        break;
      }
      if (positionals[0] === "merge") {
        await runBenchmarkMergeCommand({
          inputs: positionals.slice(1),
          outDir: typeof flags["out-dir"] === "string" ? flags["out-dir"] : undefined,
          logger,
        });
        break;
      }
      await runBenchmarkCommand({
        project: typeof flags.project === "string" ? flags.project : positionals[0],
        projectsFile: typeof flags["projects-file"] === "string" ? flags["projects-file"] : undefined,
        agent: str(flags.agent, "claude"),
        repeat: numFrom(flags.repeat) ?? 3,
        seed: numFrom(flags.seed) ?? 1,
        timeoutSec: numFrom(flags.timeout) ?? 480,
        mode: flags.mode === "e2e" ? "e2e" : "retrieval",
        outDir: typeof flags["out-dir"] === "string" ? flags["out-dir"] : undefined,
        logger,
      });
      break;
    }
    case "version":
    case undefined: {
      if (flags.version || command === "version") {
        process.stdout.write(KAWN_VERSION + "\n");
        break;
      }
      process.stdout.write(HELP);
      break;
    }
    case "help":
      process.stdout.write(HELP);
      break;
    default:
      logger.error(`unknown command "${command}"`);
      process.stdout.write(HELP);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(`[kawn] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
