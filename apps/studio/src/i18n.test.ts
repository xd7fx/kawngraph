import { test } from "node:test";
import assert from "node:assert/strict";
import {
  en,
  ar,
  dictionaries,
  LOCALES,
  makeT,
  translate,
  interpolate,
  dirFor,
  asLocale,
  isLocale,
  pseudo,
  type Locale,
  type MessageKey,
} from "./i18n";

const keys = Object.keys(en) as MessageKey[];

test("every locale has exactly the English key set (no missing, no extra)", () => {
  const expected = keys.slice().sort();
  for (const loc of LOCALES) {
    const got = Object.keys(dictionaries[loc]).sort();
    assert.deepEqual(got, expected, `${loc} key set must match en exactly`);
  }
});

test("no translation is empty or whitespace-only", () => {
  for (const loc of LOCALES) {
    for (const k of keys) {
      assert.ok(
        dictionaries[loc][k].trim().length > 0,
        `${loc}.${String(k)} must not be blank`,
      );
    }
  }
});

test("interpolation placeholders are preserved across every locale", () => {
  const placeholders = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).slice().sort();
  for (const k of keys) {
    assert.deepEqual(
      placeholders(ar[k]),
      placeholders(en[k]),
      `${String(k)}: ar must keep the same {placeholders} as en`,
    );
  }
});

test("dirFor maps ar→rtl and en→ltr", () => {
  assert.equal(dirFor("ar"), "rtl");
  assert.equal(dirFor("en"), "ltr");
});

test("asLocale / isLocale coerce untrusted persisted values", () => {
  assert.equal(isLocale("ar"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(undefined), false);
  assert.equal(asLocale("ar"), "ar");
  assert.equal(asLocale("nonsense"), "en");
  assert.equal(asLocale(undefined), "en");
});

test("interpolate fills known vars and leaves unknown braces intact", () => {
  assert.equal(interpolate("count {n}", { n: 5 }), "count 5");
  assert.equal(interpolate("hi {who}", {}), "hi {who}");
  assert.equal(interpolate("no vars"), "no vars");
});

test("translate falls back to English, then to the raw key", () => {
  assert.equal(translate("ar", "nav.map"), ar["nav.map"]);
  // An unknown locale resolves through the English table.
  assert.equal(translate("xx" as unknown as Locale, "nav.map"), en["nav.map"]);
});

test("makeT binds a locale and interpolates variables", () => {
  const t = makeT("ar");
  assert.equal(t("time.minutesAgo", { n: 3 }), ar["time.minutesAgo"].replace("{n}", "3"));
});

test("pseudo-localization expands length and preserves placeholders", () => {
  for (const k of keys) {
    const src = en[k];
    const out = pseudo(src);
    for (const p of src.match(/\{\w+\}/g) ?? []) {
      assert.ok(out.includes(p), `pseudo must keep ${p} in ${String(k)}`);
    }
    assert.ok(out.length >= src.length, `pseudo of ${String(k)} should not shrink`);
  }
});

test("the brand identifier stays English in both locales", () => {
  assert.equal(en["brand.name"], "KawnGraph Universe");
  assert.equal(ar["brand.name"], "KawnGraph Universe");
});
