/** Number and LaTeX formatting helpers shared by every generator pack. Everything returned here is meant to sit inside `$…$`. */
export type Lang = "ru" | "en";

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
  while (b) { [a, b] = [b, a % b]; }
  return a;
}
export const lcm = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcd(a, b));

/** Round to `digits` decimals without binary noise (0.1 + 0.2 → 0.3). */
export function round(n: number, digits = 6): number {
  const f = 10 ** digits;
  const r = Math.round((n + Math.sign(n) * Number.EPSILON * Math.abs(n)) * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

/** True when two floats are equal up to rounding noise — used by `check()` functions. */
export const approx = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

function plainDigits(n: number): { neg: boolean; int: string; frac: string } {
  const r = round(n, 6);
  if (!Number.isFinite(r)) throw new Error(`fmt: not a finite number: ${n}`);
  const s = Math.abs(r).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  const [int, frac = ""] = s.split(".");
  return { neg: r < 0, int, frac };
}

/** LaTeX number: decimal comma for ru (`3{,}5`), point for en; thousands grouped from 10 000 up. */
export function num(n: number, lang: Lang = "ru"): string {
  const { neg, int, frac } = plainDigits(n);
  let body = int;
  if (int.length > 4) body = int.replace(/\B(?=(\d{3})+(?!\d))/g, lang === "ru" ? "\\," : "{,}");
  if (frac) body += (lang === "ru" ? "{,}" : ".") + frac;
  return (neg ? "-" : "") + body;
}

/** Plain-text number (outside math, or as an accepted cloze answer): `3,5` for ru, `3.5` for en. */
export function numText(n: number, lang: Lang = "ru"): string {
  const { neg, int, frac } = plainDigits(n);
  return (neg ? "-" : "") + int + (frac ? (lang === "ru" ? "," : ".") + frac : "");
}

/** Negative numbers in parentheses: `(-3)`, positives as is. */
export const paren = (n: number, lang: Lang = "ru"): string => (n < 0 ? `(${num(n, lang)})` : num(n, lang));

/** `+ 3` / `- 3` for appending a number to an expression. */
export const signed = (n: number, lang: Lang = "ru"): string => (n < 0 ? `- ${num(-n, lang)}` : `+ ${num(n, lang)}`);

// ── exact rational arithmetic ────────────────────────────────────────────────

export type Frac = { n: number; d: number };
export function F(n: number, d = 1): Frac {
  if (d === 0) throw new Error("fmt.F: zero denominator");
  if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error(`fmt.F: integers expected, got ${n}/${d}`);
  const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g, d: (s * d) / g };
}
export const fadd = (a: Frac, b: Frac): Frac => F(a.n * b.d + b.n * a.d, a.d * b.d);
export const fsub = (a: Frac, b: Frac): Frac => F(a.n * b.d - b.n * a.d, a.d * b.d);
export const fmul = (a: Frac, b: Frac): Frac => F(a.n * b.n, a.d * b.d);
export const fdiv = (a: Frac, b: Frac): Frac => F(a.n * b.d, a.d * b.n);
export const fval = (a: Frac): number => a.n / a.d;
export const fcmp = (a: Frac, b: Frac): number => a.n * b.d - b.n * a.d;

/** Reduced fraction in LaTeX: `\frac{3}{4}`, `-\frac{1}{2}`, `5` when the denominator is 1. */
export function frac(n: number, d = 1): string { return ftex(F(n, d)); }
export function ftex(f: Frac): string {
  if (f.d === 1) return String(f.n);
  return `${f.n < 0 ? "-" : ""}\\frac{${Math.abs(f.n)}}{${f.d}}`;
}
/** Fraction exactly as given (NOT reduced) — for stems where the student is asked to reduce or compare. */
export const rawFrac = (n: number, d: number): string => `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
/** Mixed number: `2\frac{1}{3}`; proper fractions and integers fall back to `ftex`. */
export function mixed(f: Frac): string {
  const a = Math.abs(f.n);
  if (f.d === 1 || a < f.d) return ftex(f);
  const whole = Math.floor(a / f.d), rest = a % f.d;
  return `${f.n < 0 ? "-" : ""}${whole}\\frac{${rest}}{${f.d}}`;
}
/** Fraction in parentheses when negative. */
export const fparen = (f: Frac): string => (f.n < 0 ? `\\left(${ftex(f)}\\right)` : ftex(f));

// ── algebraic expressions ────────────────────────────────────────────────────

export type Term = { coef: number; body?: string };
/** Joins terms with correct signs: [{3,"x^2"},{-1,"x"},{0,"y"},{-4}] → `3x^2 - x - 4`. Zero terms vanish; empty sum is `0`. */
export function sumTerms(terms: Term[], lang: Lang = "ru"): string {
  let out = "";
  for (const t of terms) {
    if (t.coef === 0) continue;
    const abs = Math.abs(t.coef);
    const body = t.body ? (abs === 1 ? t.body : num(abs, lang) + t.body) : num(abs, lang);
    if (!out) out = (t.coef < 0 ? "-" : "") + body;
    else out += (t.coef < 0 ? " - " : " + ") + body;
  }
  return out || "0";
}
/** Polynomial from coefficients, highest degree first: poly([1,-5,6]) → `x^2 - 5x + 6`. */
export function poly(coefs: number[], v = "x", lang: Lang = "ru"): string {
  const deg = coefs.length - 1;
  return sumTerms(coefs.map((c, i) => { const p = deg - i; return { coef: c, body: p === 0 ? undefined : p === 1 ? v : `${v}^{${p}}` }; }), lang);
}
/** `ax + b` */
export const lin = (a: number, b: number, v = "x", lang: Lang = "ru"): string => poly([a, b], v, lang);
/** Value of a polynomial (highest degree first) at x — Horner. */
export const polyAt = (coefs: number[], x: number): number => coefs.reduce((acc, c) => acc * x + c, 0);

/** √n = out·√in with the largest square factor taken out. */
export function simplifySqrt(n: number): { out: number; in: number } {
  let out = 1, inside = n;
  for (let k = Math.floor(Math.sqrt(n)); k >= 2; k--) if (inside % (k * k) === 0) { out *= k; inside /= k * k; }
  return { out, in: inside };
}
/** LaTeX for k·√n fully simplified: sqrtTex(12) → `2\sqrt{3}`, sqrtTex(16) → `4`. */
export function sqrtTex(n: number, k = 1): string {
  const s = simplifySqrt(n); const c = k * s.out;
  if (s.in === 1) return String(c);
  return `${c === 1 ? "" : c === -1 ? "-" : c}\\sqrt{${s.in}}`;
}

export const deg = (n: number, lang: Lang = "ru"): string => `${num(n, lang)}^\\circ`;

// ── words ────────────────────────────────────────────────────────────────────

/** Russian plural: plural(5, "яблоко", "яблока", "яблок") → "яблок". */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(Math.trunc(n)) % 100, b = a % 10;
  if (!Number.isInteger(n)) return few;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
/** English plural: `1 book`, `3 books` (pass the irregular plural when needed). */
export const pluralEn = (n: number, one: string, many = `${one}s`): string => (n === 1 ? one : many);

export const isPrime = (n: number): boolean => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
export const factorial = (n: number): number => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
export const comb = (n: number, k: number): number => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };
