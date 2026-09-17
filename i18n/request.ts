import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, NAMESPACES, isLocale, type Locale } from "./config";

async function detect(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const al = (await headers()).get("accept-language") ?? "";
  const first = al.split(",")[0]?.slice(0, 2).toLowerCase();
  return isLocale(first) ? first : DEFAULT_LOCALE;
}

async function load(locale: Locale) {
  const entries = await Promise.all(NAMESPACES.map(async (ns) => {
    const mod = await import(`../messages/${locale}/${ns}.json`).catch(() => ({ default: {} }));
    return [ns, mod.default] as const;
  }));
  return Object.fromEntries(entries);
}

/** Deep-merge so a missing key in en/uz falls back to Russian instead of showing the key. */
function merge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object"
      ? merge(base[k] as Record<string, unknown>, v as Record<string, unknown>) : v;
  }
  return out;
}

export default getRequestConfig(async () => {
  const locale = await detect();
  const ru = await load("ru");
  const messages = locale === "ru" ? ru : merge(ru, await load(locale));
  return { locale, messages, timeZone: "Asia/Tashkent" };
});
