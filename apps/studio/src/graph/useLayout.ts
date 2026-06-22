/**
 * Graph layout, kept off the main thread once a graph gets large.
 *
 * Small graphs lay out synchronously — instant, and no spinner flicker. Above a
 * threshold the work is handed to a single shared Web Worker so panning/zooming
 * stays smooth while positions are computed; until they arrive the hook reports
 * `pending` so the canvas can show a spinner instead of dumping every node at
 * the origin. If a Worker can't be constructed (older runtime, test env) it
 * transparently falls back to synchronous layout.
 */
import { useEffect, useMemo, useState } from "react";
import { layoutPositions, type LayoutNode, type XY } from "./layout";
import type { LayoutRequest, LayoutResult } from "./layout.worker";

// `renderLimit` defaults to 300, so ordinary views stay on the synchronous path;
// the worker only engages once the cap is lifted past this many nodes — exactly
// when a main-thread layout would start to stutter.
const WORKER_THRESHOLD = 400;

let sharedWorker: Worker | null = null;
let workerUnavailable = false;

/** Lazily construct one shared worker; remember if the runtime can't make one. */
function getWorker(): Worker | null {
  if (workerUnavailable) return null;
  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(new URL("./layout.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      workerUnavailable = true;
      return null;
    }
  }
  return sharedWorker;
}

let nextRequestId = 0;

export interface LayoutState {
  positions: Map<string, XY>;
  /** True while a large graph's positions are still being computed off-thread. */
  pending: boolean;
}

const EMPTY: Map<string, XY> = new Map();

export function useLayout(nodes: readonly LayoutNode[]): LayoutState {
  const useWorker = nodes.length > WORKER_THRESHOLD;

  // Small graphs: synchronous + memoized. No round-trip, no flicker.
  const syncPositions = useMemo(
    () => (useWorker ? null : layoutPositions(nodes)),
    [useWorker, nodes],
  );

  // Large graphs: positions arrive from the worker, tagged with the exact nodes
  // array they belong to so a stale/out-of-order response can never paint the
  // wrong layout for the current input.
  const [worked, setWorked] = useState<{
    nodes: readonly LayoutNode[];
    positions: Map<string, XY>;
  } | null>(null);

  useEffect(() => {
    if (!useWorker) return;
    const worker = getWorker();
    if (!worker) {
      // No worker available — compute synchronously as a correctness fallback.
      setWorked({ nodes, positions: layoutPositions(nodes) });
      return;
    }
    let cancelled = false;
    const id = ++nextRequestId;
    const onMessage = (ev: MessageEvent<LayoutResult>): void => {
      if (cancelled || ev.data.id !== id) return;
      setWorked({ nodes, positions: new Map(ev.data.positions) });
    };
    worker.addEventListener("message", onMessage);
    const req: LayoutRequest = {
      id,
      nodes: nodes.map((n) => ({ id: n.id, layer: n.layer })),
    };
    worker.postMessage(req);
    return () => {
      // A superseded request is ignored (cancelled), so a slow earlier layout
      // can't clobber a newer one — cooperative cancellation, no worker restart.
      cancelled = true;
      worker.removeEventListener("message", onMessage);
    };
  }, [useWorker, nodes]);

  if (syncPositions) return { positions: syncPositions, pending: false };
  if (worked && worked.nodes === nodes) return { positions: worked.positions, pending: false };
  return { positions: EMPTY, pending: true };
}
