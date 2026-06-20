import { spawn } from "node:child_process";
import type { McpLaunchSpec } from "./types";

export interface McpProbeResult {
  ok: boolean;
  protocolVersion?: string;
  serverName?: string;
  serverVersion?: string;
  tools: string[];
  /** result of a real athar_context call, when a smoke query was requested */
  contextOk?: boolean;
  contextError?: string;
  detail: string;
}

export interface ProbeOptions {
  /** also issue a real `athar_context` tools/call to prove retrieval works end-to-end */
  smokeQuery?: string;
  timeoutMs?: number;
  cwd?: string;
}

interface Rpc {
  id?: number | string;
  result?: any;
  error?: { code?: number; message?: string };
}

/**
 * Launch the Athar MCP server exactly as an agent would and drive a real
 * JSON-RPC handshake over stdio: `initialize` → `tools/list` → (optionally) a
 * live `athar_context` call. This is the honest end-to-end check that retrieval
 * actually works — used by `athar doctor`, adapter `verify`, and `pack:check`.
 *
 * Never throws: every failure path resolves to `{ ok: false, detail }`.
 */
export function probeMcpServer(launch: McpLaunchSpec, opts: ProbeOptions = {}): Promise<McpProbeResult> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  return new Promise<McpProbeResult>((resolve) => {
    const tools: string[] = [];
    const result: McpProbeResult = { ok: false, tools, detail: "" };
    let settled = false;
    let buf = "";
    let stderr = "";
    const pending = new Map<number, (msg: Rpc) => void>();

    let child;
    try {
      child = spawn(launch.command, launch.args, {
        env: { ...process.env, ...launch.env },
        cwd: opts.cwd,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });
    } catch (err) {
      resolve({ ...result, detail: `failed to spawn '${launch.command}': ${(err as Error).message}` });
      return;
    }

    const finish = (patch: Partial<McpProbeResult>, detail: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      Object.assign(result, patch, { detail });
      try {
        child.kill();
      } catch {
        /* already gone */
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      const tail = stderr.trim().slice(-200);
      finish({ ok: false }, `MCP server did not respond within ${timeoutMs}ms${tail ? ` · stderr: ${tail}` : ""}`);
    }, timeoutMs);

    child.on("error", (err: Error) => finish({ ok: false }, `failed to launch '${launch.command}': ${err.message}`));
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    const send = (msg: unknown): void => {
      child.stdin?.write(JSON.stringify(msg) + "\n");
    };
    const rpc = (id: number, method: string, params?: unknown): Promise<Rpc> =>
      new Promise<Rpc>((res) => {
        pending.set(id, res);
        send({ jsonrpc: "2.0", id, method, params });
      });

    child.stdout?.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      let nl = buf.indexOf("\n");
      while (nl >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        nl = buf.indexOf("\n");
        if (!line) continue;
        let msg: Rpc;
        try {
          msg = JSON.parse(line) as Rpc;
        } catch {
          continue;
        }
        if (typeof msg.id === "number" && pending.has(msg.id)) {
          const fn = pending.get(msg.id)!;
          pending.delete(msg.id);
          fn(msg);
        }
      }
    });

    void (async () => {
      const init = await rpc(1, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "athar-doctor", version: "0.1.0" },
      });
      if (init.error) {
        finish({ ok: false }, `initialize failed: ${init.error.message ?? "error"}`);
        return;
      }
      const proto: string | undefined = init.result?.protocolVersion;
      const serverName: string | undefined = init.result?.serverInfo?.name;
      const serverVersion: string | undefined = init.result?.serverInfo?.version;

      const list = await rpc(2, "tools/list", {});
      const listed: string[] = Array.isArray(list.result?.tools)
        ? list.result.tools.map((t: { name?: string }) => t.name).filter((n: unknown): n is string => typeof n === "string")
        : [];
      tools.push(...listed);

      let contextOk: boolean | undefined;
      let contextError: string | undefined;
      if (opts.smokeQuery) {
        const call = await rpc(3, "tools/call", {
          name: "athar_context",
          arguments: { task: opts.smokeQuery },
        });
        if (call.error) {
          contextOk = false;
          contextError = call.error.message ?? "error";
        } else if (call.result?.isError) {
          const text = firstText(call.result);
          contextOk = false;
          contextError = text ?? "tool returned isError";
        } else {
          contextOk = true;
        }
      }

      const ok = Boolean(proto) && tools.length > 0 && (opts.smokeQuery ? contextOk === true : true);
      finish(
        { ok, protocolVersion: proto, serverName, serverVersion, contextOk, contextError },
        ok ? "MCP handshake ok" : "MCP handshake incomplete",
      );
    })().catch((e: unknown) => finish({ ok: false }, `probe error: ${(e as Error).message}`));
  });
}

function firstText(result: { content?: Array<{ type?: string; text?: string }> }): string | undefined {
  const block = result.content?.find((c) => c.type === "text" && typeof c.text === "string");
  return block?.text?.slice(0, 200);
}
