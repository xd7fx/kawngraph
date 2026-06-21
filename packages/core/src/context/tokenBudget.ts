import { KawnNode } from "@kawngraph/shared";

/**
 * Token accounting for the Context Pack. We never embed file contents — the pack
 * points at code — so token cost is *estimated* from what an agent would read if
 * it opened each node. The estimate is deliberately rough (chars / 4) and labeled
 * as such; it exists to keep a pack inside a budget, not to bill anyone.
 */

const CHARS_PER_TOKEN = 4;
const CHARS_PER_LINE = 64;
const DEFAULT_FILE_LINES = 40;
const MIN_TOKENS = 8;

/** Estimate the tokens an agent spends to read what `node` points at. */
export function estimateTokens(node: KawnNode): number {
  let chars: number;
  if (node.lineStart != null && node.lineEnd != null && node.lineEnd >= node.lineStart) {
    chars = (node.lineEnd - node.lineStart + 1) * CHARS_PER_LINE;
  } else if (node.type === "file") {
    chars = DEFAULT_FILE_LINES * CHARS_PER_LINE;
  } else {
    chars = node.label.length + node.sourcePath.length + CHARS_PER_LINE;
  }
  return Math.max(MIN_TOKENS, Math.ceil(chars / CHARS_PER_TOKEN));
}
