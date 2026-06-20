#!/usr/bin/env node
import { createLogger, LogLevel, ContextMode, ATHAR_VERSION } from "@athar/shared";
import { runInit } from "./commands/init";
import { runScan } from "./commands/scan";
import { runUpdate } from "./commands/update";
import { runAffected } from "./commands/affected";
import { runContext } from "./commands/context";
import { runQuery } from "./commands/query";
import { runStudio } from "./commands/studio";

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

// Flags that consume the following token as their value (e.g. `--depth 3`).
// Everything else is treated as a boolean switch (e.g. `--verbose`).
const VALUE_FLAGS = new Set(["root", "ignore", "depth", "mode", "budget", "out", "limit", "port"]);

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

const HELP = `athar — Agent Context Graph (v${ATHAR_VERSION})

Build a token-efficient map of your repo so coding agents read the few files
that matter, not the whole tree.

Usage:
  athar <command> [path] [options]

Commands:
  init [path]              Create .athar/ config and a starter .atharignore
  scan [path]              Scan the repo and write .athar/graph.json + report.md
  update [path]            Re-scan (incremental updates planned for a later phase)
  affected <symbol>        Show what depends on a symbol (reverse impact)
  context "<task>"         Build a token-budgeted Context Pack for a task
  query "<text>"           Search the graph (mode-scoped), ranked hits
  studio [path]            Launch the local, read-only Studio (graph explorer)
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
  --json                   Emit machine-readable JSON (context/query)
  --out <file>             Write context output to a file instead of stdout
  --quiet                  Only print errors
  --verbose                Print info logs (default)
  --debug                  Print debug logs

Examples:
  athar init
  athar scan examples/nextjs-supabase
  athar affected getMerchantContext --depth 4
  athar context "fix the OAuth callback" --root examples/nextjs-supabase --budget 6000
  athar query "store tokens" --mode all --root examples/nextjs-supabase
  athar studio examples/nextjs-supabase --port 4173
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
