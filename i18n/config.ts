export const LOCALES = ["ru", "en", "uz"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "locale";
export const LOCALE_NAMES: Record<Locale, string> = { ru: "Русский", en: "English", uz: "Oʻzbekcha" };

/** One JSON file per namespace per locale: messages/<locale>/<namespace>.json */
export const NAMESPACES = [
  "common", "nav", "errors", "auth", "onboarding", "landing",
  "students", "catalog", "questions", "generator", "assessments", "attempt",
  "progress", "dashboard", "lessons", "notifications", "settings", "parent",
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
