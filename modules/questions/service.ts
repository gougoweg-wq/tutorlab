import "server-only";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { describeAnswer } from "./scoring";
import type { QuestionAnswer, QuestionOptions } from "./types";

export type BankFilters = { q?: string; topicId?: string; type?: string; difficulty?: number; scope?: "all" | "own" | "global"; page?: number };
export const PAGE = 30;

/** Tutor-side bank search: global bank + own workspace, newest own questions first. */
export async function searchBank(workspaceId: string, f: BankFilters, locale = "ru") {
  const db = await getDb();
  const q = f.q?.trim() ? `%${f.q.trim().toLowerCase()}%` : null; const page = Math.max(1, f.page ?? 1);
  const scope = f.scope ?? "all";
  const where = sql`q.deleted_at is null and q.status = 'published' and q.current_version_id is not null
    and (${scope} = 'all' and (q.workspace_id is null or q.workspace_id = ${workspaceId}) or ${scope} = 'own' and q.workspace_id = ${workspaceId} or ${scope} = 'global' and q.workspace_id is null)
    and (${f.type ?? null}::text is null or q.type::text = ${f.type ?? null})
    and (${f.difficulty ?? null}::int is null or q.difficulty = ${f.difficulty ?? null})
    and (${f.topicId ?? null}::uuid is null or exists (select 1 from question_topics qt where qt.question_id = q.id and qt.topic_id = ${f.topicId ?? null}::uuid))
    and (${q}::text is null or q.content_hash like ${q} or lower(v.stem_md) like ${q})`;
  const total = rows<{ c: number }>(await db.execute(sql`select count(*)::int c from questions q join question_versions v on v.id = q.current_version_id where ${where}`))[0].c;
  const list = rows<{ id: string; type: string; difficulty: number; own: boolean; stemMd: string; options: QuestionOptions | null; answer: QuestionAnswer; explanationMd: string; topic: Record<string, string> | null; used: number }>(await db.execute(sql`
    select q.id, q.type, q.difficulty, (q.workspace_id is not null) as own, v.stem_md as "stemMd", v.options, v.answer, v.explanation_md as "explanationMd", q.answers_count as used,
      (select t.name from question_topics qt join topics t on t.id = qt.topic_id where qt.question_id = q.id and qt.is_primary limit 1) as topic
    from questions q join question_versions v on v.id = q.current_version_id where ${where}
    order by (q.workspace_id is not null) desc, q.created_at desc, q.id limit ${PAGE} offset ${(page - 1) * PAGE}`));
  return { total, page, pages: Math.max(1, Math.ceil(total / PAGE)), items: list.map((r) => {
    const opts = r.options?.kind === "choices" ? r.options.choices : [];
    return { id: r.id, type: r.type, difficulty: r.difficulty, own: r.own, used: r.used, stemMd: r.stemMd, explanationMd: r.explanationMd, topic: r.topic?.[locale] ?? r.topic?.ru ?? "", choices: opts, correct: describeAnswer(r.answer, (id) => opts.find((o) => o.id === id)?.text ?? id), correctId: r.answer.type === "single_choice" ? r.answer.correct : null };
  }) };
}
