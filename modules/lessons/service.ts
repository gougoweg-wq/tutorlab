import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema, rows } from "@/db/client";
import { AppError } from "@/modules/shared/result";
import { createBlueprintAssignment } from "@/modules/assessments/service";

type Ctx = { user: { id: string }; workspaceId: string };

/** 10 questions across 3 topics → 4/3/3: the remainder goes to the first topics. */
export function splitCount(total: number, parts: number): number[] {
  if (parts <= 0) return []; const base = Math.floor(total / parts); const extra = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

export async function listLessons(ctx: Ctx, locale = "ru") {
  const db = await getDb();
  const list = rows<{ id: string; startsAt: string; durationMin: number; status: "planned" | "done" | "cancelled"; noteMd: string; callUrl: string | null; topicIds: string[]; homework: boolean; students: { id: string; name: string }[] }>(await db.execute(sql`
    select l.id, l.starts_at as "startsAt", l.duration_min as "durationMin", l.status, l.note_md as "noteMd", l.call_url as "callUrl", l.topic_ids as "topicIds", (l.homework_assessment_id is not null) as homework,
      coalesce((select json_agg(json_build_object('id', s.id, 'name', s.display_name) order by s.display_name) from lesson_students ls join students s on s.id = ls.student_id where ls.lesson_id = l.id), '[]'::json) as students
    from lessons l where l.workspace_id = ${ctx.workspaceId} and l.starts_at > now() - interval '60 days' order by l.starts_at desc limit 200`));
  const ids = [...new Set(list.flatMap((l) => l.topicIds))];
  const names = ids.length ? new Map((await db.select({ id: schema.topics.id, name: schema.topics.name }).from(schema.topics).where(inArray(schema.topics.id, ids))).map((t) => [t.id, (t.name as Record<string, string>)[locale] ?? t.name.ru])) : new Map<string, string>();
  return list.map((l) => ({ ...l, topics: l.topicIds.map((id) => names.get(id) ?? "").filter(Boolean) }));
}

export async function createLesson(ctx: Ctx, d: { startsAt: Date; durationMin: number; studentIds: string[]; topicIds: string[]; noteMd: string; callUrl: string | null; repeatWeeks: number }) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const owned = await tx.select({ id: schema.students.id }).from(schema.students).where(and(eq(schema.students.workspaceId, ctx.workspaceId), inArray(schema.students.id, d.studentIds)));
    if (owned.length !== d.studentIds.length) throw new AppError("forbidden");
    const ids: string[] = [];
    for (let w = 0; w < Math.max(1, d.repeatWeeks); w++) {
      const [l] = await tx.insert(schema.lessons).values({ workspaceId: ctx.workspaceId, startsAt: new Date(d.startsAt.getTime() + w * 7 * 86_400_000), durationMin: d.durationMin, topicIds: d.topicIds, noteMd: d.noteMd, callUrl: d.callUrl }).returning({ id: schema.lessons.id });
      await tx.insert(schema.lessonStudents).values(d.studentIds.map((studentId) => ({ lessonId: l.id, studentId }))); ids.push(l.id);
    }
    return ids;
  });
}

export async function setStatus(ctx: Ctx, id: string, status: "planned" | "done" | "cancelled") {
  const db = await getDb();
  const r = await db.update(schema.lessons).set({ status, updatedAt: new Date() }).where(and(eq(schema.lessons.id, id), eq(schema.lessons.workspaceId, ctx.workspaceId))).returning({ id: schema.lessons.id });
  if (!r.length) throw new AppError("not_found");
}

export async function deleteLesson(ctx: Ctx, id: string) {
  const db = await getDb();
  const r = await db.delete(schema.lessons).where(and(eq(schema.lessons.id, id), eq(schema.lessons.workspaceId, ctx.workspaceId))).returning({ id: schema.lessons.id });
  if (!r.length) throw new AppError("not_found");
}

/** Homework in one click: a personal variant for every student of the lesson, built from the lesson's topics. */
export async function createHomework(ctx: Ctx, lessonId: string, opts: { count: number; dueDays: number; title: string }) {
  const db = await getDb();
  const [l] = await db.select().from(schema.lessons).where(and(eq(schema.lessons.id, lessonId), eq(schema.lessons.workspaceId, ctx.workspaceId)));
  if (!l) throw new AppError("not_found");
  if (!l.topicIds.length) throw new AppError("validation");
  const students = await db.select({ id: schema.lessonStudents.studentId }).from(schema.lessonStudents).where(eq(schema.lessonStudents.lessonId, l.id));
  const counts = splitCount(opts.count, l.topicIds.length);
  const rules = l.topicIds.map((topicId, i) => ({ topicId, includeSubtree: true, count: counts[i], difficultyMin: 2, difficultyMax: 4, types: null })).filter((r) => r.count > 0);
  const results: { studentId: string; ok: boolean }[] = []; let first: string | null = null;
  for (const s of students) {
    try { const r = await createBlueprintAssignment({ workspaceId: ctx.workspaceId, studentId: s.id, title: opts.title, rules, createdBy: ctx.user.id, lessonId: l.id, dueAt: new Date(Date.now() + opts.dueDays * 86_400_000), isPractice: false }); first ??= r.assessmentId; results.push({ studentId: s.id, ok: true }); }
    catch (e) { if (e instanceof AppError && e.code === "bank_too_small") results.push({ studentId: s.id, ok: false }); else throw e; }
  }
  if (first) await db.update(schema.lessons).set({ homeworkAssessmentId: first, status: "done", updatedAt: new Date() }).where(eq(schema.lessons.id, l.id));
  return results;
}

export async function upcomingForStudent(studentId: string, locale = "ru") {
  const db = await getDb();
  const list = rows<{ id: string; startsAt: string; durationMin: number; callUrl: string | null; topicIds: string[] }>(await db.execute(sql`select l.id, l.starts_at as "startsAt", l.duration_min as "durationMin", l.call_url as "callUrl", l.topic_ids as "topicIds" from lessons l join lesson_students ls on ls.lesson_id = l.id where ls.student_id = ${studentId} and l.status = 'planned' and l.starts_at > now() - interval '2 hours' order by l.starts_at limit 3`));
  const ids = [...new Set(list.flatMap((l) => l.topicIds))];
  const names = ids.length ? new Map((await db.select({ id: schema.topics.id, name: schema.topics.name }).from(schema.topics).where(inArray(schema.topics.id, ids))).map((t) => [t.id, (t.name as Record<string, string>)[locale] ?? t.name.ru])) : new Map<string, string>();
  return list.map((l) => ({ ...l, topics: l.topicIds.map((id) => names.get(id) ?? "").filter(Boolean) }));
}
