/**
 * Built-in scanner plugins. These wrap Athar's first-party scanners (TS/JS,
 * Python, SQL, Markdown, package.json) behind the versioned {@link ScannerPlugin}
 * contract so the registry can orchestrate them deterministically alongside any
 * third-party plugins a host explicitly registers. There is NO auto-loading: a
 * host calls {@link builtinScannerPlugins} and registers the result itself.
 */
import type { ScannerPlugin } from "@athar/scanner-sdk";
import { packagePlugin } from "./packagePlugin";
import { codePlugin } from "./codePlugin";
import { pythonPlugin } from "./pythonPlugin";
import { sqlPlugin } from "./sqlPlugin";
import { docsPlugin } from "./docsPlugin";

export { packagePlugin } from "./packagePlugin";
export { codePlugin } from "./codePlugin";
export { pythonPlugin } from "./pythonPlugin";
export { sqlPlugin } from "./sqlPlugin";
export { docsPlugin } from "./docsPlugin";

/**
 * Fresh instances of every built-in plugin, in their natural `order`
 * (package -> code -> python -> sql -> docs). Each call returns new objects;
 * plugins are stateless, so sharing would also be safe.
 */
export function builtinScannerPlugins(): ScannerPlugin[] {
  return [packagePlugin(), codePlugin(), pythonPlugin(), sqlPlugin(), docsPlugin()];
}
