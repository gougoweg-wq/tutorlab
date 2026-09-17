import type { NormalizeRules } from "./types";

const DEFAULT: NormalizeRules = { case: true, spaces: true, yo: true, punctuation: false };

/** Normalise a free-typed text answer before comparison. */
export function normalizeText(s: string, rules: Partial<NormalizeRules> = {}): string {
  const r = { ...DEFAULT, ...rules };
  let out = s.normalize("NFKC").replace(/[‐-―−]/g, "-").replace(/[«»„“”]/g, '"').replace(/[‘’]/g, "'");
  if (r.yo) out = out.replace(/ё/g, "е").replace(/Ё/g, "Е");
  if (r.case) out = out.toLowerCase();
  if (r.punctuation) out = out.replace(/[.,;:!?"'()]/g, "");
  if (r.spaces) out = out.replace(/\s+/g, " ").trim();
  return out;
}

/**
 * Parse what a student typed into numbers. Accepts: "3,5", "-2", "−2", "3/4", "1 1/2" (mixed), "x = 2", "2; 3",
 * "2 и 3", trailing units ("12 см"). Returns null when any part is not a number.
 */
export function parseNumbers(raw: string): number[] | null {
  let s = raw.normalize("NFKC").trim().toLowerCase().replace(/[‐-―−]/g, "-");
  if (!s) return null;
  s = s.replace(/\s+(и|and|va)\s+/g, ";");
  const parts = s.split(/;|\n/).map((p) => p.trim()).filter(Boolean);
  const out: number[] = [];
  for (let p of parts) {
    p = p.replace(/^[a-zа-яё]\s*\d?\s*=\s*/i, "");          // "x = ", "x1="
    p = p.replace(/\s*(%|°|[a-zа-яё°/²³.]+)\s*$/i, (m) => (/^\s*\/\s*\d/.test(m) ? m : "")); // strip trailing unit, keep "/3"
    p = p.replace(/(\d),(\d)/g, "$1.$2");
    const mixed = p.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    const frac = p.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
    let v: number;
    if (mixed) { const w = Number(mixed[1]); const f = Number(mixed[2]) / Number(mixed[3]); v = w < 0 || Object.is(w, -0) || mixed[1].startsWith("-") ? w - f : w + f; }
    else if (frac) v = Number(frac[1]) / Number(frac[2]);
    else if (/^-?\d+(?:\.\d+)?(?:e-?\d+)?$/.test(p.replace(/\s/g, ""))) v = Number(p.replace(/\s/g, ""));
    else return null;
    if (!Number.isFinite(v)) return null;
    out.push(v);
  }
  return out.length ? out : null;
}

/** Normalised stem used for dedupe and search: no LaTeX delimiters, punctuation, digits collapsed to '#'. */
export function contentHash(stemMd: string): string {
  return normalizeText(stemMd, { punctuation: true }).replace(/\$+/g, " ").replace(/\\[a-z]+/g, " ").replace(/[{}^_\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
}
