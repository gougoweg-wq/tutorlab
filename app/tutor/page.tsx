import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { count, eq, isNull, or, and, sql } from "drizzle-orm";
import { requireTutorPage } from "@/modules/auth/context";
import { withUser, getDb, rows, schema } from "@/db/client";
import { Badge } from "@/ui/badge";
import { PageHeader, Section } from "@/ui/page";
import { Card, Stat } from "@/ui/card";

export default async function TutorHome() {
  const ctx = await requireTutorPage();
  const t = await getTranslations("dashboard");
  const n = await withUser(ctx.user.id, async (tx) => {
    const one = async (q: Promise<{ c: number }[]>) => (await q)[0]?.c ?? 0;
    return {
      students: await one(tx.select({ c: count() }).from(schema.students).where(eq(schema.students.workspaceId, ctx.workspaceId))),
      assessments: await one(tx.select({ c: count() }).from(schema.assessments).where(eq(schema.assessments.workspaceId, ctx.workspaceId))),
      attempts: await one(tx.select({ c: count() }).from(schema.attempts).where(and(eq(schema.attempts.workspaceId, ctx.workspaceId), eq(schema.attempts.status, "graded")))),
      bank: await one(tx.select({ c: count() }).from(schema.questions).where(or(isNull(schema.questions.workspaceId), eq(schema.questions.workspaceId, ctx.workspaceId)))),
    };
  });
  const db = await getDb();
  const recent = rows<{ attemptId: string; student: string; title: string; percent: number; at: string }>(await db.execute(sql`select a.id as "attemptId", st.display_name as student, x.title, a.percent, a.submitted_at as at from attempts a join students st on st.id = a.student_id join assignments s on s.id = a.assignment_id join assessments x on x.id = s.assessment_id where a.workspace_id = ${ctx.workspaceId} and a.submitted_at is not null order by a.submitted_at desc limit 8`));
  const attention = rows<{ id: string; name: string; overdue: number; avg: number | null; idle: number | null }>(await db.execute(sql`
    select st.id, st.display_name as name,
      (select count(*)::int from assignments s where s.student_id = st.id and s.due_at < now() and not exists (select 1 from attempts a where a.assignment_id = s.id and a.submitted_at is not null)) as overdue,
      (select round(avg(a.percent))::int from attempts a where a.student_id = st.id and a.submitted_at > now() - interval '14 days') as avg,
      (select extract(day from now() - max(a.submitted_at))::int from attempts a where a.student_id = st.id) as idle
    from students st where st.workspace_id = ${ctx.workspaceId} and st.archived_at is null`)).filter((r) => r.overdue > 0 || (r.avg !== null && r.avg < 60) || (r.idle !== null && r.idle >= 7)).slice(0, 6);
  const steps = [t("step1"), t("step2"), t("step3")];
  return (
    <div>
      <PageHeader title={t("title")} lead={t("lead", { workspace: ctx.workspaceName })} />
      <Section i={1}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label={t("students")} value={n.students} /><Stat label={t("assessments")} value={n.assessments} />
          <Stat label={t("attempts")} value={n.attempts} /><Stat label={t("bank")} value={n.bank.toLocaleString("ru-RU")} />
        </div>
      </Section>
      {!!attention.length && <Section title={t("attention")} i={2}><div className="grid md:grid-cols-2 gap-3">{attention.map((r) => (
        <Link key={r.id} href={`/tutor/students/${r.id}`}><Card interactive className="p-5 flex flex-wrap items-center gap-2"><span className="font-semibold mr-auto">{r.name}</span>
          {r.overdue > 0 && <Badge tone="bad">{t("overdue", { n: r.overdue })}</Badge>}{r.avg !== null && r.avg < 60 && <Badge tone="warn">{t("lowAvg", { n: r.avg })}</Badge>}{r.idle !== null && r.idle >= 7 && <Badge>{t("idle", { n: r.idle })}</Badge>}</Card></Link>))}</div></Section>}
      {!!recent.length && <Section title={t("recent")} i={3}><Card className="divide-y divide-line">{recent.map((r) => (
        <Link key={r.attemptId} href={`/tutor/assessments/attempts/${r.attemptId}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2 first:rounded-t-lg last:rounded-b-lg">
          <span className="font-medium w-40 truncate">{r.student}</span><span className="flex-1 truncate text-muted">{r.title}</span><Badge tone={r.percent >= 80 ? "ok" : r.percent >= 60 ? "warn" : "bad"} className="tnum">{Math.round(r.percent)}%</Badge></Link>))}</Card></Section>}
      {!n.students && <Section title={t("firstTitle")} i={2}>
        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <Card key={s} className="p-6"><div className="grid place-items-center size-9 rounded-full bg-accent-soft text-accent-text font-semibold tnum">{i + 1}</div><p className="mt-4 t-h3 text-balance">{s}</p></Card>
          ))}
        </div>
      </Section>}
    </div>
  );
}
