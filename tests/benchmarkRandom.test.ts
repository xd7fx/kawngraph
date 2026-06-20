import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng, Rng, conditionOrder } from "@athar/benchmark";

function seq(fn: () => number, n: number): number[] {
  return Array.from({ length: n }, fn);
}

function schedule(seed: number, n: number): string[] {
  const rng = new Rng(seed);
  return Array.from({ length: n }, () => conditionOrder(rng).join("|"));
}

test("makeRng is deterministic for a given seed and varies across seeds", () => {
  assert.deepEqual(seq(makeRng(123), 8), seq(makeRng(123), 8), "same seed → identical stream");
  assert.notDeepEqual(seq(makeRng(1), 8), seq(makeRng(2), 8), "different seeds → different stream");
});

test("Rng.float stays within [0, 1)", () => {
  const rng = new Rng(5);
  for (let i = 0; i < 1000; i++) {
    const v = rng.float();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test("Rng reproduces makeRng's stream (same underlying PRNG)", () => {
  const a = seq(makeRng(77), 6);
  const r = new Rng(77);
  const b = seq(() => r.float(), 6);
  assert.deepEqual(a, b);
});

test("conditionOrder yields a valid 2-permutation of with/without", () => {
  const rng = new Rng(3);
  for (let i = 0; i < 50; i++) {
    const order = conditionOrder(rng);
    assert.equal(order.length, 2);
    assert.deepEqual([...order].sort(), ["with", "without"], "both arms present, no duplicates");
  }
});

test("the randomized A/B schedule is reproducible from a seed", () => {
  assert.deepEqual(schedule(42, 20), schedule(42, 20), "same seed → identical schedule");
});

test("different seeds produce different schedules", () => {
  assert.notDeepEqual(schedule(1, 50), schedule(2, 50));
});

test("conditionOrder is not stuck — both orderings occur over many draws", () => {
  const rng = new Rng(2024);
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) seen.add(conditionOrder(rng).join("|"));
  assert.equal(seen.size, 2, "both 'with|without' and 'without|with' appear");
});

test("shuffle is a deterministic, non-mutating permutation", () => {
  const input = [1, 2, 3, 4, 5, 6];
  const a = new Rng(9).shuffle(input);
  const b = new Rng(9).shuffle(input);
  assert.deepEqual(a, b, "same seed → same shuffle");
  assert.deepEqual([...a].sort((x, y) => x - y), input, "permutation preserves the multiset");
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6], "input array is not mutated");
});
