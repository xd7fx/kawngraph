/**
 * Pure, framework-free internationalization core for the Studio.
 *
 * This module has NO React and NO DOM dependencies on purpose: it is compiled
 * by both the app build (DOM-typed) and the headless `node:test` harness
 * (Node-typed, no DOM lib), so the locale logic can be unit-tested without a
 * browser. The React context/provider/hook live in `i18nReact.tsx`.
 *
 * Design rules enforced here:
 *  - English is the source locale and the fallback for any missing string.
 *  - The Arabic table is typed as `Record<MessageKey, string>`, so a missing
 *    key is a COMPILE error — translation completeness is guaranteed by tsc,
 *    not just by tests.
 *  - User-facing UI text is translated; stable machine identifiers (CLI
 *    commands, JSON enum values like `ok`/`code`/`docs`) are NOT — they stay
 *    English everywhere by design.
 *  - Nothing here calls a network or a remote translation service.
 */

export type Locale = "en" | "ar";

export const LOCALES: readonly Locale[] = ["en", "ar"] as const;
export const DEFAULT_LOCALE: Locale = "en";

/** Native names for the locale switcher (each shown in its own script). */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar";
}

/** Coerce an untrusted persisted value into a known locale. */
export function asLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Writing direction for a locale. Drives `dir` on <html> and CSS logic. */
export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * English source strings. Keys are stable dotted identifiers (never shown to
 * users); values are the English copy. `satisfies` keeps the literal key union
 * for `MessageKey` while checking every value is a string.
 */
export const en = {
  // Brand (product name — intentionally not translated).
  "brand.name": "KawnGraph Universe",

  // Primary navigation (the five primary areas) + advanced overflow.
  "nav.views": "Views",
  "nav.map": "Map",
  "nav.ask": "Ask",
  "nav.impact": "Impact",
  "nav.changes": "Changes",
  "nav.bench": "Bench",
  "nav.advanced": "Advanced",
  "nav.graph": "Graph",
  "nav.universe": "Universe",
  "nav.context": "Context",
  "nav.flow": "Flow",
  "nav.docs": "Docs",
  "nav.data": "Data",
  "nav.settings": "Settings",

  // Toolbar.
  "toolbar.project": "Project",
  "toolbar.status": "Status",
  "toolbar.nodes": "Nodes",
  "toolbar.edges": "Edges",
  "toolbar.scanned": "Scanned",
  "toolbar.filters": "Filters",
  "toolbar.details": "Details",
  "toolbar.darkTheme": "Dark theme",
  "toolbar.lightTheme": "Light theme",
  "toolbar.language": "Language",

  // Relative time.
  "time.dash": "—",
  "time.justNow": "just now",
  "time.minutesAgo": "{n}m ago",
  "time.hoursAgo": "{n}h ago",
  "time.daysAgo": "{n}d ago",

  // App-level states (loading / unreachable / missing graph).
  "state.loadingGraph": "Loading graph…",
  "state.cantReachTitle": "Can't reach the Studio server",
  "state.unreachableFallback":
    "Could not reach the KawnGraph Universe server. Is it still running?",
  "state.retry": "Retry",
  "state.graphUnreadable": "Graph could not be read",
  "state.noGraph": "No graph found",
  "state.malformedBody": "The graph file exists but could not be parsed.",
  "state.noGraphBody":
    "KawnGraph Universe displays a graph that has already been generated. None was found at:",
  "state.generateHint": "Generate or refresh it from a terminal, then retry:",

  // Map view (2D graph ⇄ 3D universe toggle).
  "map.twoD": "2D",
  "map.threeD": "3D",
  "map.twoDLabel": "2D graph",
  "map.threeDLabel": "3D universe",
  "map.viewMode": "View mode",

  // Changes view (read-only git diff impact).
  "changes.workingTree": "Working tree",
  "changes.compareRef": "Compare ref",
  "changes.baseRef": "Base ref",
  "changes.headRef": "Head ref (optional)",
  "changes.baseRefPlaceholder": 'e.g. "main" or "HEAD~1"',
  "changes.headRefPlaceholder": "HEAD",
  "changes.analyze": "Analyze changes",
  "changes.scopeWorkingTree": "Uncommitted edits compared against HEAD.",
  "changes.scopeCompare": "Compare a branch or commit against the working tree's HEAD.",
  "changes.filesChanged": "{n} changed",
  "changes.inGraphCount": "{n} in graph",
  "changes.impactedCount": "{n} impacted",
  "changes.recheckCount": "{n} to re-check",
  "changes.truncated": "Impact truncated at the node cap — more dependents exist.",
  "changes.changedFiles": "Changed files",
  "changes.filesToRecheck": "Files to re-check",
  "changes.relatedDocs": "Related docs",
  "changes.relatedTables": "Related tables",
  "changes.relatedTests": "Related tests",
  "changes.risks": "Risks",
  "changes.inspectNode": "Inspect node",
  "changes.unmapped": "Not in the graph yet",
  "changes.unmappedHint":
    "These changed files have no node in the last scan. Rescan to include them:",
  "changes.emptyTitle": "No change analysis yet",
  "changes.emptyHint":
    "Analyze your working tree, or compare against a base ref, to see what the change affects.",
  "changes.cleanTitle": "No changes",
  "changes.cleanHint": "The working tree matches HEAD — there is nothing to analyze.",
  "changes.gitErrorTitle": "Changes unavailable",
  "changes.gitMissing": "git is not installed or not on the PATH.",
  "changes.notARepo": "This project is not inside a git repository, so changes can't be computed.",
  "changes.noHead": "This repository has no commits yet.",
  "changes.badRef": "Unknown ref — check the base/head you entered.",
  "changes.gitFailed": "git could not compute the diff.",
  "changes.status.added": "added",
  "changes.status.modified": "modified",
  "changes.status.deleted": "deleted",
  "changes.status.renamed": "renamed",
  "changes.status.copied": "copied",
  "changes.status.typechange": "type change",
  "changes.status.other": "changed",

  // Settings view.
  "settings.appearance": "Appearance",
  "settings.light": "Light",
  "settings.dark": "Dark",
  "settings.language": "Language",
  "settings.graphRendering": "Graph rendering",
  "settings.renderLimit": "Initial node render limit — {n}",
  "settings.renderLimitHint":
    'Large graphs render up to this many nodes before showing a "show more" guard, keeping the canvas responsive.',
  "settings.project": "Project",
  "settings.root": "Root",
  "settings.graphFile": "Graph file",
  "settings.version": "KawnGraph version",
  "settings.generated": "Generated",
  "settings.nodesEdges": "Nodes / edges",
  "settings.layers": "Layers",
  "settings.readOnly": "read-only",
  "settings.localOnly": "local only",
  "settings.neverWrites":
    "Studio never writes to your repository and never rebuilds the graph. To refresh it, run the command below in a terminal, then reload:",
  "settings.localPrefs": "Local preferences",
  "settings.localPrefsBody":
    "Only display preferences are stored in this browser: theme, language, panel sizes, graph filters, recent task strings ({recent}), and saved views ({views}). No graph contents, code, or repository data is ever persisted.",
  "settings.clearPrefs": "Clear local preferences",
  "settings.cleared": "Cleared",
} satisfies Record<string, string>;

/** The set of valid message keys, derived from the English source table. */
export type MessageKey = keyof typeof en;

/**
 * Arabic translations. Typed as `Record<MessageKey, string>` so that omitting
 * or misspelling any key fails the TypeScript build.
 */
export const ar: Record<MessageKey, string> = {
  "brand.name": "KawnGraph Universe",

  "nav.views": "العروض",
  "nav.map": "الخريطة",
  "nav.ask": "اسأل",
  "nav.impact": "الأثر",
  "nav.changes": "التغييرات",
  "nav.bench": "القياس",
  "nav.advanced": "متقدّم",
  "nav.graph": "الرسم",
  "nav.universe": "الكون",
  "nav.context": "السياق",
  "nav.flow": "المسار",
  "nav.docs": "التوثيق",
  "nav.data": "البيانات",
  "nav.settings": "الإعدادات",

  "toolbar.project": "المشروع",
  "toolbar.status": "الحالة",
  "toolbar.nodes": "العُقد",
  "toolbar.edges": "الحواف",
  "toolbar.scanned": "آخر فحص",
  "toolbar.filters": "المرشّحات",
  "toolbar.details": "التفاصيل",
  "toolbar.darkTheme": "الوضع الداكن",
  "toolbar.lightTheme": "الوضع الفاتح",
  "toolbar.language": "اللغة",

  "time.dash": "—",
  "time.justNow": "الآن",
  "time.minutesAgo": "قبل {n} دقيقة",
  "time.hoursAgo": "قبل {n} ساعة",
  "time.daysAgo": "قبل {n} يوم",

  "state.loadingGraph": "جارٍ تحميل الرسم…",
  "state.cantReachTitle": "تعذّر الوصول إلى خادم الاستوديو",
  "state.unreachableFallback": "تعذّر الوصول إلى خادم KawnGraph Universe. هل ما زال يعمل؟",
  "state.retry": "إعادة المحاولة",
  "state.graphUnreadable": "تعذّرت قراءة الرسم",
  "state.noGraph": "لا يوجد رسم",
  "state.malformedBody": "ملف الرسم موجود لكن تعذّر تحليله.",
  "state.noGraphBody":
    "يعرض KawnGraph Universe رسمًا تم توليده مسبقًا. لم يُعثر على أي رسم في:",
  "state.generateHint": "ولّده أو حدّثه من الطرفية ثم أعد المحاولة:",

  "map.twoD": "2D",
  "map.threeD": "3D",
  "map.twoDLabel": "رسم ثنائي الأبعاد",
  "map.threeDLabel": "كون ثلاثي الأبعاد",
  "map.viewMode": "نمط العرض",

  "changes.workingTree": "شجرة العمل",
  "changes.compareRef": "مقارنة بمرجع",
  "changes.baseRef": "المرجع الأساس",
  "changes.headRef": "مرجع الرأس (اختياري)",
  "changes.baseRefPlaceholder": 'مثل "main" أو "HEAD~1"',
  "changes.headRefPlaceholder": "HEAD",
  "changes.analyze": "تحليل التغييرات",
  "changes.scopeWorkingTree": "التعديلات غير المُودَعة مقارنةً بـ HEAD.",
  "changes.scopeCompare": "قارن فرعًا أو إيداعًا بـ HEAD في شجرة العمل.",
  "changes.filesChanged": "{n} مُتغيّر",
  "changes.inGraphCount": "{n} في الرسم",
  "changes.impactedCount": "{n} متأثّر",
  "changes.recheckCount": "{n} لإعادة الفحص",
  "changes.truncated": "اقتُطع الأثر عند حدّ العُقد — توجد تبعيات أخرى.",
  "changes.changedFiles": "الملفات المتغيّرة",
  "changes.filesToRecheck": "ملفات لإعادة فحصها",
  "changes.relatedDocs": "وثائق ذات صلة",
  "changes.relatedTables": "جداول ذات صلة",
  "changes.relatedTests": "اختبارات ذات صلة",
  "changes.risks": "المخاطر",
  "changes.inspectNode": "فحص العُقدة",
  "changes.unmapped": "ليست في الرسم بعد",
  "changes.unmappedHint":
    "هذه الملفات المتغيّرة لا تملك عُقدة في آخر فحص. أعد الفحص لتضمينها:",
  "changes.emptyTitle": "لا يوجد تحليل تغييرات بعد",
  "changes.emptyHint": "حلّل شجرة العمل، أو قارن بمرجع أساس، لرؤية ما يؤثّر فيه التغيير.",
  "changes.cleanTitle": "لا توجد تغييرات",
  "changes.cleanHint": "شجرة العمل مطابقة لـ HEAD — لا شيء لتحليله.",
  "changes.gitErrorTitle": "التغييرات غير متاحة",
  "changes.gitMissing": "git غير مُثبّت أو غير موجود في PATH.",
  "changes.notARepo": "هذا المشروع ليس داخل مستودع git، لذا تعذّر حساب التغييرات.",
  "changes.noHead": "لا يحتوي هذا المستودع على أي إيداعات بعد.",
  "changes.badRef": "مرجع غير معروف — تحقّق من الأساس/الرأس المُدخل.",
  "changes.gitFailed": "تعذّر على git حساب الفروق.",
  "changes.status.added": "مُضاف",
  "changes.status.modified": "مُعدّل",
  "changes.status.deleted": "محذوف",
  "changes.status.renamed": "مُعاد تسميته",
  "changes.status.copied": "منسوخ",
  "changes.status.typechange": "تغيّر النوع",
  "changes.status.other": "متغيّر",

  "settings.appearance": "المظهر",
  "settings.light": "فاتح",
  "settings.dark": "داكن",
  "settings.language": "اللغة",
  "settings.graphRendering": "عرض الرسم",
  "settings.renderLimit": "حدّ عرض العُقد المبدئي — {n}",
  "settings.renderLimitHint":
    'الرسوم الكبيرة تعرض هذا العدد من العُقد كحدٍّ أقصى قبل إظهار زرّ "عرض المزيد"، للحفاظ على استجابة اللوحة.',
  "settings.project": "المشروع",
  "settings.root": "الجذر",
  "settings.graphFile": "ملف الرسم",
  "settings.version": "إصدار KawnGraph",
  "settings.generated": "تاريخ التوليد",
  "settings.nodesEdges": "العُقد / الحواف",
  "settings.layers": "الطبقات",
  "settings.readOnly": "للقراءة فقط",
  "settings.localOnly": "محلي فقط",
  "settings.neverWrites":
    "لا يكتب الاستوديو في مستودعك أبدًا ولا يعيد بناء الرسم. لتحديثه، شغّل الأمر أدناه في الطرفية ثم أعد التحميل:",
  "settings.localPrefs": "التفضيلات المحلية",
  "settings.localPrefsBody":
    "تُخزَّن تفضيلات العرض فقط في هذا المتصفح: السمة واللغة وأحجام اللوحات ومرشّحات الرسم وسلاسل المهام الأخيرة ({recent}) والعروض المحفوظة ({views}). لا تُحفظ محتويات الرسم أو الشيفرة أو بيانات المستودع إطلاقًا.",
  "settings.clearPrefs": "مسح التفضيلات المحلية",
  "settings.cleared": "تم المسح",
};

/** All dictionaries, keyed by locale. */
export const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, ar };

export type TVars = Record<string, string | number>;

/** Replace `{name}` placeholders; unknown placeholders are left verbatim. */
export function interpolate(template: string, vars?: TVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Resolve a key for a locale, falling back to English, then to the raw key.
 * Never throws and never returns `undefined`, so the UI always renders text.
 */
export function translate(locale: Locale, key: MessageKey, vars?: TVars): string {
  const table = dictionaries[locale] ?? dictionaries.en;
  const value = table[key] ?? dictionaries.en[key] ?? key;
  return interpolate(value, vars);
}

export type TFn = (key: MessageKey, vars?: TVars) => string;

/** Bind a translator to a locale (what the React hook hands to components). */
export function makeT(locale: Locale): TFn {
  return (key, vars) => translate(locale, key, vars);
}

/**
 * Deterministic pseudo-localization for layout stress tests: accents Latin
 * letters and pads to ~140% length to surface truncation / overflow, WITHOUT
 * disturbing `{placeholders}` or non-Latin text. Test-only utility.
 */
const PSEUDO_MAP: Record<string, string> = {
  a: "á", e: "é", i: "í", o: "ó", u: "ú", n: "ñ", c: "ç", s: "š", y: "ý",
  A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú", N: "Ñ", C: "Ç", S: "Š", Y: "Ý",
};

export function pseudo(template: string): string {
  // Split out {placeholders} so they pass through untouched.
  const parts = template.split(/(\{\w+\})/g);
  const accented = parts
    .map((part) =>
      /^\{\w+\}$/.test(part)
        ? part
        : part.replace(/[A-Za-z]/g, (ch) => PSEUDO_MAP[ch] ?? ch),
    )
    .join("");
  // Pad with spacing dots to simulate the ~40% expansion typical of translation.
  const visibleLen = template.replace(/\{\w+\}/g, "").length;
  const padCount = Math.ceil(visibleLen * 0.4);
  return padCount > 0 ? `⟦${accented}${"·".repeat(padCount)}⟧` : accented;
}
