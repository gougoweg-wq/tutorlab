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
export async function countForRuleAction(topicId: string, dmin: number, dmax: number, types: string[] | null = null) { return action(async () => { const ctx = await requireTutor(); return svc.countForRule(ctx.workspaceId, z.string().uuid().parse(topicId), dmin, dmax, z.array(z.enum(["numeric", "single_choice"])).nullable().parse(types)); }); }
export async function startAttemptAction(assignmentId: string) { return action(async () => svc.startAttempt(await requireStudent(), z.string().uuid().parse(assignmentId))); }
export async function saveAnswerAction(attemptId: string, versionId: string, payload: unknown) {
  return action(async () => { const ctx = await requireStudent(); await rateLimit(`save:${attemptId}`, 240, 60); await svc.saveAnswer(ctx, attemptId, versionId, payload); });
}
export async function submitAttemptAction(attemptId: string) { return action(async () => { const ctx = await requireStudent(); await rateLimit(`submit:${attemptId}`, 10, 60); await svc.submitAttempt(ctx, attemptId); revalidatePath("/student"); }); }

/** Student builds their own practice set: picks topics, size and difficulty. */
export async function createPracticeAction(input: unknown) {
  return action(async () => {
    const ctx = await requireStudent();
    const d = z.object({ topicIds: z.array(z.string().uuid()).min(1).max(8), count: z.coerce.number().int().min(3).max(30), level: z.enum(["easy", "normal", "hard"]), timed: z.boolean().default(false) }).parse(input);
    await rateLimit(`practice:${ctx.studentId}`, 30, 3600);
    const [dmin, dmax] = d.level === "easy" ? [1, 3] : d.level === "hard" ? [3, 5] : [2, 4];
    const base = Math.floor(d.count / d.topicIds.length); let extra = d.count % d.topicIds.length;
    const rules = d.topicIds.map((topicId) => ({ topicId, includeSubtree: true, count: base + (extra-- > 0 ? 1 : 0), difficultyMin: dmin, difficultyMax: dmax, types: null })).filter((r) => r.count > 0);
    const names = await svc.topicNames(d.topicIds);
    const r = await svc.createTest({ user: { id: ctx.user.id }, workspaceId: ctx.workspaceId }, { title: names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : ""), rules, studentIds: [ctx.studentId], dueAt: null, isPractice: true, createdBy: null,
      settings: { ...DEFAULT_SETTINGS, maxAttempts: 3, layout: "list", timeLimitMin: d.timed ? Math.max(5, Math.round(d.count * 1.6)) : null } });
    const attemptId = await svc.startAttempt(ctx, r.assignmentIds[0]);
    revalidatePath("/student");
    return { attemptId };
  });
}

export async function checkItemAction(attemptId: string, versionId: string, payload: unknown) {
  return action(async () => { const ctx = await requireStudent(); await rateLimit(`check:${attemptId}`, 120, 60); return svc.checkItem(ctx, attemptId, versionId, payload); });
}
