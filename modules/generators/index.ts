import type { QuestionDraft } from "@/modules/questions/types";
import { contentHash } from "@/modules/questions/normalize";
import type { Generated, Generator, GeneratorMeta } from "./define";
import { generators as math6 } from "./packs/math6";
import { generators as math7 } from "./packs/math7";
import { generators as math8 } from "./packs/math8";
import { generators as math9 } from "./packs/math9";
import { generators as math10 } from "./packs/math10";
import { generators as math11 } from "./packs/math11";
import { generators as geometry } from "./packs/geometry";
import { generators as wordProblems } from "./packs/word-problems";
import { generators as satMath } from "./packs/sat-math";
import { generators as satRw } from "./packs/sat-rw";
import { generators as physics } from "./packs/physics";
import { generators as chemistry } from "./packs/chemistry";
import { generators as english } from "./packs/english";
import { generators as russian } from "./packs/russian";

export type { GeneratorMeta } from "./define";

/** Pack name → generators, in catalogue order. */
export const PACKS: Record<string, Generator[]> = { math6, math7, math8, math9, math10, math11, geometry, wordProblems, satMath, satRw, physics, chemistry, english, russian };

const ALL: Generator[] = Object.values(PACKS).flat();
const BY_ID = new Map<string, Generator>();
for (const g of ALL) {
  if (BY_ID.has(g.meta.id)) throw new Error(`duplicate generator id: ${g.meta.id}`);
  BY_ID.set(g.meta.id, g);
}

export function listGenerators(): GeneratorMeta[] { return ALL.map((g) => g.meta); }
export function getGenerator(id: string): GeneratorMeta | undefined { return BY_ID.get(id)?.meta; }

function must(id: string): Generator {
  const g = BY_ID.get(id);
  if (!g) throw new Error(`unknown generator: ${id}`);
  return g;
}

/** Deterministic: the same (id, seed, difficulty) always yields the same question. The answer is computed by code. */
export function generateOne(id: string, opts: { seed: number; difficulty?: number }): QuestionDraft {
  return must(id).generate(opts.seed, opts.difficulty).draft;
}

/** Same as `generateOne` but also returns the generator's independent self-check (tests, seed validation). */
export function generateWithCheck(id: string, opts: { seed: number; difficulty?: number }): Generated {
  return must(id).generate(opts.seed, opts.difficulty);
}

/** Generators attached to a topic or anywhere in its subtree (by code prefix). */
export function generatorsForTopic(topicCode: string): GeneratorMeta[] {
  return ALL.filter((g) => g.meta.topicCode === topicCode || g.meta.topicCode.startsWith(`${topicCode}.`)).map((g) => g.meta);
}

/**
 * Up to `n` questions for a topic and its subtree: round-robins across the matching generators and the allowed
 * difficulties, never repeats a stem within one call. Returns fewer than `n` only when the generators run out of variety.
 */
export function generateForTopic(topicCode: string, n: number, opts: { seed: number; difficultyMin?: number; difficultyMax?: number }): QuestionDraft[] {
  const min = opts.difficultyMin ?? 1, max = opts.difficultyMax ?? 5;
  const pool = generatorsForTopic(topicCode)
    .map((m) => ({ gen: must(m.id), levels: m.difficulties.filter((d) => d >= min && d <= max) }))
    .filter((p) => p.levels.length > 0);
  if (!pool.length || n <= 0) return [];
  const out: QuestionDraft[] = []; const seen = new Set<string>();
  const maxTries = n * 12 + pool.length * 8;
  for (let i = 0; out.length < n && i < maxTries; i++) {
    const p = pool[i % pool.length]; const round = Math.floor(i / pool.length);
    const difficulty = p.levels[round % p.levels.length];
    const draft = p.gen.generate(opts.seed * 7919 + i, difficulty).draft;
    const key = contentHash(draft.stemMd);
    if (seen.has(key)) continue;
    seen.add(key); out.push(draft);
  }
  return out;
}
