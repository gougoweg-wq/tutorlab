import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Flame, Map as MapIcon, Target } from "lucide-react";
import { getStudentMastery, type TopicMastery } from "@/modules/mastery/queries";
import { MASTERY } from "@/modules/mastery/config";
import { Card, Stat } from "@/ui/card";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/states";
import { cn } from "@/ui/cn";
import { LineChart } from "@/ui/charts/line-chart";

const tone = { weak: "bg-bad-soft text-bad-text", strong: "bg-ok-soft text-ok-text", in_progress: "bg-warn-soft text-warn-text", low_data: "bg-surface-2 text-muted border border-dashed border-line-strong" } as const;
const bar = { weak: "bg-bad", strong: "bg-ok", in_progress: "bg-warn", low_data: "bg-faint" } as const;

/** Mastery map shared by the student's Progress page and the tutor's student page. */
export async function MasteryView({ studentId, forStudent }: { studentId: string; forStudent: boolean }) {
  const t = await getTranslations("progress"); const c = await getTranslations("common");
  const locale = await getLocale();
  const m = await getStudentMastery(studentId, locale);
  if (!m.topics.length) return <Card className="rise"><EmptyState icon={<MapIcon />} title={t("emptyTitle")} text={t("emptyText")} action={forStudent ? <Button asChild><Link href="/student/practice">{t("emptyGo")}</Link></Button> : undefined} /></Card>;
  const groups = new Map<string, TopicMastery[]>();
  for (const x of m.topics) { const k = x.isSat ? t("sat_group") : c("grade", { grade: x.grade ?? 0 }); groups.set(k, [...(groups.get(k) ?? []), x]); }
  const List = ({ title, items }: { title: string; items: TopicMastery[] }) => (
    <Card className="p-6"><h3 className="t-h3 mb-3">{title}</h3>
      {!items.length ? <p className="t-small text-muted">{t("none")}</p> : <ul className="space-y-3">{items.map((x) => (
        <li key={x.topicId}><div className="flex justify-between gap-3 text-[15px]"><span>{x.name}</span><span className="tnum text-muted">{x.mastery}</span></div>
          <div className="mt-1.5 h-1.5 rounded-full bg-surface-3 overflow-hidden"><div className={cn("h-full rounded-full", bar[x.status])} style={{ width: `${x.mastery}%` }} /></div>
          {x.ageDays > 0 && <div className="t-caption mt-1">{t("ago", { n: x.ageDays })}</div>}</li>))}</ul>}
    </Card>);
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 rise">
        <Stat label={t("overall")} value={m.overall ?? "—"} tone={m.overall === null ? undefined : m.overall >= 75 ? "ok" : m.overall >= 55 ? "warn" : "bad"} />
        <Stat label={t("answered")} value={m.answered} />
        <Stat label={t("streak")} value={<span className="inline-flex items-center gap-2">{m.streak}<Flame className={cn("size-6", m.streak ? "text-warn" : "text-faint")} aria-hidden /></span>}
          sub={<span className="inline-flex gap-1.5" aria-hidden>{m.week.map((on, i) => <span key={i} className={cn("size-2 rounded-full", on ? "bg-warn" : "bg-surface-3")} />)}</span>} />
        {m.sat ? <Stat label={t("sat")} value={m.sat.score} sub={t("satNote", { n: m.sat.margin })} /> : <Stat label={t("weak")} value={m.topics.filter((x) => x.status === "weak").length} />}
      </div>
      {m.next && (
        <section className="mt-8 rise rounded-xl bg-accent-soft p-6 sm:p-8 flex flex-wrap items-center gap-5" style={{ "--i": 1 } as React.CSSProperties}>
          <span className="grid place-items-center size-12 rounded-full bg-accent text-accent-ink"><Target className="size-5" /></span>
          <div className="flex-1 min-w-[200px]"><div className="t-eyebrow text-accent-text">{t("next")}</div><div className="t-h2 mt-0.5">{m.next.topic.name}</div><div className="t-small text-muted mt-0.5">{m.next.reason === "prerequisite" ? t("reason_prerequisite", { topic: m.next.unlocks ?? "" }) : t(`reason_${m.next.reason}`)} · {m.next.topic.mastery}</div></div>
          {forStudent && <Button asChild size="lg"><Link href="/student/practice">{t("nextGo")}</Link></Button>}
        </section>)}
      {m.timeline.length > 0 && (
        <section className="mt-10 rise" style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className="t-h2 mb-4">{t("timeline")}</h2>
          <Card className="p-5 sm:p-6"><LineChart label={t("timeline")} yLabel={t("timelineY")} points={m.timeline.map((w) => ({ x: new Date(w.week).toLocaleDateString(locale, { day: "numeric", month: "short" }), y: w.percent, hint: c("questionsCount", { n: w.n }) }))} /></Card>
        </section>)}
      <section className="mt-10 rise" style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className="t-h2">{t("map")}</h2><p className="t-small text-muted mt-1 mb-5">{t("legend")}</p>
        <div className="space-y-6">{[...groups].map(([name, items]) => (
          <div key={name}><div className="t-eyebrow mb-2.5">{name}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">{items.map((x) => (
              <div key={x.topicId} className={cn("rounded-lg px-3.5 py-3 min-h-[84px] flex flex-col justify-between transition-transform duration-300 ease-apple hover:-translate-y-0.5", tone[x.status])}>
                <div className="text-[13.5px] leading-snug font-medium text-ink">{x.name}</div>
                <div className="flex items-end justify-between gap-2 mt-2"><span className="text-[22px] font-bold tracking-[-0.03em] tnum leading-none">{x.status === "low_data" ? "·" : x.mastery}</span>
                  <span className="text-[11px] font-medium">{x.status === "low_data" ? t("lowHint", { n: MASTERY.minN - x.n }) : t(`status_${x.status}`)}</span></div>
              </div>))}</div></div>))}</div>
      </section>
      <section className="mt-10 grid md:grid-cols-3 gap-4 rise" style={{ "--i": 3 } as React.CSSProperties}>
        <List title={t("weak")} items={m.weak} /><List title={t("review")} items={m.review} /><List title={t("strong")} items={m.strong} />
      </section>
    </div>
  );
}
