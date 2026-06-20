export * from "./types";
export * from "./paths";
export * from "./ids";
export * from "./logger";
export * from "./errors";

export const ATHAR_VERSION = "0.1.0";

/**
 * Schema version of `.athar/graph.json` + its freshness manifest. Bump when the
 * on-disk graph/manifest shape changes incompatibly so readers (MCP, Studio,
 * `athar status`) can report `incompatible` instead of fabricating context.
 */
export const GRAPH_SCHEMA_VERSION = 1;
