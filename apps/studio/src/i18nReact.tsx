/**
 * React binding for the pure i18n core (`i18n.ts`).
 *
 * Kept separate from `i18n.ts` so the locale logic stays headlessly testable:
 * this file is DOM/React-typed and is compiled only by the app build, never by
 * the Node test harness. Components call `useT()` for a locale-bound translator
 * and `useLocale()` for the active locale.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, makeT, type Locale, type TFn } from "./i18n";

interface I18nValue {
  locale: Locale;
  t: TFn;
}

// Default value falls back to English so any component rendered outside a
// provider still produces readable text instead of throwing.
const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  t: makeT(DEFAULT_LOCALE),
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}): ReactNode {
  const value = useMemo<I18nValue>(() => ({ locale, t: makeT(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** A translator bound to the active locale. */
export function useT(): TFn {
  return useContext(I18nContext).t;
}

/** The active locale (for `dir`-aware rendering decisions in components). */
export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
