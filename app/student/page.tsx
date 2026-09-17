import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Dumbbell, Flame, Inbox, Video } from "lucide-react";
import { requireStudentPage } from "@/modules/auth/context";
import { listForStudent } from "@/modules/assessments/service";
import { upcomingForStudent } from "@/modules/lessons/service";
import { todayStats } from "@/modules/mastery/queries";
import { Card } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/states";
import { StartButton } from "@/modules/assessments/ui/start-button";

export default async function StudentToday() {
  const ctx = await requireStudentPage();
  const t = await getTranslations("attempt"); const c = await getTranslations("common"); const f = await getFormatter();
  const list = await listForStudent(ctx);
  const tl = await getTranslations("lessons"); const lessons = await upcomingForStudent(ctx.studentId);
  const stats = await todayStats(ctx.studentId);
  const now = Date.now(); const C = 2 * Math.PI * 34; const share = Math.min(1, stats.today / stats.goal);
  const todo = list.filter((a) => a.bestPercent === null || a.inProgressId);
  const done = list.filter((a) => a.bestPercent !== null && !a.inProgressId);
  return (
    <div>
      <header className="mb-8 rise"><h1 className="t-display">{t("todayTitle", { name: ctx.user.name.split(" ")[0] })}</h1><p className="t-lead mt-2">{t("todayLead")}</p></header>
      <section className="mb-10 grid sm:grid-cols-[1.3fr_1fr] gap-3 rise" style={{ "--i": 1 } as React.CSSProperties}>
        <Card className="p-6 flex items-center gap-5">
          <div className="relative size-[84px] shrink-0" role="img" aria-label={t("goalAria", { n: stats.today, goal: stats.goal })}>
            <svg viewBox="0 0 80 80" className="size-full -rotate-90"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface-3)" strokeWidth="8" /><circle cx="40" cy="40" r="34" fill="none" stroke={share >= 1 ? "var(--ok)" : "var(--accent)"} strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - share)} style={{ transition: "stroke-dashoffset 1s var(--ease)" }} /></svg>
            <div className="absolute inset-0 grid place-items-center text-[20px] font-bold tnum">{stats.today}</div></div>
          <div className="flex-1 min-w-0"><div className="t-h3">{share >= 1 ? t("goalDone") : t("goalTitle", { n: stats.goal - stats.today })}</div><p className="t-small text-muted mt-0.5">{t("goalText", { goal: stats.goal })}</p>
            <Button asChild size="sm" className="mt-3"><Link href="/student/practice"><Dumbbell />{t("goalGo")}</Link></Button></div>
        </Card>
        <Card className="p-6"><div className="flex items-center gap-2"><Flame className={stats.streak ? "size-6 text-warn" : "size-6 text-faint"} aria-hidden /><span className="text-[28px] font-bold leading-none tnum">{stats.streak}</span><span className="t-small text-muted">{t("streakDays")}</span></div>
          <div className="mt-4 flex justify-between" aria-hidden>{stats.week.map((d, i) => <div key={i} className="flex flex-col items-center gap-1.5"><span className={d.on ? "size-7 rounded-full bg-warn grid place-items-center" : "size-7 rounded-full bg-surface-3"} /><span className="t-caption uppercase">{d.label}</span></div>)}</div>
        </Card>
      </section>
      {!!lessons.length && <section className="mb-10 rise"><h2 className="t-h2 mb-4">{tl("studentTitle")}</h2><div className="grid gap-3 sm:grid-cols-2">{lessons.map((l) => (
        <Card key={l.id} className="p-5"><div className="text-[17px] font-semibold tnum">{f.dateTime(new Date(l.startsAt), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
          <div className="mt-1 t-small text-muted">{l.topics.join(", ") || `${l.durationMin} ${tl("min")}`}</div>
          {l.callUrl && <a href={l.callUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[14px] text-accent-text hover:underline"><Video className="size-4" />{tl("join")}</a>}</Card>))}</div></section>}
      {!list.length && <Card className="rise"><EmptyState icon={<Inbox />} title={t("emptyTitle")} text={t("emptyText")} /></Card>}
      {!!todo.length && <section className="mb-10"><h2 className="t-h2 mb-4">{t("todo")}</h2><div className="grid gap-3">{todo.map((a, i) => { const overdue = a.dueAt && new Date(a.dueAt).getTime() < now; return (
        <Card key={a.id} interactive className="p-5 sm:p-6 flex flex-wrap items-center gap-4 rise" style={{ "--i": i } as React.CSSProperties}>
          <div className="flex-1 min-w-[200px]"><div className="t-h3">{a.title}</div><div className="mt-1.5 flex flex-wrap items-center gap-2 t-small text-muted">{c("questionsCount", { n: a.questions })}
            {a.dueAt && <Badge tone={overdue ? "bad" : new Date(a.dueAt).getTime() - now < 86_400_000 ? "warn" : "neutral"}>{overdue ? t("overdue") : t("due", { date: f.dateTime(new Date(a.dueAt), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}</Badge>}</div></div>
          {!overdue || a.inProgressId ? <StartButton assignmentId={a.id} label={t(a.inProgressId ? "resume" : "start")} /> : null}
        </Card>); })}</div></section>}
      {!!done.length && <section><h2 className="t-h2 mb-4">{t("done")}</h2><div className="grid gap-3">{done.map((a) => (
        <Card key={a.id} className="p-5 sm:p-6 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]"><div className="t-h3">{a.title}</div><div className="mt-1.5 t-small text-muted">{c("questionsCount", { n: a.questions })}</div></div>
          <Badge tone={(a.bestPercent ?? 0) >= 80 ? "ok" : (a.bestPercent ?? 0) >= 60 ? "warn" : "bad"} className="h-8 px-3.5 text-[14px] tnum">{Math.round(a.bestPercent ?? 0)}%</Badge>
          {a.attemptsUsed < a.maxAttempts && <StartButton assignmentId={a.id} label={t("again")} variant="secondary" />}
          {a.bestAttemptId && <Button asChild variant="ghost"><Link href={`/student/attempt/${a.bestAttemptId}/result`}>{t("review")}</Link></Button>}
        </Card>))}</div></section>}
    </div>
  );
}
