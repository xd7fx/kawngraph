import { makeOwnedFileAdapter } from "./ownedFile";
import { LOCAL_BASE_URLS, localLlmConfigJson } from "./bundle";
import type { AgentAdapter, AdapterContext } from "../types";

/**
 * Local-LLM provider config (optional, never required).
 *
 * `kawn setup local --provider ollama|lmstudio` records an OpenAI-compatible local
 * endpoint in `.kawn/local-llm.json`. KawnGraph still works fully WITHOUT it; the
 * endpoint is used only when you pass `--local`, and only for optional
 * summarization/reranking — never for scanning or required retrieval. No cloud, no
 * API keys, no telemetry.
 *
 * Endpoints verified 2026-06-24:
 *   - Ollama OpenAI-compat:   http://localhost:11434/v1  (https://docs.ollama.com/api/openai-compatibility)
 *   - LM Studio OpenAI-compat: http://localhost:1234/v1  (https://lmstudio.ai/docs/developer/openai-compat)
 */
function provider(ctx: AdapterContext): "ollama" | "lmstudio" | undefined {
  return ctx.options?.provider;
}

export const localAdapter: AgentAdapter = makeOwnedFileAdapter({
  agent: "local",
  displayName: "Local LLM (Ollama / LM Studio)",
  kind: "local-llm",
  supports: { mcp: false, slashCommands: false, contextFiles: false, promptExport: false },
  autoSelectable: false,
  ownedKey: ".kawn/local-llm.json",
  configFormat: {
    file: ".kawn/local-llm.json",
    ownedKey: "(local LLM endpoint — optional)",
    docUrl: "https://docs.ollama.com/api/openai-compatibility",
    verifiedOn: "2026-06-24",
  },
  files: [
    {
      relFile: ".kawn/local-llm.json",
      build: (ctx) => {
        const p = provider(ctx) ?? "ollama";
        return localLlmConfigJson(p, ctx.options?.baseUrl, ctx.options?.model);
      },
    },
  ],
  blockedReason: (ctx) =>
    provider(ctx) ? undefined : "kawn setup local needs a provider — pass --provider ollama|lmstudio.",
  usage: (ctx) => {
    const p = provider(ctx) ?? "ollama";
    const url = ctx.options?.baseUrl ?? LOCAL_BASE_URLS[p];
    return [
      `Recorded local provider "${p}" at ${url} (optional, no cloud).`,
      'Use it: `kawn ask "task" --local` or `kawn pack "task" --format markdown --local`.',
      "KawnGraph still works fully without a local LLM; on any failure it falls back to the deterministic pack.",
    ];
  },
});
