/**
 * Pure, storage-injected migration of the pre-rebrand preferences key.
 *
 * The Studio persists harmless UI preferences under a versioned localStorage
 * key. When we rebranded Athar → KawnGraph the key changed, so a returning user
 * would silently lose their theme, panel sizes, filters, and saved views. This
 * module migrates the old blob forward exactly once: if only the legacy key
 * exists, copy it to the current key and drop the stale one.
 *
 * Everything is injected through {@link PrefStore} so the logic is unit-testable
 * headless (node:test) with a fake store — no DOM, no real localStorage. This is
 * the single source of truth for the migration; {@link usePrefs} delegates here.
 */

/** The slice of the Web Storage API we depend on (localStorage-compatible). */
export interface PrefStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Read the persisted blob, migrating the pre-rebrand key forward exactly once.
 *
 * Resolution order:
 *   1. If the current key holds a (non-empty) value, use it — no migration.
 *   2. Else if the legacy key holds a value, copy it to the current key, remove
 *      the legacy key, and return it. The copy/remove is best-effort: if writing
 *      throws (storage full or blocked), we still return the legacy value for
 *      this session rather than losing the user's preferences.
 *   3. Else return null.
 *
 * Never throws: any storage error collapses to `null` (preferences are
 * best-effort and must never break app startup).
 */
export function readMigratedPref(
  store: PrefStore,
  currentKey: string,
  legacyKey: string,
): string | null {
  try {
    const current = store.getItem(currentKey);
    if (current) return current;
    const legacy = store.getItem(legacyKey);
    if (!legacy) return null;
    try {
      store.setItem(currentKey, legacy);
      store.removeItem(legacyKey);
    } catch {
      /* best-effort migration; still use the legacy value this session */
    }
    return legacy;
  } catch {
    return null;
  }
}
