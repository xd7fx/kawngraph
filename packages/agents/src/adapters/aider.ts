import { makeOwnedFileAdapter } from "./ownedFile";
import { contextBridgeMarkdown } from "./bundle";
import type { AgentAdapter } from "../types";

/**
 * Aider integration (context-file).
 *
 * Aider is primarily an MCP *client* via `.aider.conf.yml` (verified 2026-06-24
 * against https://aider.chat/docs/), but its config is YAML and KawnGraph keeps a
 * zero-dependency, parser-free promise — so rather than risk mutating a user's
 * YAML, KawnGraph writes a context file Aider reads with `--read`. This is the
 * "context-file fallback" path and never touches Aider's own config.
 */
export const aiderAdapter: AgentAdapter = makeOwnedFileAdapter({
  agent: "aider",
  displayName: "Aider",
  kind: "context-file",
  supports: { mcp: false, slashCommands: false, contextFiles: true, promptExport: true },
  autoSelectable: true,
  ownedKey: ".kawn/agent-context/kawn-context.md",
  configFormat: {
    file: ".kawn/agent-context/kawn-context.md",
    ownedKey: "(KawnGraph-owned context file)",
    docUrl: "https://aider.chat/docs/usage/conventions.html",
    verifiedOn: "2026-06-24",
  },
  files: [{ relFile: ".kawn/agent-context/kawn-context.md", build: (ctx) => contextBridgeMarkdown(ctx.root) }],
  presentSignals: [".aider.conf.yml", ".aider.conf.yaml", ".aider.chat.history.md", ".aider.input.history"],
  usage: () => [
    "Have Aider read the context file: `aider --read .kawn/agent-context/kawn-context.md`",
    "Or persist it in `.aider.conf.yml`:  `read: [.kawn/agent-context/kawn-context.md]`",
  ],
});
