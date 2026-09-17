import { z } from "zod";
import { questionDraftSchema, answerSchema, type Option, type QuestionDraft, type QuestionOptions, type QuestionType } from "@/modules/questions/types";
import { hashString, makeRng, type Rng } from "./rng";
import { num, type Lang } from "./fmt";

export type GeneratorMeta = {
  id: string;
  topicCode: string;
  title: { ru: string; en?: string };
  grade: number | null;
  types: QuestionType[];
  difficulties: number[];
  language: "ru" | "en";
  isSat: boolean;
  wordProblem: boolean;
};

type AnswerInput = z.input<typeof answerSchema>;

/** What a generator's `build` returns; `defineGenerator` adds type, topic, grade, language, difficulty and tags. */
export type DraftBody = {
  stemMd: string;
  options?: QuestionOptions;
  answer: AnswerInput;
  explanationMd: string;
  tags?: string[];
  /** Recomputes the answer a second, independent way (substitution, brute force, looping) — asserted in tests. */
  check?: () => boolean;
};

export type GeneratorDef = {
  id: string;
  topicCode: string;
  title: { ru: string; en?: string };
  grade: number | null;
  types: QuestionType[];
  difficulties: number[];
  language?: "ru" | "en";
  isSat?: boolean;
  wordProblem?: boolean;
  tags?: string[];
  build(rng: Rng, difficulty: number): DraftBody;
};

export type Generated = { draft: QuestionDraft; check?: () => boolean };
export type Generator = { meta: GeneratorMeta; generate(seed: number, difficulty?: number): Generated };

const BAD_TEXT = /NaN|undefined|Infinity|\[object/;

export function defineGenerator(def: GeneratorDef): Generator {
  if (!def.difficulties.length || def.difficulties.some((d) => !Number.isInteger(d) || d < 1 || d > 5)) throw new Error(`generator ${def.id}: difficulties must be integers 1..5`);
  if (!def.types.length) throw new Error(`generator ${def.id}: declare at least one question type`);
  const difficulties = [...new Set(def.difficulties)].sort((a, b) => a - b);
  const meta: GeneratorMeta = {
    id: def.id, topicCode: def.topicCode, title: def.title, grade: def.grade, types: def.types, difficulties,
    language: def.language ?? "ru", isSat: def.isSat ?? false, wordProblem: def.wordProblem ?? false,
  };
  const idHash = hashString(def.id);

  function generate(seed: number, difficulty?: number): Generated {
    const base = (idHash ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
    let d: number;
    if (difficulty == null) d = makeRng(base ^ 0x5bd1e995).pick(difficulties);
    else d = difficulties.reduce((best, x) => (Math.abs(x - difficulty) < Math.abs(best - difficulty) ? x : best), difficulties[0]);
    const rng = makeRng((base + Math.imul(d, 0x85ebca6b)) >>> 0);
    const body = def.build(rng, d);
    if (!meta.types.includes(body.answer.type)) throw new Error(`generator ${def.id}: produced type ${body.answer.type} that is not declared in meta.types`);
    const tags = [...new Set(["generator", ...(def.tags ?? []), ...(meta.wordProblem ? ["word_problem"] : []), ...(meta.isSat ? ["sat"] : []), ...(body.tags ?? [])])];
    const draft = questionDraftSchema.parse({
      type: body.answer.type, stemMd: body.stemMd.trim(), options: body.options, answer: body.answer, explanationMd: body.explanationMd.trim(),
      difficulty: d, grade: meta.grade ?? undefined, language: meta.language, topicCodes: [meta.topicCode], tags,
    });
    if (BAD_TEXT.test(draft.stemMd) || BAD_TEXT.test(draft.explanationMd)) throw new Error(`generator ${def.id} (seed ${seed}): broken text: ${draft.stemMd}`);
    return { draft, check: body.check };
  }
  return { meta, generate };
}

// ── answer/option builders ───────────────────────────────────────────────────

const IDS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Numeric answer. Pass `tolerance` for rounded decimals and state the rounding in the stem. */
export function numeric(values: number | number[], opts: { tolerance?: number; relTolerance?: number; unit?: string; ordered?: boolean } = {}): AnswerInput {
  const list = (Array.isArray(values) ? values : [values]).map((v) => (Object.is(v, -0) ? 0 : v));
  if (list.some((v) => !Number.isFinite(v))) throw new Error(`numeric answer is not finite: ${list.join(", ")}`);
  return { type: "numeric", values: list, tolerance: opts.tolerance ?? 1e-6, relTolerance: opts.relTolerance ?? 0, unit: opts.unit, ordered: opts.ordered ?? false };
}

/**
 * Single choice with computed distractors. `distractors` are candidates in priority order (typical mistakes first);
 * duplicates and anything equal to the correct text are dropped, the first `count-1` survivors are used.
 * Throws when there are not enough distinct distractors — supply more candidates.
 */
export function singleChoice(rng: Rng, correct: string, distractors: string[], count = 4): { options: QuestionOptions; answer: AnswerInput } {
  const seen = new Set([correct.trim()]); const wrong: string[] = [];
  for (const d of distractors) { const t = d.trim(); if (!t || seen.has(t)) continue; seen.add(t); wrong.push(t); if (wrong.length === count - 1) break; }
  if (wrong.length < count - 1) throw new Error(`singleChoice: only ${wrong.length} distinct distractors for "${correct}"`);
  const texts = rng.shuffle([correct.trim(), ...wrong]);
  const choices: Option[] = texts.map((text, i) => ({ id: IDS[i], text }));
  return { options: { kind: "choices", choices }, answer: { type: "single_choice", correct: IDS[texts.indexOf(correct.trim())] } };
}

/**
 * Single choice over numbers: wrong values come from `mistakes` (typical errors), padded with near misses when some coincide.
 * `fmt` turns a number into option text (default: `$num$`).
 */
export function numericChoice(rng: Rng, correct: number, mistakes: number[], opts: { fmt?: (n: number) => string; lang?: Lang; integer?: boolean; positive?: boolean } = {}): { options: QuestionOptions; answer: AnswerInput } {
  const fmt = opts.fmt ?? ((n: number) => `$${num(n, opts.lang ?? "ru")}$`);
  const ok = (n: number) => Number.isFinite(n) && (!opts.positive || n > 0);
  const step = opts.integer ?? Number.isInteger(correct) ? 1 : Math.abs(correct) >= 10 ? 1 : 0.1;
  const pad: number[] = [];
  for (let k = 1; k <= 6; k++) { pad.push(correct + k * step, correct - k * step); }
  const padded = [...mistakes.filter(ok), ...rng.shuffle(pad.slice(0, 6)).filter(ok), ...pad.slice(6).filter(ok)];
  return singleChoice(rng, fmt(correct), padded.map(fmt));
}

/** Multiple choice: every item carries its own truth value. At least one must be correct and one incorrect. */
export function multipleChoice(rng: Rng, items: { text: string; correct: boolean }[], partial = true): { options: QuestionOptions; answer: AnswerInput } {
  const seen = new Set<string>(); const uniq = items.filter((i) => { const t = i.text.trim(); if (seen.has(t)) return false; seen.add(t); return true; });
  if (uniq.length < 3 || !uniq.some((i) => i.correct) || uniq.every((i) => i.correct)) throw new Error("multipleChoice: need ≥3 distinct items with at least one correct and one incorrect");
  const shuffled = rng.shuffle(uniq).slice(0, 8);
  if (!shuffled.some((i) => i.correct)) throw new Error("multipleChoice: correct items were cut off");
  const choices: Option[] = shuffled.map((it, i) => ({ id: IDS[i], text: it.text.trim() }));
  return { options: { kind: "choices", choices }, answer: { type: "multiple_choice", correct: choices.filter((_, i) => shuffled[i].correct).map((c) => c.id), partial } };
}

/** Ordering: pass the items in the CORRECT order; they are shown shuffled (never already sorted). */
export function ordering(rng: Rng, correctOrder: string[]): { options: QuestionOptions; answer: AnswerInput } {
  const texts = correctOrder.map((t) => t.trim());
  if (new Set(texts).size !== texts.length) throw new Error(`ordering: items must be distinct: ${texts.join(" | ")}`);
  let shown = rng.shuffle(texts);
  for (let i = 0; i < 5 && shown.every((t, k) => t === texts[k]); i++) shown = rng.shuffle(texts);
  if (shown.every((t, k) => t === texts[k])) shown = [...texts].reverse();
  const items: Option[] = shown.map((text, i) => ({ id: IDS[i], text }));
  return { options: { kind: "ordering", items }, answer: { type: "ordering", order: texts.map((t) => IDS[shown.indexOf(t)]) } };
}

/** Matching: pairs of [left, right]; right-hand texts must be distinct. Extra wrong right-hand options are allowed. */
export function matching(rng: Rng, pairs: [string, string][], extraRight: string[] = []): { options: QuestionOptions; answer: AnswerInput } {
  const lefts = pairs.map((p) => p[0].trim()), rights = pairs.map((p) => p[1].trim());
  const extras = extraRight.map((t) => t.trim()).filter((t, i, arr) => !rights.includes(t) && arr.indexOf(t) === i);
  if (new Set(lefts).size !== lefts.length || new Set(rights).size !== rights.length) throw new Error(`matching: sides must be distinct: ${rights.join(" | ")}`);
  const shownRight = rng.shuffle([...rights, ...extras]);
  const left: Option[] = lefts.map((text, i) => ({ id: `l${i + 1}`, text }));
  const right: Option[] = shownRight.map((text, i) => ({ id: `r${i + 1}`, text }));
  return { options: { kind: "matching", left, right }, answer: { type: "matching", pairs: lefts.map((_, i) => [`l${i + 1}`, `r${shownRight.indexOf(rights[i]) + 1}`] as [string, string]) } };
}

/** Cloze: the stem must contain {{1}}, {{2}}, … — one accepted-answers list per blank, in order. */
export function cloze(blanks: string[][], normalize?: { case?: boolean; spaces?: boolean; yo?: boolean; punctuation?: boolean }): { options: QuestionOptions; answer: AnswerInput } {
  const ids = blanks.map((_, i) => String(i + 1));
  const rules = { case: true, spaces: true, yo: true, punctuation: false, ...normalize };
  return { options: { kind: "cloze", blanks: ids.map((id) => ({ id })) }, answer: { type: "cloze", blanks: Object.fromEntries(ids.map((id, i) => [id, blanks[i]])), normalize: rules } };
}

/** Short text answer with the accepted spellings. */
export function shortText(accepted: string[], normalize?: { case?: boolean; spaces?: boolean; yo?: boolean; punctuation?: boolean }): AnswerInput {
  return { type: "short_text", accepted, normalize: { case: true, spaces: true, yo: true, punctuation: false, ...normalize } };
}
