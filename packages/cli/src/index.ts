#!/usr/bin/env node
import { createLogger, LogLevel, ContextMode, ATHAR_VERSION } from "@athar/shared";
import type { Scope } from "@athar/agents";
import { runInit } from "./commands/init";
import { runScan } from "./commands/scan";
import { runUpdate } from "./commands/update";
import { runAffected } from "./commands/affected";
import { runContext } from "./commands/context";
import { runQuery } from "./commands/query";
import { runStudio } from "./commands/studio";
import { runSetup, runConnect } from "./commands/setup";
import { runDisconnect } from "./commands/disconnect";
import { runDoctorCommand } from "./commands/doctor";
import { runStatus } from "./commands/status";
import { runAgents } from "./commands/agents";

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

// Flags that consume the following token as their value (e.g. `--depth 3`).
// Everything else is treated as a boolean switch (e.g. `--verbose`).
const VALUE_FLAGS = new Set(["root", "ignore", "depth", "mode", "budget", "out", "limit", "port", "agent", "scope"]);

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
  return value === "code" || value === "docs" || value === "all" ? value : fallback;
}

function numFrom(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function scopeFrom(value: string | boolean | undefined): Scope {
  return value === "user" ? "user" : "project";
}

const HELP = `athar — Agent Context Graph (v${ATHAR_VERSION})

Build a token-efficient map of your repo so coding agents read the few files
that matter, not the whole tree.

Usage:
  athar <command> [path] [options]

Build commands:
  init [path]              Create .athar/ config and a starter .atharignore
  scan [path]              Scan the repo and write .athar/graph.json + report.md
  update [path]            Re-scan and refresh the freshness manifest

Query commands:
  affected <symbol>        Show what depends on a symbol (reverse impact)
  context "<task>"         Build a token-budgeted Context Pack for a task
  query "<text>"           Search the graph (mode-scoped), ranked hits
  studio [path]            Launch the local, read-only Studio (graph explorer)

Agent integration:
  setup [path]             Connect this project to your coding agents (one command)
  connect <agent> [path]   Install one agent's integration (claude|codex|cursor)
  disconnect <agent>       Remove only Athar's entry from an agent's config
  status [path]            Graph freshness + which agents are connected
  doctor [path]            Read-only health check (PASS/WARN/FAIL, exit code)
  agents [path]            List supported agents + the files each manages

  version                  Print the Athar version
  help                     Show this help

Options:
  --root <path>            Repo root (default: positional path or ".")
  --ignore <a,b,c>         Extra comma-separated ignore patterns (scan/update)
  --depth <n>              Max impact depth for affected (default: 6)
  --budget <n>             Token budget for a context pack (default: 8000)
  --mode <code|docs|all>   Scope a query/context to a layer (default: all)
  --limit <n>              Max hits for query (default: 25)
  --port <n>               Port for studio (default: 4173, falls back if busy)
  --no-open                Don't open a browser when launching studio
  --agent <sel>            setup target: auto|all|claude|codex|cursor (default auto)
  --scope <project|user>   Integration scope (default project; user is not modified)
  --yes                    Assume "yes" — non-interactive (required in CI)
  --force                  Replace a pre-existing non-Athar entry of the same name
  --dry-run                setup: show what would change, write nothing
  --skip-probe             doctor: skip the live MCP handshake
  --json                   Emit machine-readable JSON
  --out <file>             Write context output to a file instead of stdout
  --quiet                  Only print errors
  --verbose                Print info logs (default)
  --debug                  Print debug logs

Examples:
  athar setup                         # scan if needed, detect agents, connect, verify
  athar setup --agent all --yes       # non-interactive, all agents
  athar setup --dry-run               # preview the exact file changes
  athar connect claude                # wire up just Claude Code
  athar disconnect codex              # cleanly remove Athar from Codex
  athar status                        # is the graph fresh? who is connected?
  athar doctor --json                 # health check for CI (exits non-zero on FAIL)
  athar scan examples/nextjs-supabase
  athar context "fix the OAuth callback" --root examples/nextjs-supabase --budget 6000
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
    case "affected": {
      const root = str(flags.root, ".");
      const depth = typeof flags.depth === "string" ? Number(flags.depth) : undefined;
      await runAffected({ root, query: positionals[0], depth, logger });
      break;
    }
    case "context": {
      const root = str(flags.root, ".");
      await runContext({
        root,
        task: positionals[0],
        budget: numFrom(flags.budget),
        mode: modeFrom(flags.mode, "all"),
        json: flags.json === true,
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
      const root = positionals[0] ?? str(flags.root, ".");
      await runSetup({
        root,
        agent: str(flags.agent, "auto"),
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
    case "connect": {
      const agent = positionals[0];
      if (!agent) {
        logger.error("usage: athar connect <claude|codex|cursor> [path]");
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
        logger.error("usage: athar disconnect <claude|codex|cursor> [path]");
        process.exitCode = 1;
        break;
      }
      const root = positionals[1] ?? str(flags.root, ".");
      await runDisconnect({ root, agent, scope: scopeFrom(flags.scope), json: flags.json === true, logger });
      break;
    }
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
      const root = positionals[0] ?? str(flags.root, ".");
      await runAgents({ root, scope: scopeFrom(flags.scope), json: flags.json === true, logger });
      break;
    }
    case "version":
    case undefined: {
      if (flags.version || command === "version") {
        process.stdout.write(ATHAR_VERSION + "\n");
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
  process.stderr.write(`[athar] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
