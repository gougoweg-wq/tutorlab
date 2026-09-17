import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema, rows } from "@/db/client";
import { MASTERY, TIMEZONE } from "./config";
import { replay, masteryFromTheta, sm2, updateDifficulty, type Observation } from "./model";

type ItemRow = { topicId: string; parentId: string | null; isPrimary: boolean; delta: number; outcome: number; at: string };

/** Rebuilds (student, topic) rows from attempt_items — the source of truth — so re-runs never double count. */
export async function rebuildTopics(studentId: string, topicIds: string[]): Promise<void> {
  if (!topicIds.length) return;
  const db = await getDb();
  const items = rows<ItemRow>(await db.execute(sql`
    select qt.topic_id as "topicId", t.parent_id as "parentId", qt.is_primary as "isPrimary",
           coalesce((select me.difficulty from mastery_events me where me.attempt_item_id = ai.id limit 1), q.elo_difficulty) as delta,
           (coalesce((ai.tutor_override->>'points')::numeric, ai.score) / nullif(ai.max_score, 0))::float as outcome, a.submitted_at as at
    from attempt_items ai join attempts a on a.id = ai.attempt_id
    join question_versions qv on qv.id = ai.question_version_id join questions q on q.id = qv.question_id
    join question_topics qt on qt.question_id = q.id join topics t on t.id = qt.topic_id
    where a.student_id = ${studentId} and a.submitted_at is not null and ai.score is not null
    order by a.submitted_at, ai.sort`));
  const byTopic = new Map<string, Observation[]>();
  const push = (id: string, o: Observation) => { if (topicIds.includes(id)) byTopic.set(id, [...(byTopic.get(id) ?? []), o]); };
  for (const r of items) {
    const base = { delta: Number(r.delta), outcome: Math.max(0, Math.min(1, Number(r.outcome ?? 0))), at: new Date(r.at) };
    push(r.topicId, { ...base, weight: r.isPrimary ? MASTERY.weights.primary : MASTERY.weights.secondary });
    if (r.parentId) push(r.parentId, { ...base, weight: MASTERY.weights.parent });
  }
  await db.transaction(async (tx) => {
    for (const id of topicIds) {
      const s = replay(byTopic.get(id) ?? []);
      if (!s.n) { await tx.delete(schema.mastery).where(and(eq(schema.mastery.studentId, studentId), eq(schema.mastery.topicId, id))); continue; }
      const values = { theta: s.theta, nAttempts: s.n, nCorrect: s.nCorrect, lastAttemptAt: s.lastAt, mastery: masteryFromTheta(s.theta), updatedAt: new Date() };
      await tx.insert(schema.mastery).values({ studentId, topicId: id, ...values }).onConflictDoUpdate({ target: [schema.mastery.studentId, schema.mastery.topicId], set: values });
    }
  });
}

export async function recordAttempt(attemptId: string): Promise<void> {
  const db = await getDb();
  const [att] = await db.select().from(schema.attempts).where(eq(schema.attempts.id, attemptId));
  if (!att?.submittedAt) return;
  const items = rows<{ itemId: string; qid: string; topicId: string; parentId: string | null; outcome: number; delta: number; m: number; theta: number | null }>(await db.execute(sql`
    select ai.id as "itemId", q.id as qid, qt.topic_id as "topicId", t.parent_id as "parentId", (ai.score / nullif(ai.max_score,0))::float as outcome,
           q.elo_difficulty as delta, q.answers_count as m, (select theta from mastery m where m.student_id = ${att.studentId} and m.topic_id = qt.topic_id) as theta
    from attempt_items ai join question_versions qv on qv.id = ai.question_version_id join questions q on q.id = qv.question_id
    join question_topics qt on qt.question_id = q.id join topics t on t.id = qt.topic_id where ai.attempt_id = ${attemptId} and ai.score is not null`));
  const first = (await db.select({ id: schema.masteryEvents.id }).from(schema.masteryEvents).where(inArray(schema.masteryEvents.attemptItemId, items.length ? items.map((i) => i.itemId) : ["00000000-0000-0000-0000-000000000000"])).limit(1)).length === 0;
  const topicIds = [...new Set(items.flatMap((i) => [i.topicId, ...(i.parentId ? [i.parentId] : [])]))];
  const before = new Map((await db.select().from(schema.mastery).where(and(eq(schema.mastery.studentId, att.studentId), inArray(schema.mastery.topicId, topicIds.length ? topicIds : ["00000000-0000-0000-0000-000000000000"])))).map((m) => [m.topicId, m.theta]));
  await rebuildTopics(att.studentId, topicIds);
  if (!first) return; // re-run (e.g. after a tutor override): state rebuilt, side effects below happen once
  const after = new Map((await db.select().from(schema.mastery).where(and(eq(schema.mastery.studentId, att.studentId), inArray(schema.mastery.topicId, topicIds)))).map((m) => [m.topicId, m.theta]));
  await db.transaction(async (tx) => {
    for (const i of items) {
      await tx.insert(schema.masteryEvents).values({ studentId: att.studentId, topicId: i.topicId, attemptItemId: i.itemId, thetaBefore: before.get(i.topicId) ?? 0, thetaAfter: after.get(i.topicId) ?? 0, difficulty: Number(i.delta), outcome: Number(i.outcome ?? 0) });
      await tx.update(schema.questions).set({ eloDifficulty: updateDifficulty(Number(i.delta), Number(i.theta ?? 0), Number(i.outcome ?? 0), Number(i.m)) }).where(eq(schema.questions.id, i.qid));
    }
    const perTopic = new Map<string, { ok: number; n: number }>();
    for (const i of items) { const p = perTopic.get(i.topicId) ?? { ok: 0, n: 0 }; p.ok += Number(i.outcome ?? 0); p.n += 1; perTopic.set(i.topicId, p); }
    for (const [topicId, p] of perTopic) {
      const [prev] = await tx.select().from(schema.reviewSchedule).where(and(eq(schema.reviewSchedule.studentId, att.studentId), eq(schema.reviewSchedule.topicId, topicId)));
      const next = sm2(prev ?? { intervalDays: 1, ease: 2.5, repetitions: 0 }, 5 * (p.ok / p.n));
      const values = { ...next, dueAt: new Date(Date.now() + next.intervalDays * 86_400_000) };
      await tx.insert(schema.reviewSchedule).values({ studentId: att.studentId, topicId, ...values }).onConflictDoUpdate({ target: [schema.reviewSchedule.studentId, schema.reviewSchedule.topicId], set: values });
    }
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(att.submittedAt!);
    await tx.execute(sql`insert into activity_days (student_id, day, items_answered, practiced) values (${att.studentId}, ${day}::timestamp, ${items.length}, true)
      on conflict (student_id, day) do update set items_answered = activity_days.items_answered + ${items.length}`);
  });
}
