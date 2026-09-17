import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, schema, rows, type Executor } from "@/db/client";
import { AppError } from "@/modules/shared/result";
import { scoreAnswer, describeAnswer } from "@/modules/questions/scoring";
import { toPublic } from "@/modules/questions/public";
import { answerPayloadSchema, type AnswerPayload, type PublicQuestion } from "@/modules/questions/types";
import { DEFAULT_SETTINGS, type AssessmentSettings, type BlueprintRule } from "./types";
import type { PracticeInput } from "./practice";
import { onAttemptGraded } from "@/modules/mastery/hooks";
import { notify } from "@/modules/notifications/notify";

type StudentCtx = { user: { id: string }; workspaceId: string; studentId: string };
type TutorCtx = { user: { id: string }; workspaceId: string };

/** Candidate question versions for one rule: topic (+subtree by code prefix), difficulty, published, global or own. */
const typeList = (types: string[] | null | undefined) => (types?.length ? types.join(",") : null);

async function pickForRule(exec: Executor, workspaceId: string, studentId: string, rule: BlueprintRule, exclude: Set<string>): Promise<string[]> {
  const [topic] = await exec.select({ code: schema.topics.code }).from(schema.topics).where(eq(schema.topics.id, rule.topicId));
  if (!topic) throw new AppError("not_found");
  const like = rule.includeSubtree ? `${topic.code}.%` : topic.code;
  const found = rows<{ vid: string; seen: boolean }>(await exec.execute(sql`
    select q.current_version_id as vid,
           exists (select 1 from attempt_items ai join attempts a on a.id = ai.attempt_id
                   where a.student_id = ${studentId} and ai.question_version_id = q.current_version_id and a.started_at > now() - interval '30 days') as seen
    from questions q join question_topics qt on qt.question_id = q.id join topics t on t.id = qt.topic_id
    where (t.code = ${topic.code} or t.code like ${like}) and q.status = 'published' and q.deleted_at is null and q.current_version_id is not null
      and q.difficulty between ${rule.difficultyMin} and ${rule.difficultyMax}
      and (${typeList(rule.types)}::text is null or q.type::text = any(string_to_array(${typeList(rule.types)}, ',')))
      and (q.workspace_id is null or q.workspace_id = ${workspaceId})
    order by seen asc, random() limit ${rule.count + exclude.size + 20}`));
  const out: string[] = [];
  for (const r of found) { if (out.length >= rule.count) break; if (!exclude.has(r.vid)) { out.push(r.vid); exclude.add(r.vid); } }
  if (out.length < rule.count) throw new AppError("bank_too_small");
  return out;
}

export async function countForRule(workspaceId: string, topicId: string, dmin: number, dmax: number, types: string[] | null = null): Promise<number> {
  const db = await getDb();
  const [topic] = await db.select({ code: schema.topics.code }).from(schema.topics).where(eq(schema.topics.id, topicId));
  if (!topic) return 0;
  return rows<{ c: number }>(await db.execute(sql`select count(distinct q.id)::int c from questions q join question_topics qt on qt.question_id=q.id join topics t on t.id=qt.topic_id
    where (t.code=${topic.code} or t.code like ${topic.code + ".%"}) and q.status='published' and q.deleted_at is null and q.difficulty between ${dmin} and ${dmax} and (${typeList(types)}::text is null or q.type::text = any(string_to_array(${typeList(types)}, ','))) and (q.workspace_id is null or q.workspace_id=${workspaceId})`))[0]?.c ?? 0;
}

export async function createBlueprintAssignment(input: PracticeInput): Promise<{ assessmentId: string; assignmentId: string }> {
  const r = await createTest({ user: { id: input.createdBy ?? "" }, workspaceId: input.workspaceId }, { title: input.title, rules: input.rules, studentIds: [input.studentId], dueAt: input.dueAt ?? null, isPractice: input.isPractice ?? true, lessonId: input.lessonId ?? null, settings: { ...DEFAULT_SETTINGS, maxAttempts: 3 }, createdBy: input.createdBy });
  return { assessmentId: r.assessmentId, assignmentId: r.assignmentIds[0] };
}

export async function createTest(ctx: TutorCtx, input: { title: string; rules: BlueprintRule[]; studentIds: string[]; dueAt: Date | null; isPractice?: boolean; lessonId?: string | null; settings?: AssessmentSettings; createdBy?: string | null }) {
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const owned = await tx.select({ id: schema.students.id }).from(schema.students).where(and(eq(schema.students.workspaceId, ctx.workspaceId), inArray(schema.students.id, input.studentIds.length ? input.studentIds : ["00000000-0000-0000-0000-000000000000"])));
    if (owned.length !== input.studentIds.length) throw new AppError("forbidden");
    for (const st of owned) { const ex = new Set<string>(); for (const rule of input.rules) await pickForRule(tx, ctx.workspaceId, st.id, rule, ex); } // dry run
    const createdBy = input.createdBy === undefined ? ctx.user.id : input.createdBy;
    const [a] = await tx.insert(schema.assessments).values({ workspaceId: ctx.workspaceId, title: input.title, kind: "blueprint", status: "ready", isPractice: input.isPractice ?? false, settings: input.settings ?? DEFAULT_SETTINGS, createdBy: createdBy || null }).returning({ id: schema.assessments.id });
    await tx.insert(schema.blueprintRules).values(input.rules.map((r, i) => ({ assessmentId: a.id, topicId: r.topicId, includeSubtree: r.includeSubtree, count: r.count, difficultyMin: r.difficultyMin, difficultyMax: r.difficultyMax, types: r.types, sort: i })));
    const asg = input.studentIds.length ? await tx.insert(schema.assignments).values(input.studentIds.map((sid) => ({ workspaceId: ctx.workspaceId, assessmentId: a.id, studentId: sid, dueAt: input.dueAt, lessonId: input.lessonId ?? null, createdBy: createdBy || null }))).returning({ id: schema.assignments.id }) : [];
    return { assessmentId: a.id, assignmentIds: asg.map((x) => x.id) };
  });
  for (const id of result.assignmentIds) await notify({ kind: "assigned", assignmentId: id });
  return result;
}

export async function listForTutor(ctx: TutorCtx) {
  const db = await getDb();
  return rows<{ id: string; title: string; isPractice: boolean; createdAt: string; questions: number; assigned: number; submitted: number; avg: number | null }>(await db.execute(sql`
    select a.id, a.title, a.is_practice as "isPractice", a.created_at as "createdAt",
      (select coalesce(sum(count),0)::int from blueprint_rules br where br.assessment_id=a.id) as questions,
      (select count(*)::int from assignments s where s.assessment_id=a.id) as assigned,
      (select count(distinct at.assignment_id)::int from attempts at join assignments s on s.id=at.assignment_id where s.assessment_id=a.id and at.submitted_at is not null) as submitted,
      (select round(avg(at.percent))::int from attempts at join assignments s on s.id=at.assignment_id where s.assessment_id=a.id and at.submitted_at is not null) as avg
    from assessments a where a.workspace_id=${ctx.workspaceId} order by a.created_at desc limit 200`));
}

export async function listResultsForTutor(ctx: TutorCtx, assessmentId: string) {
  const db = await getDb();
  return rows<{ assignmentId: string; student: string; dueAt: string | null; attemptId: string | null; percent: number | null; submittedAt: string | null }>(await db.execute(sql`
    select s.id as "assignmentId", st.display_name as student, s.due_at as "dueAt", at.id as "attemptId", at.percent, at.submitted_at as "submittedAt"
    from assignments s join students st on st.id=s.student_id
    left join lateral (select * from attempts x where x.assignment_id=s.id and x.submitted_at is not null order by x.percent desc nulls last limit 1) at on true
    where s.assessment_id=${assessmentId} and s.workspace_id=${ctx.workspaceId} order by st.display_name`));
}

export async function listForStudent(ctx: StudentCtx) {
  const db = await getDb();
  return rows<{ id: string; title: string; dueAt: string | null; questions: number; isPractice: boolean; maxAttempts: number; attemptsUsed: number; inProgressId: string | null; bestPercent: number | null; bestAttemptId: string | null }>(await db.execute(sql`
    select s.id, a.title, s.due_at as "dueAt", a.is_practice as "isPractice", (a.settings->>'maxAttempts')::int as "maxAttempts",
      (select coalesce(sum(count),0)::int from blueprint_rules br where br.assessment_id=a.id) as questions,
      (select count(*)::int from attempts x where x.assignment_id=s.id) as "attemptsUsed",
      (select x.id from attempts x where x.assignment_id=s.id and x.status='in_progress' limit 1) as "inProgressId",
      (select max(x.percent) from attempts x where x.assignment_id=s.id and x.submitted_at is not null) as "bestPercent",
      (select x.id from attempts x where x.assignment_id=s.id and x.submitted_at is not null order by x.percent desc nulls last limit 1) as "bestAttemptId"
    from assignments s join assessments a on a.id=s.assessment_id
    where s.student_id=${ctx.studentId} and s.available_from <= now() order by s.created_at desc limit 100`));
}

export async function startAttempt(ctx: StudentCtx, assignmentId: string): Promise<string> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [asg] = await tx.select().from(schema.assignments).where(and(eq(schema.assignments.id, assignmentId), eq(schema.assignments.studentId, ctx.studentId)));
    if (!asg) throw new AppError("not_found");
    const [existing] = await tx.select({ id: schema.attempts.id }).from(schema.attempts).where(and(eq(schema.attempts.assignmentId, asg.id), eq(schema.attempts.status, "in_progress")));
    if (existing) return existing.id;
    if (asg.dueAt && asg.dueAt < new Date()) throw new AppError("deadline_passed");
    const [a] = await tx.select().from(schema.assessments).where(eq(schema.assessments.id, asg.assessmentId));
    const used = (await tx.select({ id: schema.attempts.id }).from(schema.attempts).where(eq(schema.attempts.assignmentId, asg.id))).length;
    if (used >= a.settings.maxAttempts) throw new AppError("attempts_exhausted");
    const rules = await tx.select().from(schema.blueprintRules).where(eq(schema.blueprintRules.assessmentId, a.id)).orderBy(schema.blueprintRules.sort);
    const ex = new Set<string>(); const versionIds: string[] = [];
    for (const r of rules) versionIds.push(...await pickForRule(tx, ctx.workspaceId, ctx.studentId, { topicId: r.topicId, includeSubtree: r.includeSubtree, count: r.count, difficultyMin: r.difficultyMin, difficultyMax: r.difficultyMax, types: r.types }, ex));
    const limit = a.settings.timeLimitMin ? new Date(Date.now() + a.settings.timeLimitMin * 60_000) : null;
    const deadlineAt = limit && asg.dueAt ? (limit < asg.dueAt ? limit : asg.dueAt) : (limit ?? asg.dueAt ?? null);
    const [att] = await tx.insert(schema.attempts).values({ workspaceId: ctx.workspaceId, assignmentId: asg.id, studentId: ctx.studentId, attemptNo: used + 1, deadlineAt }).returning({ id: schema.attempts.id });
    await tx.insert(schema.attemptItems).values(versionIds.map((vid, i) => ({ attemptId: att.id, questionVersionId: vid, sort: i })));
    return att.id;
  });
}

async function ownAttempt(exec: Executor, ctx: StudentCtx, attemptId: string) {
  const [att] = await exec.select().from(schema.attempts).where(and(eq(schema.attempts.id, attemptId), eq(schema.attempts.studentId, ctx.studentId)));
  if (!att) throw new AppError("not_found");
  return att;
}

export async function getAttemptForStudent(ctx: StudentCtx, attemptId: string) {
  const db = await getDb();
  const att = await ownAttempt(db, ctx, attemptId);
  const items = await db.select({ item: schema.attemptItems, v: schema.questionVersions, type: schema.questions.type })
    .from(schema.attemptItems).innerJoin(schema.questionVersions, eq(schema.questionVersions.id, schema.attemptItems.questionVersionId))
    .innerJoin(schema.questions, eq(schema.questions.id, schema.questionVersions.questionId))
    .where(eq(schema.attemptItems.attemptId, att.id)).orderBy(schema.attemptItems.sort);
  const [asg] = await db.select({ title: schema.assessments.title, isPractice: schema.assessments.isPractice }).from(schema.assignments).innerJoin(schema.assessments, eq(schema.assessments.id, schema.assignments.assessmentId)).where(eq(schema.assignments.id, att.assignmentId));
  const instant = Boolean(asg?.isPractice);
  const questions: (PublicQuestion & { draft: AnswerPayload | null; checked: CheckResult | null })[] = items.map((r) => ({ ...toPublic(r.v, r.type, r.item.optionOrder), draft: r.item.answer ?? null,
    // only in instant-feedback practice, and only for items the student has already locked in
    checked: instant && r.item.score !== null ? reveal(r.v, r.item.isCorrect) : null }));
  return { instant, id: att.id, title: asg?.title ?? "", status: att.status, submitted: Boolean(att.submittedAt), deadlineAt: att.deadlineAt?.toISOString() ?? null, serverNow: new Date().toISOString(), questions };
}

export type CheckResult = { isCorrect: boolean; correct: string; explanationMd: string };
function reveal(v: { options: typeof schema.questionVersions.$inferSelect.options; answer: typeof schema.questionVersions.$inferSelect.answer; explanationMd: string }, isCorrect: boolean | null): CheckResult {
  const o = v.options; const all = !o ? [] : o.kind === "choices" ? o.choices : o.kind === "ordering" ? o.items : o.kind === "matching" ? [...o.left, ...o.right] : [];
  return { isCorrect: Boolean(isCorrect), correct: describeAnswer(v.answer, (id) => all.find((x) => x.id === id)?.text ?? id), explanationMd: v.explanationMd };
}

/**
 * Instant feedback for practice sets: locks the answer for ONE item, scores it on the server and only then reveals the key.
 * Not available for assigned tests. A locked item cannot be answered again (saveAnswer rejects it).
 */
export async function checkItem(ctx: StudentCtx, attemptId: string, versionId: string, payloadRaw: unknown): Promise<CheckResult> {
  const payload = answerPayloadSchema.parse(payloadRaw);
  const db = await getDb();
  const att = await ownAttempt(db, ctx, attemptId);
  if (att.submittedAt) throw new AppError("already_submitted");
  if (att.deadlineAt && att.deadlineAt.getTime() + 5000 < Date.now()) throw new AppError("deadline_passed");
  const [a] = await db.select({ isPractice: schema.assessments.isPractice }).from(schema.assignments).innerJoin(schema.assessments, eq(schema.assessments.id, schema.assignments.assessmentId)).where(eq(schema.assignments.id, att.assignmentId));
  if (!a?.isPractice) throw new AppError("forbidden");
  const [row] = await db.select({ item: schema.attemptItems, v: schema.questionVersions, type: schema.questions.type }).from(schema.attemptItems)
    .innerJoin(schema.questionVersions, eq(schema.questionVersions.id, schema.attemptItems.questionVersionId)).innerJoin(schema.questions, eq(schema.questions.id, schema.questionVersions.questionId))
    .where(and(eq(schema.attemptItems.attemptId, att.id), eq(schema.attemptItems.questionVersionId, versionId)));
  if (!row) throw new AppError("not_found");
  if (row.item.score !== null) return reveal(row.v, row.item.isCorrect);
  if (row.type !== payload.type) throw new AppError("validation");
  const s = scoreAnswer(row.v.answer, payload, row.item.weight);
  await db.update(schema.attemptItems).set({ answer: payload, answeredAt: new Date(), score: s.score, maxScore: s.maxScore, isCorrect: s.isCorrect }).where(and(eq(schema.attemptItems.id, row.item.id), isNull(schema.attemptItems.score)));
  return reveal(row.v, s.isCorrect);
}

export async function saveAnswer(ctx: StudentCtx, attemptId: string, versionId: string, payloadRaw: unknown) {
  const payload = answerPayloadSchema.parse(payloadRaw);
  const db = await getDb();
  const att = await ownAttempt(db, ctx, attemptId);
  if (att.submittedAt) throw new AppError("already_submitted");
  if (att.deadlineAt && att.deadlineAt.getTime() + 5000 < Date.now()) throw new AppError("deadline_passed");
  const [row] = await db.select({ type: schema.questions.type }).from(schema.questionVersions).innerJoin(schema.questions, eq(schema.questions.id, schema.questionVersions.questionId)).where(eq(schema.questionVersions.id, versionId));
  if (!row || row.type !== payload.type) throw new AppError("validation");
  const upd = await db.update(schema.attemptItems).set({ answer: payload, answeredAt: new Date() }).where(and(eq(schema.attemptItems.attemptId, att.id), eq(schema.attemptItems.questionVersionId, versionId), isNull(schema.attemptItems.score))).returning({ id: schema.attemptItems.id });
  if (!upd.length) throw new AppError("conflict");
}

export async function submitAttempt(ctx: StudentCtx, attemptId: string) {
  const db = await getDb();
  const scored = await db.transaction(async (tx) => {
    await ownAttempt(tx, ctx, attemptId);
    const claimed = await tx.update(schema.attempts).set({ submittedAt: new Date(), status: "graded" }).where(and(eq(schema.attempts.id, attemptId), isNull(schema.attempts.submittedAt))).returning({ id: schema.attempts.id });
    if (!claimed.length) return false; // second submit: nothing to do, result already stored
    const items = await tx.select({ item: schema.attemptItems, answer: schema.questionVersions.answer, qid: schema.questionVersions.questionId }).from(schema.attemptItems).innerJoin(schema.questionVersions, eq(schema.questionVersions.id, schema.attemptItems.questionVersionId)).where(eq(schema.attemptItems.attemptId, attemptId));
    let total = 0, max = 0, review = false;
    for (const r of items) {
      const s = scoreAnswer(r.answer, r.item.answer, r.item.weight);
      total += s.score; max += s.maxScore; review ||= s.needsReview;
      await tx.update(schema.attemptItems).set({ score: s.score, maxScore: s.maxScore, isCorrect: s.isCorrect }).where(eq(schema.attemptItems.id, r.item.id));
      await tx.update(schema.questions).set({ answersCount: sql`${schema.questions.answersCount} + 1` }).where(eq(schema.questions.id, r.qid));
    }
    await tx.update(schema.attempts).set({ score: total, maxScore: max, percent: max ? Math.round((total / max) * 10000) / 100 : 0, status: review ? "needs_review" : "graded" }).where(eq(schema.attempts.id, attemptId));
    return true;
  });
  if (scored) { await onAttemptGraded(attemptId); await notify({ kind: "graded", attemptId }); }
}

export async function getResult(ctx: { workspaceId: string; studentId?: string | null; role: string }, attemptId: string, locale = "ru") {
  const db = await getDb();
  const [att] = await db.select().from(schema.attempts).where(eq(schema.attempts.id, attemptId));
  const tutor = ctx.role === "owner" || ctx.role === "tutor";
  if (!att || att.workspaceId !== ctx.workspaceId || (!tutor && att.studentId !== ctx.studentId)) throw new AppError("not_found");
  if (!att.submittedAt) throw new AppError("conflict");
  const [meta] = await db.select({ title: schema.assessments.title, settings: schema.assessments.settings, student: schema.students.displayName, assignmentId: schema.assignments.id })
    .from(schema.assignments).innerJoin(schema.assessments, eq(schema.assessments.id, schema.assignments.assessmentId)).innerJoin(schema.students, eq(schema.students.id, schema.assignments.studentId)).where(eq(schema.assignments.id, att.assignmentId));
  const list = await db.select({ item: schema.attemptItems, v: schema.questionVersions }).from(schema.attemptItems).innerJoin(schema.questionVersions, eq(schema.questionVersions.id, schema.attemptItems.questionVersionId)).where(eq(schema.attemptItems.attemptId, att.id)).orderBy(schema.attemptItems.sort);
  const topicRows = rows<{ vid: string; name: Record<string, string> }>(await db.execute(sql`select qv.id as vid, t.name from attempt_items ai join question_versions qv on qv.id=ai.question_version_id join question_topics qt on qt.question_id=qv.question_id and qt.is_primary join topics t on t.id=qt.topic_id where ai.attempt_id=${att.id}`));
  const topicOf = new Map(topicRows.map((r) => [r.vid, r.name[locale] ?? r.name.ru]));
  const showAnswers = tutor || meta.settings.showAnswers === "immediately";
  const items = list.map(({ item, v }) => {
    const optText = (id: string) => { const o = v.options; const all = !o ? [] : o.kind === "choices" ? o.choices : o.kind === "ordering" ? o.items : o.kind === "matching" ? [...o.left, ...o.right] : []; return all.find((x) => x.id === id)?.text ?? id; };
    const a = item.answer;
    const given = !a ? "" : a.type === "numeric" ? a.raw : a.type === "short_text" || a.type === "free_text" ? a.text : a.type === "single_choice" ? (a.choice ? optText(a.choice) : "") : a.type === "multiple_choice" ? a.choices.map(optText).join("; ") : a.type === "ordering" ? a.order.map(optText).join(" → ") : a.type === "matching" ? a.pairs.map(([l, r]) => `${optText(l)} → ${optText(r)}`).join("; ") : Object.values(a.blanks).join("; ");
    return { id: item.id, stemMd: v.stemMd, topic: topicOf.get(v.id) ?? "", given, isCorrect: item.isCorrect, score: item.score ?? 0, maxScore: item.maxScore, correct: showAnswers ? describeAnswer(v.answer, optText) : null, explanationMd: showAnswers ? v.explanationMd : null };
  });
  const byTopic = new Map<string, { ok: number; total: number }>();
  for (const i of items) { const t = byTopic.get(i.topic) ?? { ok: 0, total: 0 }; t.total += 1; if (i.isCorrect) t.ok += 1; byTopic.set(i.topic, t); }
  return { id: att.id, title: meta.title, student: meta.student, assignmentId: meta.assignmentId, percent: att.percent ?? 0, score: att.score ?? 0, maxScore: att.maxScore ?? 0, passPercent: meta.settings.passPercent, status: att.status, items, topics: [...byTopic].map(([name, v]) => ({ name, ...v })).sort((a, b) => a.ok / a.total - b.ok / b.total) };
}

export async function topicsForPicker(workspaceId: string, locale = "ru") {
  const db = await getDb();
  const list = await db.select().from(schema.topics).where(or(isNull(schema.topics.workspaceId), eq(schema.topics.workspaceId, workspaceId))).orderBy(schema.topics.grade, schema.topics.sort);
  return list.filter((t) => t.depth > 0).map((t) => ({ id: t.id, code: t.code, grade: t.grade, name: (t.name as Record<string, string>)[locale] ?? t.name.ru }));
}

export async function topicNames(ids: string[], locale = "ru"): Promise<string[]> {
  const db = await getDb();
  const list = await db.select({ id: schema.topics.id, name: schema.topics.name }).from(schema.topics).where(inArray(schema.topics.id, ids));
  return ids.map((id) => { const n = list.find((t) => t.id === id)?.name as Record<string, string> | undefined; return n?.[locale] ?? n?.ru ?? ""; }).filter(Boolean);
}

/** Topics a student may practise, with how many published questions each has and the student's own accuracy so far. */
export async function practiceTopics(ctx: StudentCtx, locale = "ru") {
  const db = await getDb();
  const list = rows<{ id: string; code: string; grade: number | null; name: Record<string, string>; isSat: boolean; bank: number; done: number; ok: number }>(await db.execute(sql`
    select t.id, t.code, t.grade, t.name, t.is_sat as "isSat",
      (select count(*)::int from question_topics qt join questions q on q.id=qt.question_id where qt.topic_id=t.id and q.status='published' and q.deleted_at is null and (q.workspace_id is null or q.workspace_id=${ctx.workspaceId})) as bank,
      (select count(*)::int from attempt_items ai join attempts a on a.id=ai.attempt_id join question_versions qv on qv.id=ai.question_version_id join question_topics qt on qt.question_id=qv.question_id where a.student_id=${ctx.studentId} and a.submitted_at is not null and qt.topic_id=t.id) as done,
      (select count(*)::int from attempt_items ai join attempts a on a.id=ai.attempt_id join question_versions qv on qv.id=ai.question_version_id join question_topics qt on qt.question_id=qv.question_id where a.student_id=${ctx.studentId} and a.submitted_at is not null and ai.is_correct and qt.topic_id=t.id) as ok
    from topics t where t.depth > 0 and (t.workspace_id is null or t.workspace_id=${ctx.workspaceId}) order by t.is_sat, t.grade, t.sort`));
  return list.filter((t) => t.bank >= 3).map((t) => ({ id: t.id, grade: t.grade, isSat: t.isSat, name: t.name[locale] ?? t.name.ru, bank: t.bank, done: t.done, percent: t.done ? Math.round((t.ok / t.done) * 100) : null }));
}
