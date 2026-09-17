import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, Video } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { requireTutorPage } from "@/modules/auth/context";
import { withUser, schema } from "@/db/client";
import { listLessons } from "@/modules/lessons/service";
import { topicsForPicker } from "@/modules/assessments/service";
import { PageHeader } from "@/ui/page";
import { Card } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { EmptyState } from "@/ui/states";
import { RichText } from "@/ui/rich-text";
import { NewLesson, LessonActions } from "@/modules/lessons/ui/lesson-ui";
import { cn } from "@/ui/cn";

export default async function LessonsPage() {
  const ctx = await requireTutorPage(); const locale = await getLocale();
  const t = await getTranslations("lessons"); const f = await getFormatter();
  const [lessons, topics, students] = await Promise.all([listLessons(ctx, locale), topicsForPicker(ctx.workspaceId, locale),
    withUser(ctx.user.id, (tx) => tx.select({ id: schema.students.id, name: schema.students.displayName }).from(schema.students).where(eq(schema.students.workspaceId, ctx.workspaceId)).orderBy(asc(schema.students.displayName)))]);
  const now = Date.now();
  const upcoming = lessons.filter((l) => new Date(l.startsAt).getTime() + l.durationMin * 60000 >= now && l.status === "planned").reverse();
  const past = lessons.filter((l) => !upcoming.includes(l));
  const create = <NewLesson topics={topics} students={students} />;
  const Row = ({ l }: { l: (typeof lessons)[number] }) => { const d = new Date(l.startsAt); return (
    <Card className={cn("p-5 sm:p-6 grid sm:grid-cols-[92px_1fr_auto] gap-4 items-start", l.status === "cancelled" && "opacity-60")}>
      <div><div className="text-[28px] font-bold leading-none tracking-[-0.03em] tnum">{f.dateTime(d, { day: "numeric" })}</div><div className="t-caption mt-1">{f.dateTime(d, { month: "short", weekday: "short" })}</div><div className="mt-2 text-[15px] font-semibold tnum">{f.dateTime(d, { hour: "2-digit", minute: "2-digit" })}</div></div>
      <div className="min-w-0"><div className="t-h3">{l.students.map((s) => s.name).join(", ")}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">{l.topics.map((n) => <Badge key={n} tone="accent">{n}</Badge>)}<Badge>{l.durationMin} {t("min")}</Badge>
          {l.status === "done" && <Badge tone="ok">{t("done")}</Badge>}{l.status === "cancelled" && <Badge tone="bad">{t("cancelled")}</Badge>}{l.homework && <Badge tone="ok">{t("homeworkSet")}</Badge>}</div>
        {l.noteMd && <RichText className="mt-3 text-[15px] text-ink-2">{l.noteMd}</RichText>}
        {l.callUrl && <a href={l.callUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[14px] text-accent-text hover:underline"><Video className="size-4" />{t("join")}</a>}</div>
      <LessonActions id={l.id} status={l.status} hasTopics={l.topics.length > 0} homework={l.homework} defaultTitle={`${t("hwPrefix")}: ${l.topics.slice(0, 2).join(", ")}`} />
    </Card>); };
  return (
    <div>
      <PageHeader title={t("title")} lead={t("lead")} actions={create} />
      {!lessons.length ? <Card className="rise"><EmptyState icon={<CalendarDays />} title={t("emptyTitle")} text={t("emptyText")} action={create} /></Card> : (<>
        <section className="rise"><h2 className="t-h2 mb-4">{t("upcoming")}</h2><div className="space-y-3">{upcoming.length ? upcoming.map((l) => <Row key={l.id} l={l} />) : <p className="text-muted">{t("noUpcoming")}</p>}</div></section>
        {!!past.length && <section className="mt-10 rise" style={{ "--i": 1 } as React.CSSProperties}><h2 className="t-h2 mb-4">{t("past")}</h2><div className="space-y-3">{past.map((l) => <Row key={l.id} l={l} />)}</div></section>}</>)}
    </div>
  );
}
