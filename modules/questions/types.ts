import { z } from "zod";

/**
 * Shared contract for the question bank. Everything that stores, renders, scores or
 * generates a question goes through these schemas — the DB jsonb columns are typed by them.
 */

export const QUESTION_TYPES = ["single_choice", "multiple_choice", "numeric", "short_text", "matching", "ordering", "cloze", "free_text"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Auto-gradable without AI */
export const AUTO_TYPES: QuestionType[] = ["single_choice", "multiple_choice", "numeric", "short_text", "matching", "ordering", "cloze"];

const optionSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });
export type Option = z.infer<typeof optionSchema>;

/** `options` column. Shape depends on type. */
export const optionsSchema = z.union([
  z.object({ kind: z.literal("choices"), choices: z.array(optionSchema).min(2).max(8) }),
  z.object({ kind: z.literal("matching"), left: z.array(optionSchema).min(2).max(8), right: z.array(optionSchema).min(2).max(10) }),
  z.object({ kind: z.literal("ordering"), items: z.array(optionSchema).min(2).max(8) }),
  /** stem contains {{1}}, {{2}} … placeholders */
  z.object({ kind: z.literal("cloze"), blanks: z.array(z.object({ id: z.string(), placeholder: z.string().optional() })).min(1).max(10) }),
]);
export type QuestionOptions = z.infer<typeof optionsSchema>;

const normalizeSchema = z.object({ case: z.boolean().default(true), spaces: z.boolean().default(true), yo: z.boolean().default(true), punctuation: z.boolean().default(false) });
export type NormalizeRules = z.infer<typeof normalizeSchema>;

/** `answer` column (never sent to a student before the attempt is submitted). */
export const answerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("single_choice"), correct: z.string() }),
  z.object({ type: z.literal("multiple_choice"), correct: z.array(z.string()).min(1), partial: z.boolean().default(true) }),
  z.object({
    type: z.literal("numeric"),
    /** one or more values; several = a set (e.g. both roots), order ignored unless `ordered` */
    values: z.array(z.number()).min(1).max(6),
    tolerance: z.number().min(0).default(1e-6),
    /** relative tolerance applied as max(tolerance, rel*|value|) */
    relTolerance: z.number().min(0).default(0),
    unit: z.string().optional(),
    ordered: z.boolean().default(false),
  }),
  z.object({ type: z.literal("short_text"), accepted: z.array(z.string().min(1)).min(1), normalize: normalizeSchema.default({ case: true, spaces: true, yo: true, punctuation: false }) }),
  z.object({ type: z.literal("matching"), pairs: z.array(z.tuple([z.string(), z.string()])).min(2) }),
  z.object({ type: z.literal("ordering"), order: z.array(z.string()).min(2) }),
  z.object({ type: z.literal("cloze"), blanks: z.record(z.string(), z.array(z.string().min(1)).min(1)), normalize: normalizeSchema.default({ case: true, spaces: true, yo: true, punctuation: false }) }),
  z.object({ type: z.literal("free_text"), maxPoints: z.number().positive().default(5), sample: z.string().optional() }),
]);
export type QuestionAnswer = z.infer<typeof answerSchema>;

export const rubricSchema = z.object({ criteria: z.array(z.object({ criterion: z.string(), points: z.number().positive() })).min(1) });
export type Rubric = z.infer<typeof rubricSchema>;

/** What a student submits for one item (`attempt_items.answer`). */
export const answerPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("single_choice"), choice: z.string().nullable() }),
  z.object({ type: z.literal("multiple_choice"), choices: z.array(z.string()) }),
  z.object({ type: z.literal("numeric"), raw: z.string().max(200) }),
  z.object({ type: z.literal("short_text"), text: z.string().max(500) }),
  z.object({ type: z.literal("matching"), pairs: z.array(z.tuple([z.string(), z.string()])) }),
  z.object({ type: z.literal("ordering"), order: z.array(z.string()) }),
  z.object({ type: z.literal("cloze"), blanks: z.record(z.string(), z.string().max(200)) }),
  z.object({ type: z.literal("free_text"), text: z.string().max(10_000) }),
]);
export type AnswerPayload = z.infer<typeof answerPayloadSchema>;

export type AiGrade = { points: number; maxPoints: number; confidence: number; reasoning: string; model: string; promptVersion: string };
export type TutorOverride = { points: number; comment: string; by: string; at: string };

/** A complete question as produced by a generator, an importer, the AI pipeline or the editor. */
export const questionDraftSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  stemMd: z.string().min(3).max(4000),
  options: optionsSchema.optional(),
  answer: answerSchema,
  explanationMd: z.string().max(6000).default(""),
  rubric: rubricSchema.optional(),
  difficulty: z.number().int().min(1).max(5),
  grade: z.number().int().min(5).max(12).optional(),
  language: z.enum(["ru", "en", "uz"]).default("ru"),
  topicCodes: z.array(z.string()).min(1),
  tags: z.array(z.string()).default([]),
}).refine((q) => q.type === q.answer.type, { message: "answer.type must match question type" });
export type QuestionDraft = z.infer<typeof questionDraftSchema>;

/** Student-safe projection: no answer, no explanation, no rubric. */
export type PublicQuestion = {
  versionId: string;
  type: QuestionType;
  stemMd: string;
  options: QuestionOptions | null;
  unit?: string;
  /** how many numeric values are expected (so the UI can hint "two roots") */
  expectedValues?: number;
};

export type ScoreResult = { score: number; maxScore: number; isCorrect: boolean | null; needsReview: boolean };
