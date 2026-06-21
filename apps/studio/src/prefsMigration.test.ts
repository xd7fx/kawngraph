import { test } from "node:test";
import assert from "node:assert/strict";
import { readMigratedPref, type PrefStore } from "./prefsMigration";

// The real keys the Studio uses, so the test doubles as documentation of the
// exact rebrand migration (athar.* → kawn.*).
const CURRENT = "kawn.studio.prefs.v1";
const LEGACY = "athar.studio.prefs.v1";

/** An in-memory Storage stand-in that counts writes and can simulate failure. */
class FakeStore implements PrefStore {
  private readonly map = new Map<string, string>();
  failSet = false;
  setCalls = 0;
  removeCalls = 0;

  constructor(seed: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(seed)) this.map.set(k, v);
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.setCalls++;
    if (this.failSet) throw new Error("QuotaExceededError");
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.removeCalls++;
    this.map.delete(key);
  }
}

test("current key present → used verbatim, legacy untouched, no writes", () => {
  const store = new FakeStore({ [CURRENT]: '{"theme":"dark"}', [LEGACY]: '{"theme":"light"}' });
  assert.equal(readMigratedPref(store, CURRENT, LEGACY), '{"theme":"dark"}');
  assert.equal(store.setCalls, 0, "must not write when the current key already exists");
  assert.equal(store.removeCalls, 0);
  assert.equal(store.getItem(LEGACY), '{"theme":"light"}', "legacy value left intact");
});

test("only legacy present → migrated forward once and the stale key dropped", () => {
  const store = new FakeStore({ [LEGACY]: '{"theme":"dark"}' });
  assert.equal(readMigratedPref(store, CURRENT, LEGACY), '{"theme":"dark"}');
  assert.equal(store.getItem(CURRENT), '{"theme":"dark"}', "copied forward to the new key");
  assert.equal(store.getItem(LEGACY), null, "stale key removed");
  assert.equal(store.setCalls, 1);
  assert.equal(store.removeCalls, 1);

  // Idempotent: a second read now resolves from the current key, no more writes.
  assert.equal(readMigratedPref(store, CURRENT, LEGACY), '{"theme":"dark"}');
  assert.equal(store.setCalls, 1, "migration happens exactly once");
  assert.equal(store.removeCalls, 1);
});

test("neither key present → null, no writes", () => {
  const store = new FakeStore();
  assert.equal(readMigratedPref(store, CURRENT, LEGACY), null);
  assert.equal(store.setCalls, 0);
  assert.equal(store.removeCalls, 0);
});

test("legacy present but storage write fails → still returns legacy this session", () => {
  const store = new FakeStore({ [LEGACY]: '{"theme":"dark"}' });
  store.failSet = true;
  assert.equal(
    readMigratedPref(store, CURRENT, LEGACY),
    '{"theme":"dark"}',
    "best-effort: the value is still used even if it can't be persisted",
  );
  // setItem threw before removeItem, so the legacy key must survive (no data loss).
  assert.equal(store.getItem(LEGACY), '{"theme":"dark"}');
});

test("empty-string current value falls through to legacy (truthy semantics)", () => {
  const store = new FakeStore({ [CURRENT]: "", [LEGACY]: '{"theme":"dark"}' });
  assert.equal(readMigratedPref(store, CURRENT, LEGACY), '{"theme":"dark"}');
});

test("a throwing store collapses to null instead of crashing startup", () => {
  const hostile: PrefStore = {
    getItem() {
      throw new Error("SecurityError: storage is blocked");
    },
    setItem() {},
    removeItem() {},
  };
  assert.equal(readMigratedPref(hostile, CURRENT, LEGACY), null);
});
