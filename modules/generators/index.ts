import { TOPICS, G, withSeed } from "./legacy";
import { SAT, buildSat } from "./sat";
import { questionDraftSchema, type QuestionDraft, type QuestionType } from "@/modules/questions/types";

export type GeneratorMeta = { id: string; topicCode: string; title: { ru: string; en?: string }; grade: number | null; types: QuestionType[]; difficulties: number[]; language: "ru" | "en"; isSat: boolean; wordProblem: boolean };

export const topicCodeOf = (id: string) => { const [g, n] = id.split("."); return `MATH.${g}.T${n}`; };
const METAS: GeneratorMeta[] = TOPICS.map((t) => ({ id: `math-${t.id}`, topicCode: topicCodeOf(t.id), title: { ru: t.n }, grade: t.g, types: ["numeric"], difficulties: [2, 3, 4], language: "ru", isSat: false, wordProblem: Boolean(t.w) }));

METAS.push(...Object.entries(SAT).map(([id, g]): GeneratorMeta => ({ id, topicCode: g.topic, title: { ru: g.title, en: g.title }, grade: null, types: ["numeric"], difficulties: [2, 3, 4], language: "en", isSat: true, wordProblem: false })));

export const listGenerators = () => METAS;
export const getGenerator = (id: string) => METAS.find((m) => m.id === id);

/** Deterministic: same (id, seed) → same question. Answers are computed, never invented. */
export function generateOne(id: string, opts: { seed: number; difficulty?: number }): QuestionDraft {
  const meta = getGenerator(id);
  if (!meta) throw new Error(`unknown generator ${id}`);
  const q = meta.isSat ? buildSat(id, opts.seed) : withSeed(opts.seed, () => G[id.replace("math-", "")]());
  const rounded = q.ans.some((v) => !Number.isInteger(v));
  return questionDraftSchema.parse({
    type: "numeric", stemMd: q.text.replace(/<br>/g, "\n\n"), explanationMd: q.hint,
    answer: { type: "numeric", values: q.ans, tolerance: rounded ? 0.001 : 1e-6, relTolerance: 0, ordered: Boolean(q.ordered) },
    difficulty: opts.difficulty ?? 3, grade: meta.grade ?? undefined, language: meta.language, topicCodes: [meta.topicCode], tags: meta.wordProblem ? ["текстовая"] : [],
  });
}

export function generateForTopic(topicCode: string, n: number, opts: { seed: number; difficultyMin?: number; difficultyMax?: number }): QuestionDraft[] {
  const gens = METAS.filter((m) => m.topicCode === topicCode || m.topicCode.startsWith(topicCode + "."));
  if (!gens.length) return [];
  const out: QuestionDraft[] = []; const seen = new Set<string>();
  const lo = opts.difficultyMin ?? 2, hi = opts.difficultyMax ?? 4;
  for (let i = 0; out.length < n && i < n * 8; i++) {
    const q = generateOne(gens[i % gens.length].id, { seed: opts.seed + i * 7919, difficulty: lo + (i % (hi - lo + 1)) });
    if (!seen.has(q.stemMd)) { seen.add(q.stemMd); out.push(q); }
  }
  return out;
}
