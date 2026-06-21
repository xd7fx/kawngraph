import { test } from "node:test";
import assert from "node:assert/strict";
import { celestialBody, bodySize, BODY_SIZE, type CelestialBody } from "./celestial";
import type { NodeType } from "./types";

// Every NodeType in the data model. Listing them here makes this suite fail
// loudly if a new node kind is added without deciding how it should look in the
// Universe (the exhaustiveness test below walks this list).
const ALL_TYPES: NodeType[] = [
  "file",
  "symbol",
  "function",
  "class",
  "route",
  "table",
  "migration",
  "doc",
  "section",
  "decision",
  "image",
  "diagram",
  "package",
  "test",
  "env",
];

test("the spec's named bodies map exactly", () => {
  // From the Universe spec: package = solar system, file = planet, symbol = moon,
  // table = ringed planet, test = shield satellite.
  assert.equal(celestialBody("package"), "solar-system");
  assert.equal(celestialBody("file"), "planet");
  assert.equal(celestialBody("symbol"), "moon");
  assert.equal(celestialBody("table"), "ringed-planet");
  assert.equal(celestialBody("test"), "shield-satellite");
});

test("code symbols all read as moons", () => {
  for (const t of ["symbol", "function", "class", "route"] as NodeType[]) {
    assert.equal(celestialBody(t), "moon", `${t} should be a moon`);
  }
});

test("data kinds read as ringed planets", () => {
  for (const t of ["table", "migration"] as NodeType[]) {
    assert.equal(celestialBody(t), "ringed-planet", `${t} should be a ringed planet`);
  }
});

test("reference-like kinds read as stars", () => {
  for (const t of ["doc", "section", "decision", "image", "diagram", "env"] as NodeType[]) {
    assert.equal(celestialBody(t), "star", `${t} should be a star`);
  }
});

test("every node type maps to a known body with a positive, finite size", () => {
  for (const t of ALL_TYPES) {
    const body = celestialBody(t);
    assert.ok(body in BODY_SIZE, `${t} → ${body} must have a size in BODY_SIZE`);
    const size = bodySize(t);
    assert.ok(Number.isFinite(size) && size > 0, `${t} size must be positive & finite, got ${size}`);
  }
});

test("unknown / future types fall back to a star at neutral size (never vanish)", () => {
  assert.equal(celestialBody("totally-new-kind"), "star");
  assert.equal(bodySize("totally-new-kind"), 1.0);
});

test("size hierarchy is strictly descending and 1.0 is the neutral baseline", () => {
  const order: CelestialBody[] = [
    "solar-system",
    "ringed-planet",
    "planet",
    "shield-satellite",
    "star",
    "moon",
  ];
  const sizes = order.map((b) => BODY_SIZE[b]);
  for (let i = 1; i < sizes.length; i++) {
    assert.ok(
      sizes[i] < sizes[i - 1],
      `${order[i]} (${sizes[i]}) must be smaller than ${order[i - 1]} (${sizes[i - 1]})`,
    );
  }
  // A plain "star" is the no-op multiplier: an all-star graph renders unchanged.
  assert.equal(BODY_SIZE.star, 1.0);
});

test("bodySize is pure: same input → same output, and tracks BODY_SIZE", () => {
  assert.equal(bodySize("file"), bodySize("file"));
  assert.equal(bodySize("file"), BODY_SIZE.planet);
  assert.equal(bodySize("package"), BODY_SIZE["solar-system"]);
});
