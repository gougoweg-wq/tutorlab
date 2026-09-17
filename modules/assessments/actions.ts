"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/modules/shared/result";
import { requireTutor, requireStudent } from "@/modules/auth/context";
import { rateLimit } from "@/modules/shared/rate-limit";
import { blueprintRuleSchema, DEFAULT_SETTINGS } from "./types";
import * as svc from "./service";

export async function createTestAction(input: unknown) {
  return action(async () => {
    const ctx = await requireTutor();
    const d = z.object({ title: z.string().trim().min(2).max(120), rules: z.array(blueprintRuleSchema).min(1).max(20), studentIds: z.array(z.string().uuid()).max(200), dueAt: z.string().nullable(), maxAttempts: z.coerce.number().int().min(1).max(10).default(1), timeLimitMin: z.coerce.number().int().min(1).max(600).nullable().default(null) }).parse(input);
    const r = await svc.createTest(ctx, { title: d.title, rules: d.rules, studentIds: d.studentIds, dueAt: d.dueAt ? new Date(d.dueAt) : null, settings: { ...DEFAULT_SETTINGS, maxAttempts: d.maxAttempts, timeLimitMin: d.timeLimitMin, layout: "list" } });
    revalidatePath("/tutor/assessments");
    return r;
  });
}
export async function countForRuleAction(topicId: string, dmin: number, dmax: number) { return action(async () => { const ctx = await requireTutor(); return svc.countForRule(ctx.workspaceId, z.string().uuid().parse(topicId), dmin, dmax); }); }
export async function startAttemptAction(assignmentId: string) { return action(async () => svc.startAttempt(await requireStudent(), z.string().uuid().parse(assignmentId))); }
export async function saveAnswerAction(attemptId: string, versionId: string, payload: unknown) {
  return action(async () => { const ctx = await requireStudent(); await rateLimit(`save:${attemptId}`, 240, 60); await svc.saveAnswer(ctx, attemptId, versionId, payload); });
}
export async function submitAttemptAction(attemptId: string) { return action(async () => { const ctx = await requireStudent(); await rateLimit(`submit:${attemptId}`, 10, 60); await svc.submitAttempt(ctx, attemptId); revalidatePath("/student"); }); }
