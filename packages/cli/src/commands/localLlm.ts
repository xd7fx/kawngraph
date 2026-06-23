import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface LocalLlmConfig {
  provider: string;
  baseUrl: string;
  model: string | null;
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/** Read `.kawn/local-llm.json` (written by `kawn setup local`). null when absent/invalid. */
export async function readLocalLlmConfig(root: string): Promise<LocalLlmConfig | null> {
  try {
    const raw = await fs.readFile(path.join(root, ".kawn", "local-llm.json"), "utf8");
    const c = JSON.parse(raw) as Partial<LocalLlmConfig>;
    if (c && typeof c.baseUrl === "string" && typeof c.provider === "string") {
      return { provider: c.provider, baseUrl: c.baseUrl, model: c.model ?? null };
    }
  } catch {
    /* not configured */
  }
  return null;
}

export type LocalResult = { ok: true; text: string; model: string; provider: string } | { ok: false; error: string };

/**
 * OPTIONALLY condense a Context Pack via a LOCAL OpenAI-compatible endpoint
 * (Ollama at :11434/v1, LM Studio at :1234/v1). This is never required: any
 * failure — no config, no server running, no model, bad response, timeout —
 * returns `{ ok: false }` and the caller emits the deterministic pack unchanged.
 * No cloud, no API keys, no telemetry.
 */
export async function localSummarize(
  root: string,
  packMarkdown: string,
  opts: { model?: string; timeoutMs?: number } = {},
): Promise<LocalResult> {
  const cfg = await readLocalLlmConfig(root);
  if (!cfg) return { ok: false, error: "no local LLM configured — run `kawn setup local --provider ollama|lmstudio`" };
  const model = opts.model ?? cfg.model ?? undefined;
  if (!model) return { ok: false, error: `no model set — add "model" to .kawn/local-llm.json or pass --model` };

  const url = cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You condense an evidence-backed code Context Pack into a short, accurate brief for a coding agent. Keep every file path, symbol, and identifier exactly as written. Never invent files or facts. Output Markdown.",
          },
          { role: "user", content: packMarkdown },
        ],
        temperature: 0.1,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `local LLM HTTP ${res.status} at ${cfg.baseUrl}` };
    const data = (await res.json()) as ChatResponse;
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) return { ok: false, error: "local LLM returned no content" };
    return { ok: true, text: text.trim(), model, provider: cfg.provider };
  } catch (e) {
    return { ok: false, error: `local LLM unreachable at ${cfg.baseUrl} (${(e as Error).message})` };
  } finally {
    clearTimeout(timer);
  }
}
