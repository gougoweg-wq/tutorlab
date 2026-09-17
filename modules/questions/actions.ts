"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { action, AppError } from "@/modules/shared/result";
import { requireTutor } from "@/modules/auth/context";
import { getDb, schema } from "@/db/client";
import { insertQuestion } from "./repo";
import { parseNumbers } from "./normalize";
import { audit } from "@/modules/shared/audit";

const input = z.object({
  kind: z.enum(["numeric", "single_choice"]), stem: z.string().trim().min(5).max(4000), explanation: z.string().trim().max(6000).default(""),
  topicId: z.string().uuid(), difficulty: z.coerce.number().int().min(1).max(5), numeric: z.string().max(200).optional(),
  choices: z.array(z.string().trim().min(1).max(300)).optional(), correct: z.coerce.number().int().min(0).max(7).optional(),
});

export async function createQuestionAction(raw: unknown) {
  return action(async () => {
    const ctx = await requireTutor(); const d = input.parse(raw); const db = await getDb();
    const [topic] = await db.select({ code: schema.topics.code, grade: schema.topics.grade, isSat: schema.topics.isSat }).from(schema.topics).where(eq(schema.topics.id, d.topicId));
    if (!topic) throw new AppError("not_found");
    const common = { stemMd: d.stem, explanationMd: d.explanation, difficulty: d.difficulty, grade: topic.grade && topic.grade <= 11 ? topic.grade : undefined, language: topic.isSat ? "en" as const : "ru" as const, topicCodes: [topic.code], tags: [] };
    if (d.kind === "numeric") {
      const values = parseNumbers(d.numeric ?? ""); if (!values) throw new AppError("validation", undefined, { numeric: "number" });
      return insertQuestion(db, { workspaceId: ctx.workspaceId, source: "manual", status: "published", authorId: ctx.user.id, draft: { ...common, type: "numeric", answer: { type: "numeric", values, tolerance: values.some((v) => !Number.isInteger(v)) ? 0.001 : 1e-6, relTolerance: 0, ordered: false } } });
    }
    const texts = (d.choices ?? []).filter(Boolean);
    if (texts.length < 2 || new Set(texts).size !== texts.length || d.correct === undefined || d.correct >= texts.length) throw new AppError("validation", undefined, { choices: "choices" });
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const res = await insertQuestion(db, { workspaceId: ctx.workspaceId, source: "manual", status: "published", authorId: ctx.user.id, draft: { ...common, type: "single_choice", options: { kind: "choices", choices: texts.map((text, i) => ({ id: ids[i], text })) }, answer: { type: "single_choice", correct: ids[d.correct] } } });
    revalidatePath("/tutor/questions"); return res;
  });
}

/** Only the workspace's own questions can be removed; the global bank is read-only. Soft delete keeps old attempts intact. */
export async function deleteQuestionAction(id: string) {
  return action(async () => {
    const ctx = await requireTutor(); const db = await getDb();
    const done = await db.update(schema.questions).set({ deletedAt: new Date() }).where(and(eq(schema.questions.id, z.string().uuid().parse(id)), eq(schema.questions.workspaceId, ctx.workspaceId))).returning({ id: schema.questions.id });
    if (!done.length) throw new AppError("forbidden");
    await audit(db, { workspaceId: ctx.workspaceId, actorId: ctx.user.id, action: "question.delete", entity: "question", entityId: id });
    revalidatePath("/tutor/questions");
  });
}
