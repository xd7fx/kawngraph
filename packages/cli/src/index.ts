#!/usr/bin/env node
import { createLogger, LogLevel, ATHAR_VERSION } from "@athar/shared";
import { runInit } from "./commands/init";
import { runScan } from "./commands/scan";
import { runUpdate } from "./commands/update";
import { runAffected } from "./commands/affected";

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

// Flags that consume the following token as their value (e.g. `--depth 3`).
// Everything else is treated as a boolean switch (e.g. `--verbose`).
const VALUE_FLAGS = new Set(["root", "ignore", "depth", "mode", "budget", "out"]);

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
  version                  Print the Athar version
  help                     Show this help

Options:
  --root <path>            Repo root (default: positional path or ".")
  --ignore <a,b,c>         Extra comma-separated ignore patterns (scan/update)
  --depth <n>              Max impact depth for affected (default: 6)
  --quiet                  Only print errors
  --verbose                Print info logs (default)
  --debug                  Print debug logs

Examples:
  athar init
  athar scan examples/nextjs-supabase
  athar affected getMerchantContext --depth 4
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
