/** Seeded PRNG (mulberry32) with the helpers generators need. Same seed → same sequence, on every platform. */
export type Rng = {
  /** float in [0, 1) */
  next(): number;
  /** integer in [min, max], both inclusive */
  int(min: number, max: number): number;
  /** integer in [min, max] that is not zero */
  nonzero(min: number, max: number): number;
  /** integer in [min, max] that is not in `exclude` */
  intExcept(min: number, max: number, exclude: readonly number[]): number;
  pick<T>(items: readonly T[]): T;
  /** k distinct items, in random order */
  sample<T>(items: readonly T[], k: number): T[];
  shuffle<T>(items: readonly T[]): T[];
  sign(): 1 | -1;
  bool(p?: number): boolean;
};

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => {
    const lo = Math.ceil(Math.min(min, max)), hi = Math.floor(Math.max(min, max));
    return lo + Math.floor(next() * (hi - lo + 1));
  };
  const shuffle = <T>(items: readonly T[]) => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  };
  const intExcept = (min: number, max: number, exclude: readonly number[]) => {
    for (let i = 0; i < 200; i++) { const v = int(min, max); if (!exclude.includes(v)) return v; }
    for (let v = Math.ceil(min); v <= max; v++) if (!exclude.includes(v)) return v;
    throw new Error(`rng.intExcept: no value in [${min}, ${max}] outside the excluded set`);
  };
  return {
    next, int, shuffle, intExcept,
    nonzero: (min, max) => intExcept(min, max, [0]),
    pick: (items) => { if (!items.length) throw new Error("rng.pick: empty list"); return items[Math.floor(next() * items.length)]; },
    sample: (items, k) => { if (k > items.length) throw new Error("rng.sample: not enough items"); return shuffle(items).slice(0, k); },
    sign: () => (next() < 0.5 ? -1 : 1),
    bool: (p = 0.5) => next() < p,
  };
}

/** FNV-1a hash of a string → uint32; used to decorrelate generators that receive the same numeric seed. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
