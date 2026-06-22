/**
 * Web Worker: runs the deterministic layered layout off the main thread so a
 * large graph doesn't freeze scroll/zoom while positions are computed. The math
 * itself lives in ./layout (pure, shared with the synchronous small-graph path);
 * this module is only the message shim. Vite bundles it as a module worker via
 * the `new Worker(new URL("./layout.worker.ts", import.meta.url))` reference.
 */
import { layoutPositions, type LayoutNode, type XY } from "./layout";

/** Main thread -> worker: lay out these nodes, tagged with a request id. */
export interface LayoutRequest {
  id: number;
  nodes: LayoutNode[];
}

/** Worker -> main thread: positions for request `id` as [nodeId, xy] pairs. */
export interface LayoutResult {
  id: number;
  positions: [string, XY][];
}

// Inside a dedicated worker `self` is a DedicatedWorkerGlobalScope, which isn't
// part of the app's DOM lib set. `Worker` is the closest available type whose
// postMessage/addEventListener("message") signatures match what we use here.
const ctx = self as unknown as Worker;

ctx.addEventListener("message", (ev: MessageEvent<LayoutRequest>) => {
  const { id, nodes } = ev.data;
  const result: LayoutResult = { id, positions: [...layoutPositions(nodes)] };
  ctx.postMessage(result);
});
