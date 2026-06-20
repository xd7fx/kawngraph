/**
 * Deterministic visual mapping for the graph: a stable color per layer and a
 * Lucide icon per node type. Kept as pure data so layout/rendering and tests
 * can share it without pulling in React.
 */
import {
  Box,
  Braces,
  Code2,
  Database,
  FileCode,
  FileQuestion,
  FileText,
  GitBranch,
  Hash,
  Image,
  Lock,
  Network,
  Package,
  Route,
  Table2,
  TestTube,
  type LucideIcon,
} from "lucide-react";
import type { Layer, NodeType } from "../types";

/** Column order for the deterministic layered layout (left → right). */
export const LAYER_ORDER: Layer[] = [
  "config",
  "code",
  "data",
  "test",
  "docs",
  "decision",
  "visual",
  "runtime",
];

/** Mid-tone hues chosen to stay legible on both light and dark backgrounds. */
export const LAYER_COLOR: Record<Layer, string> = {
  code: "#2563eb", // blue
  data: "#d97706", // amber
  docs: "#059669", // green
  config: "#64748b", // slate
  test: "#0d9488", // teal
  decision: "#7c3aed", // violet (used sparingly, only for decision nodes)
  visual: "#db2777", // pink
  runtime: "#dc2626", // red
};

const FALLBACK_COLOR = "#64748b";

export function layerColor(layer: Layer | string): string {
  return LAYER_COLOR[layer as Layer] ?? FALLBACK_COLOR;
}

export function layerOrderIndex(layer: Layer | string): number {
  const i = LAYER_ORDER.indexOf(layer as Layer);
  return i === -1 ? LAYER_ORDER.length : i;
}

const TYPE_ICON: Record<NodeType, LucideIcon> = {
  file: FileCode,
  symbol: Code2,
  function: Braces,
  class: Box,
  route: Route,
  table: Table2,
  migration: Database,
  doc: FileText,
  section: Hash,
  decision: GitBranch,
  image: Image,
  diagram: Network,
  package: Package,
  test: TestTube,
  env: Lock,
};

export function nodeIcon(type: NodeType | string): LucideIcon {
  return TYPE_ICON[type as NodeType] ?? FileQuestion;
}

/** Human label for a node type (e.g. "reads_table" → "reads table"). */
export function humanize(value: string): string {
  return value.replace(/_/g, " ");
}
