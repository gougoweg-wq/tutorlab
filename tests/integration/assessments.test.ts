import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { setupTestDb, closeTestDb } from "../helpers/db";
import { schema, withUser, rows, type DB } from "@/db/client";
import { generateOne } from "@/modules/generators";
import { insertQuestion } from "@/modules/questions/repo";
import * as svc from "@/modules/assessments/service";

let db: DB; let ws: string; let topicId: string; let s1: string; let s2: string;
const tutor = { user: { id: "tutor1" }, workspaceId: "", role: "owner" };

beforeAll(async () => {
  db = await setupTestDb();
  for (const id of ["tutor1", "stu1", "stu2"]) await db.insert(schema.user).values({ id, name: id, email: `${id}@t.local` });
  [{ id: ws }] = await db.insert(schema.workspaces).values({ name: "W", slug: "w", ownerId: "tutor1" }).returning({ id: schema.workspaces.id });
  tutor.workspaceId = ws;
  await db.insert(schema.memberships).values([{ workspaceId: ws, userId: "tutor1", role: "owner" }, { workspaceId: ws, userId: "stu1", role: "student" }, { workspaceId: ws, userId: "stu2", role: "student" }]);
  [{ id: s1 }, { id: s2 }] = await db.insert(schema.students).values([{ workspaceId: ws, userId: "stu1", displayName: "A", grade: 8 }, { workspaceId: ws, userId: "stu2", displayName: "B", grade: 8 }]).returning({ id: schema.students.id });
  const [subj] = await db.insert(schema.subjects).values({ code: "MATH", name: { ru: "Математика" } }).returning();
  [{ id: topicId }] = await db.insert(schema.topics).values({ subjectId: subj.id, code: "MATH.8.T2", name: { ru: "Квадратные уравнения" }, grade: 8, depth: 1 }).returning({ id: schema.topics.id });
  for (let i = 0; i < 12; i++) await insertQuestion(db, { workspaceId: null, draft: generateOne("math-8.2", { seed: i }), source: "generator", status: "published" });
});
afterAll(closeTestDb);

const rule = () => ({ topicId, includeSubtree: true, count: 5, difficultyMin: 1, difficultyMax: 5, types: null });
const ctx1 = () => ({ user: { id: "stu1" }, workspaceId: ws, studentId: s1, role: "student" });
const ctx2 = () => ({ user: { id: "stu2" }, workspaceId: ws, studentId: s2, role: "student" });

describe("assessment flow", () => {
  let assignmentId: string; let attemptId: string;
  it("creates a blueprint test and assigns it", async () => {
    const r = await svc.createTest(tutor, { title: "T", rules: [rule()], studentIds: [s1], dueAt: null });
    assignmentId = r.assignmentIds[0]; expect(assignmentId).toBeTruthy();
  });
  it("rejects rules the bank cannot satisfy", async () => {
    await expect(svc.createTest(tutor, { title: "X", rules: [{ ...rule(), count: 50 }], studentIds: [s1], dueAt: null })).rejects.toMatchObject({ code: "bank_too_small" });
  });
  it("starts, resumes, and never leaks answers to the student", async () => {
    attemptId = await svc.startAttempt(ctx1(), assignmentId);
    expect(await svc.startAttempt(ctx1(), assignmentId)).toBe(attemptId);
    const a = await svc.getAttemptForStudent(ctx1(), attemptId);
    expect(a.questions).toHaveLength(5);
    const json = JSON.stringify(a);
    for (const k of ['"answer"', '"explanationMd"', '"rubric"', '"values"']) expect(json).not.toContain(k);
  });
  it("another student cannot read, save or submit it", async () => {
    await expect(svc.getAttemptForStudent(ctx2(), attemptId)).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.submitAttempt(ctx2(), attemptId)).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.startAttempt(ctx2(), assignmentId)).rejects.toMatchObject({ code: "not_found" });
  });
  it("RLS: a student sees no foreign attempts and no question versions at all", async () => {
    const seen = await withUser("stu2", async (tx) => ({ attempts: rows(await tx.execute(sql`select id from attempts`)).length, versions: rows(await tx.execute(sql`select id from question_versions`)).length, items: rows(await tx.execute(sql`select id from attempt_items`)).length }));
    expect(seen).toEqual({ attempts: 0, versions: 0, items: 0 });
    const own = await withUser("stu1", async (tx) => rows(await tx.execute(sql`select id from attempts`)).length);
    expect(own).toBe(1);
  });
  it("scores on the server, exactly once", async () => {
    const a = await svc.getAttemptForStudent(ctx1(), attemptId);
    const key = rows<{ vid: string; answer: { values: number[] } }>(await db.execute(sql`select id as vid, answer from question_versions`));
    const right = key.find((k) => k.vid === a.questions[0].versionId)!;
    await svc.saveAnswer(ctx1(), attemptId, a.questions[0].versionId, { type: "numeric", raw: right.answer.values.join("; ") });
    await svc.saveAnswer(ctx1(), attemptId, a.questions[1].versionId, { type: "numeric", raw: "999999" });
    await expect(svc.saveAnswer(ctx1(), attemptId, a.questions[2].versionId, { type: "short_text", text: "x" })).rejects.toMatchObject({ code: "validation" });
    await svc.submitAttempt(ctx1(), attemptId); await svc.submitAttempt(ctx1(), attemptId);
    const r = await svc.getResult(ctx1(), attemptId);
    expect(r.percent).toBe(20); expect(r.items.filter((i) => i.isCorrect)).toHaveLength(1); expect(r.items[1].correct).toBeTruthy();
    const counts = rows<{ s: number }>(await db.execute(sql`select sum(answers_count)::int s from questions`))[0].s;
    expect(counts).toBe(5);
  });
  it("answers are frozen after submission (service and DB trigger)", async () => {
    const a = await svc.getAttemptForStudent(ctx1(), attemptId);
    await expect(svc.saveAnswer(ctx1(), attemptId, a.questions[3].versionId, { type: "numeric", raw: "1" })).rejects.toMatchObject({ code: "already_submitted" });
    await expect(db.execute(sql`update attempt_items set answer = '{"type":"numeric","raw":"1"}'::jsonb where attempt_id = ${attemptId}`)).rejects.toThrow();
  });
  it("respects the attempts limit and the tutor can open the work", async () => {
    await expect(svc.startAttempt(ctx1(), assignmentId)).rejects.toMatchObject({ code: "attempts_exhausted" });
    expect((await svc.getResult(tutor, attemptId)).student).toBe("A");
    await expect(svc.getResult(ctx2(), attemptId)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("mastery after grading", () => {
  it("records mastery once and stays identical when re-run (idempotent rebuild)", async () => {
    const { recordAttempt } = await import("@/modules/mastery/service");
    const snap = async () => rows<{ theta: number; n: number }>(await db.execute(sql`select theta, n_attempts as n from mastery where student_id = ${s1} order by topic_id`));
    const first = await snap(); expect(first.length).toBeGreaterThan(0); expect(first[0].n).toBe(5);
    const [att] = rows<{ id: string }>(await db.execute(sql`select id from attempts where student_id = ${s1} limit 1`));
    await recordAttempt(att.id); await recordAttempt(att.id);
    expect(await snap()).toEqual(first);
    const ev = rows<{ c: number }>(await db.execute(sql`select count(*)::int c from mastery_events where student_id = ${s1}`))[0].c; expect(ev).toBe(5);
    const act = rows<{ n: number }>(await db.execute(sql`select items_answered as n from activity_days where student_id = ${s1}`)); expect(act).toEqual([{ n: 5 }]);
  });
  it("RLS: a student reads only their own mastery", async () => {
    expect(await withUser("stu2", async (tx) => rows(await tx.execute(sql`select 1 from mastery`)).length)).toBe(0);
    expect(await withUser("stu1", async (tx) => rows(await tx.execute(sql`select 1 from mastery`)).length)).toBeGreaterThan(0);
  });
});
