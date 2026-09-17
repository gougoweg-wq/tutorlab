import { TOPICS, G, withSeed } from "./legacy";
import { SAT, buildSat } from "./sat";
import { questionDraftSchema, type QuestionDraft, type QuestionType } from "@/modules/questions/types";

export type GeneratorMeta = { id: string; topicCode: string; title: { ru: string; en?: string }; grade: number | null; types: QuestionType[]; difficulties: number[]; language: "ru" | "en"; isSat: boolean; wordProblem: boolean };

export const topicCodeOf = (id: string) => { const [g, n] = id.split("."); return `MATH.${g}.T${n}`; };
const METAS: GeneratorMeta[] = TOPICS.map((t) => ({ id: `math-${t.id}`, topicCode: topicCodeOf(t.id), title: { ru: t.n }, grade: t.g, types: ["numeric"], difficulties: [2, 3, 4], language: "ru", isSat: false, wordProblem: Boolean(t.w) }));

METAS.push(...Object.entries(SAT).map(([id, g]): GeneratorMeta => ({ id, topicCode: g.topic, title: { ru: g.title, en: g.title }, grade: null, types: ["numeric"], difficulties: [2, 3, 4], language: "en", isSat: true, wordProblem: false })));

/** Multiple-choice twins: same computed answer, three distractors modelled on typical slips (sign, off-by-one, doubled/halved). */
METAS.push(...METAS.filter((m) => m.isSat || !m.wordProblem).map((m): GeneratorMeta => ({ ...m, id: `${m.id}-mc`, types: ["single_choice"] })));

const fmtNum = (v: number, lang: "ru" | "en") => { const r = Math.round(v * 1000) / 1000; const t = Number.isInteger(r) ? String(r) : String(r); return lang === "ru" ? t.replace(".", ",").replace("-", "−") : t.replace("-", "−"); };
function distractors(v: number, seed: number): number[] {
  const step = Number.isInteger(v) ? 1 : 0.1; const big = Math.abs(v) >= 20 ? 10 : 2;
  const pool = [-v, v + step, v - step, v * 2, v / 2, v + big, v - big, v + 2 * step, v - 2 * step, v * 10, v + 5 * step].map((x) => Math.round(x * 1000) / 1000).filter((x, i, a) => x !== v && a.indexOf(x) === i && Number.isFinite(x));
  const out: number[] = []; let k = seed;
  while (out.length < 3 && pool.length) { k = (k * 1103515245 + 12345) & 0x7fffffff; out.push(pool.splice(k % pool.length, 1)[0]); }
  return out;
}

export const listGenerators = () => METAS;
export const getGenerator = (id: string) => METAS.find((m) => m.id === id);

/** Deterministic: same (id, seed) → same question. Answers are computed, never invented. */
export function generateOne(id: string, opts: { seed: number; difficulty?: number }): QuestionDraft {
  const meta = getGenerator(id);
  if (!meta) throw new Error(`unknown generator ${id}`);
  const mc = id.endsWith("-mc"); const baseId = mc ? id.slice(0, -3) : id;
  const make = (seed: number) => (meta.isSat ? buildSat(baseId, seed) : withSeed(seed, () => G[baseId.replace("math-", "")]()));
  let q = make(opts.seed);
  if (mc) {
    for (let i = 1; q.ans.length !== 1 && i < 40; i++) q = make(opts.seed + i * 104729);
    if (q.ans.length === 1) {
      const v = q.ans[0]; const all = [v, ...distractors(v, opts.seed)];
      const order = all.map((x, i) => ({ x, k: ((opts.seed + 1) * (i + 3) * 2654435761) % 1000 })).sort((a, b) => a.k - b.k).map((o) => o.x);
      const ids = ["a", "b", "c", "d"];
      return questionDraftSchema.parse({
        type: "single_choice", stemMd: q.text.replace(/<br>/g, "\n\n").replace(/\s*\(Enter a fraction or a decimal\.\)/, ""), explanationMd: q.hint,
        options: { kind: "choices", choices: order.map((x, i) => ({ id: ids[i], text: fmtNum(x, meta.language) })) },
        answer: { type: "single_choice", correct: ids[order.indexOf(v)] },
        difficulty: opts.difficulty ?? 3, grade: meta.grade ?? undefined, language: meta.language, topicCodes: [meta.topicCode], tags: ["варианты"],
      });
    }
  }
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
