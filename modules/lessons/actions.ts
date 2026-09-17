"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/modules/shared/result";
import { requireTutor } from "@/modules/auth/context";
import * as svc from "./service";

const id = z.string().uuid();
export async function createLessonAction(raw: unknown) {
  return action(async () => {
    const ctx = await requireTutor();
    const d = z.object({ startsAt: z.string().min(10), durationMin: z.coerce.number().int().min(15).max(300), studentIds: z.array(id).min(1).max(50), topicIds: z.array(id).max(8), noteMd: z.string().max(4000).default(""),
      callUrl: z.string().trim().url().startsWith("https://").max(500).nullable().or(z.literal("").transform(() => null)), repeatWeeks: z.coerce.number().int().min(1).max(26).default(1) }).parse(raw);
    const r = await svc.createLesson(ctx, { ...d, startsAt: new Date(d.startsAt) }); revalidatePath("/tutor/lessons"); return r;
  });
}
export async function setLessonStatusAction(lessonId: string, status: "planned" | "done" | "cancelled") { return action(async () => { await svc.setStatus(await requireTutor(), id.parse(lessonId), z.enum(["planned", "done", "cancelled"]).parse(status)); revalidatePath("/tutor/lessons"); }); }
export async function deleteLessonAction(lessonId: string) { return action(async () => { await svc.deleteLesson(await requireTutor(), id.parse(lessonId)); revalidatePath("/tutor/lessons"); }); }
export async function createHomeworkAction(lessonId: string, raw: unknown) {
  return action(async () => { const ctx = await requireTutor(); const d = z.object({ count: z.coerce.number().int().min(3).max(40), dueDays: z.coerce.number().int().min(1).max(30), title: z.string().trim().min(2).max(120) }).parse(raw);
    const r = await svc.createHomework(ctx, id.parse(lessonId), d); revalidatePath("/tutor/lessons"); revalidatePath("/tutor/assessments"); return r; });
}
