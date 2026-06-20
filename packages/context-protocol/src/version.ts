/**
 * Universal Context Protocol (UCP) versioning.
 *
 * The version is a `major.minor` string. The contract:
 *   - **major** changes are breaking (fields removed/renamed, semantics changed).
 *   - **minor** changes are additive (new optional fields a reader may ignore).
 *
 * So a consumer can read any pack with the *same major* version: a v1.0 reader
 * tolerates a v1.3 pack (it ignores fields it doesn't know), and a v1.3 reader
 * tolerates a v1.0 pack (the new fields are simply absent). Cross-major is
 * refused rather than guessed.
 */

/** Current protocol version emitted by this package. */
export const CONTEXT_PROTOCOL_VERSION = "1.0";

export interface ProtocolVersion {
  major: number;
  minor: number;
}

/** Parse a `major.minor` string, or null if it is not well-formed. */
export function parseProtocolVersion(v: string): ProtocolVersion | null {
  const m = /^(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]) };
}

/**
 * Can a consumer at `consumer` (defaults to the current version) safely read a
 * pack produced at `produced`? True iff both parse and share a major version.
 */
export function isProtocolCompatible(produced: string, consumer: string = CONTEXT_PROTOCOL_VERSION): boolean {
  const p = parseProtocolVersion(produced);
  const c = parseProtocolVersion(consumer);
  if (!p || !c) return false;
  return p.major === c.major;
}
