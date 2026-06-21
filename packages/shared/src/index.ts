export * from "./types";
export * from "./paths";
export * from "./ids";
export * from "./logger";
export * from "./errors";

export const KAWN_VERSION = "0.1.0";

/**
 * Schema version of `.kawn/graph.json` + its freshness manifest. Bump when the
 * on-disk graph/manifest shape changes incompatibly so readers (MCP, Studio,
 * `kawn status`) can report `incompatible` instead of fabricating context.
 */
export const GRAPH_SCHEMA_VERSION = 1;
