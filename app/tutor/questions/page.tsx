import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Library } from "lucide-react";
import { requireTutorPage } from "@/modules/auth/context";
import { searchBank } from "@/modules/questions/service";
import { topicsForPicker } from "@/modules/assessments/service";
import { PageHeader } from "@/ui/page";
import { Card } from "@/ui/card";
import { Badge, Difficulty } from "@/ui/badge";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/states";
import { RichText } from "@/ui/rich-text";
import { BankFilters } from "@/modules/questions/ui/bank-filters";
import { NewQuestion, DeleteQuestion } from "@/modules/questions/ui/new-question";
import { cn } from "@/ui/cn";

export default async function BankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const ctx = await requireTutorPage(); const locale = await getLocale();
  const t = await getTranslations("questions");
  const [topics, res] = await Promise.all([topicsForPicker(ctx.workspaceId, locale), searchBank(ctx.workspaceId, { q: sp.q, topicId: sp.topic, type: sp.type, difficulty: sp.d ? Number(sp.d) : undefined, scope: (sp.scope as "own" | "global" | undefined) ?? "all", page: sp.page ? Number(sp.page) : 1 }, locale)]);
  const link = (page: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v) as [string, string][]), page: String(page) })}`;
  return (
    <div>
      <PageHeader title={t("title")} lead={t("lead", { n: res.total.toLocaleString("ru-RU") })} actions={<NewQuestion topics={topics} />} />
      <BankFilters topics={topics} />
      <div className="mt-5 space-y-3">
        {!res.items.length && <Card><EmptyState icon={<Library />} title={t("emptyTitle")} text={t("emptyText")} /></Card>}
        {res.items.map((q) => (
          <Card key={q.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3"><Badge tone="accent">{t(`type_${q.type}`)}</Badge><Badge>{q.topic}</Badge><Difficulty value={q.difficulty} className="ml-1" />{q.own && <Badge tone="ok">{t("own")}</Badge>}
              <span className="ml-auto t-caption tnum">{t("used", { n: q.used })}</span>{q.own && <DeleteQuestion id={q.id} />}</div>
            <RichText className="text-[17px]">{q.stemMd}</RichText>
            {!!q.choices.length && <ul className="mt-3 grid sm:grid-cols-2 gap-1.5">{q.choices.map((o) => <li key={o.id} className={cn("flex gap-2.5 items-baseline rounded-md px-3 py-1.5 text-[15px]", o.id === q.correctId ? "bg-ok-soft text-ok-text font-medium" : "bg-surface-2")}><span className="uppercase text-[12px] font-semibold opacity-70">{o.id}</span><RichText>{o.text}</RichText></li>)}</ul>}
            <details className="mt-3 group"><summary className="cursor-pointer text-[14px] text-accent-text select-none">{t("showAnswer")}</summary>
              <div className="mt-2 rounded-md bg-surface-2 px-4 py-3 text-[15px]"><span className="t-caption">{t("answer")}: </span><span className="font-mono font-medium">{q.correct}</span>{q.explanationMd && <RichText className="mt-2 text-ink-2">{q.explanationMd}</RichText>}</div></details>
          </Card>))}
      </div>
      {res.pages > 1 && <nav className="mt-6 flex items-center justify-center gap-3" aria-label={t("pages")}>
        <Button asChild variant="secondary" size="sm" className={cn(res.page <= 1 && "pointer-events-none opacity-40")}><Link href={link(res.page - 1)}>‹</Link></Button>
        <span className="t-small text-muted tnum">{res.page} / {res.pages}</span>
        <Button asChild variant="secondary" size="sm" className={cn(res.page >= res.pages && "pointer-events-none opacity-40")}><Link href={link(res.page + 1)}>›</Link></Button></nav>}
    </div>
  );
}
