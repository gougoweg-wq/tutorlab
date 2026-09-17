import { z } from "zod";

export const assessmentSettingsSchema = z.object({
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(true),
  timeLimitMin: z.number().int().min(1).max(600).nullable().default(null),
  maxAttempts: z.number().int().min(1).max(20).default(1),
  showAnswers: z.enum(["immediately", "after_deadline", "never"]).default("immediately"),
  passPercent: z.number().min(0).max(100).default(60),
  /** "one" = one question per screen, "list" = all on one page */
  layout: z.enum(["one", "list"]).default("one"),
});
export type AssessmentSettings = z.infer<typeof assessmentSettingsSchema>;

export const DEFAULT_SETTINGS: AssessmentSettings = assessmentSettingsSchema.parse({});

export const blueprintRuleSchema = z.object({
  topicId: z.string().uuid(),
  includeSubtree: z.boolean().default(true),
  count: z.number().int().min(1).max(60),
  difficultyMin: z.number().int().min(1).max(5).default(1),
  difficultyMax: z.number().int().min(1).max(5).default(5),
  types: z.array(z.string()).nullable().default(null),
}).refine((r) => r.difficultyMin <= r.difficultyMax, { message: "difficultyMin must be <= difficultyMax" });
export type BlueprintRule = z.infer<typeof blueprintRuleSchema>;
