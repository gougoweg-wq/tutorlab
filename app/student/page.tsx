import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Inbox, Video } from "lucide-react";
import { requireStudentPage } from "@/modules/auth/context";
import { listForStudent } from "@/modules/assessments/service";
import { upcomingForStudent } from "@/modules/lessons/service";
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
  const now = Date.now();
  const todo = list.filter((a) => a.bestPercent === null || a.inProgressId);
  const done = list.filter((a) => a.bestPercent !== null && !a.inProgressId);
  return (
    <div>
      <header className="mb-8 rise"><h1 className="t-display">{t("todayTitle", { name: ctx.user.name.split(" ")[0] })}</h1><p className="t-lead mt-2">{t("todayLead")}</p></header>
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
