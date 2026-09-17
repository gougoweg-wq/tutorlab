import "server-only";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { summarize, satSectionScore, type Status } from "./model";
import { TIMEZONE } from "./config";

export type TopicMastery = { topicId: string; code: string; name: string; grade: number | null; isSat: boolean; parentId: string | null; depth: number; n: number; mastery: number; ciLow: number; ciHigh: number; status: Status; forgetting: boolean; ageDays: number; due: boolean };

export async function getStudentMastery(studentId: string, locale = "ru", now = new Date()) {
  const db = await getDb();
  const list = rows<{ topicId: string; code: string; name: Record<string, string>; grade: number | null; isSat: boolean; parentId: string | null; depth: number; theta: number; n: number; lastAt: string | null; dueAt: string | null }>(await db.execute(sql`
    select m.topic_id as "topicId", t.code, t.name, t.grade, t.is_sat as "isSat", t.parent_id as "parentId", t.depth, m.theta, m.n_attempts as n, m.last_attempt_at as "lastAt", rs.due_at as "dueAt"
    from mastery m join topics t on t.id = m.topic_id left join review_schedule rs on rs.student_id = m.student_id and rs.topic_id = m.topic_id
    where m.student_id = ${studentId} order by t.is_sat, t.grade, t.sort`));
  const topics: TopicMastery[] = list.map((r) => { const s = summarize(Number(r.theta), r.n, r.lastAt ? new Date(r.lastAt) : null, now);
    return { topicId: r.topicId, code: r.code, name: r.name[locale] ?? r.name.ru, grade: r.grade, isSat: r.isSat, parentId: r.parentId, depth: r.depth, n: r.n, mastery: s.mastery, ciLow: s.ciLow, ciHigh: s.ciHigh, status: s.status, forgetting: s.forgetting, ageDays: Math.floor(s.ageDays), due: Boolean(r.dueAt && new Date(r.dueAt) <= now) }; });
  const leaves = topics.filter((t) => t.depth > 0);
  const weak = leaves.filter((t) => t.status === "weak").sort((a, b) => a.ciHigh - b.ciHigh).slice(0, 5);
  const strong = leaves.filter((t) => t.status === "strong").sort((a, b) => b.ciLow - a.ciLow).slice(0, 5);
  const review = leaves.filter((t) => t.forgetting || (t.due && t.status !== "weak")).sort((a, b) => b.ageDays - a.ageDays).slice(0, 5);
  const totalN = leaves.reduce((s, t) => s + t.n, 0);
  const overall = totalN ? Math.round(leaves.reduce((s, t) => s + t.mastery * t.n, 0) / totalN) : null;
  const next = weak[0] ?? leaves.filter((t) => t.status === "in_progress").sort((a, b) => a.mastery - b.mastery)[0] ?? review[0] ?? null;
  const sat = satSectionScore(leaves.filter((t) => t.isSat).map((t) => ({ code: t.code, mastery: t.mastery, n: t.n })), "math");
  const days = rows<{ day: string }>(await db.execute(sql`select to_char(day, 'YYYY-MM-DD') as day from activity_days where student_id = ${studentId} order by day desc limit 60`)).map((d) => d.day);
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(d);
  let streak = 0; const cursor = new Date(now);
  if (!days.includes(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.includes(fmt(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - (6 - i)); return days.includes(fmt(d)); });
  return { topics: leaves, weak, strong, review, overall, next, sat, streak, week, answered: totalN };
}
