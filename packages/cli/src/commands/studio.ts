import * as path from "node:path";
import * as fs from "node:fs";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { Logger } from "@athar/shared";
import { createStudioServer, loadGraphState } from "@athar/studio-server";

export interface StudioArgs {
  root: string;
  port?: number;
  open: boolean;
  logger: Logger;
}

const HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;
const PORT_TRIES = 10;

/** Best-effort: locate the built Studio frontend (apps/studio/dist) next to the CLI. */
function findStaticDir(): string | undefined {
  // packages/cli/dist/commands -> repo root is four levels up.
  const candidate = path.resolve(__dirname, "..", "..", "..", "..", "apps", "studio", "dist");
  const index = path.join(candidate, "index.html");
  return fs.existsSync(index) ? candidate : undefined;
}

function openBrowser(url: string, logger: Logger): void {
  const platform = process.platform;
  const cmd = platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => logger.warn(`could not open a browser — visit ${url} manually`));
    child.unref();
  } catch {
    logger.warn(`could not open a browser — visit ${url} manually`);
  }
}

/** Try to listen on `host:port`, incrementing the port on EADDRINUSE up to `tries`. */
function listenWithFallback(
  server: ReturnType<typeof createStudioServer>,
  startPort: number,
  tries: number,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = startPort;
    let attempts = 0;
    const tryListen = (): void => {
      attempts++;
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && attempts < tries) {
          port++;
          tryListen();
        } else {
          reject(err);
        }
      });
      server.listen(port, HOST, () => {
        const addr = server.address() as AddressInfo | null;
        resolve(addr ? addr.port : port);
      });
    };
    tryListen();
  });
}

export async function runStudio(args: StudioArgs): Promise<void> {
  const { logger, open } = args;
  const root = path.resolve(args.root);
  const requestedPort = Number.isFinite(args.port) && (args.port as number) > 0 ? Math.floor(args.port as number) : DEFAULT_PORT;

  const staticDir = findStaticDir();
  if (!staticDir) {
    logger.warn(
      "Studio frontend is not built — serving the API only. Build the UI with `pnpm --filter @athar/studio build`.",
    );
  }

  // Tell the user up-front whether a graph is available (the UI shows this too).
  const state = await loadGraphState(root);
  if (state.status === "ok") {
    logger.info(`graph: ${state.graph?.stats.nodes} nodes, ${state.graph?.stats.edges} edges (generated ${state.generatedAt})`);
  } else {
    logger.warn(`graph ${state.status}: ${state.error}`);
  }

  const server = createStudioServer({
    root,
    staticDir,
    logger: { info: (m) => logger.debug(m), warn: (m) => logger.warn(m), error: (m) => logger.error(m) },
  });

  let boundPort: number;
  try {
    boundPort = await listenWithFallback(server, requestedPort, PORT_TRIES);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EADDRINUSE") {
      logger.error(`ports ${requestedPort}–${requestedPort + PORT_TRIES - 1} are all in use. Free one or pass --port <n>.`);
    } else {
      logger.error(`could not start Studio: ${e.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const url = `http://${HOST}:${boundPort}/`;
  logger.success(`Athar Studio running at ${url}`);
  logger.info(`serving root: ${root}`);
  logger.info("read-only · local only · press Ctrl+C to stop");

  if (open) openBrowser(url, logger);

  // Track sockets so a stuck keep-alive connection can't block shutdown.
  const sockets = new Set<import("node:net").Socket>();
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });

  await new Promise<void>((resolve) => {
    let closing = false;
    const shutdown = (signal: string): void => {
      if (closing) return;
      closing = true;
      logger.info(`\n${signal} received — shutting down`);
      server.close(() => resolve());
      for (const s of sockets) s.destroy();
      // Safety net if close hangs.
      setTimeout(() => resolve(), 2000).unref();
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  });
}
