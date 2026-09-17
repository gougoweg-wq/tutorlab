"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, TrendingDown, TrendingUp, X } from "lucide-react";
import { Card } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { ProgressBar } from "@/ui/states";
import { Segmented } from "@/ui/tabs";
import { cn } from "@/ui/cn";

export type ResultData = { title: string; student: string; percent: number; passPercent: number; gains: { name: string; delta: number }[]; items: { id: string; stemHtml: string; explanationHtml: string | null; topic: string; given: string; isCorrect: boolean | null; correct: string | null }[]; topics: { name: string; ok: number; total: number }[] };

function Ring({ value }: { value: number }) {
  const r = 54, c = 2 * Math.PI * r; const [v, setV] = React.useState(0);
  React.useEffect(() => { const id = requestAnimationFrame(() => setV(value)); return () => cancelAnimationFrame(id); }, [value]);
  const tone = value >= 80 ? "var(--ok)" : value >= 60 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="relative size-[148px]" role="img" aria-label={`${Math.round(value)}%`}>
      <svg viewBox="0 0 128 128" className="size-full -rotate-90"><circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={tone} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset 1.2s var(--ease)" }} /></svg>
      <div className="absolute inset-0 grid place-items-center text-[36px] font-bold tracking-[-0.04em] tnum">{Math.round(value)}<span className="text-[18px] text-muted">%</span></div>
    </div>
  );
}

/** A short, tasteful burst for a strong result. Pure CSS, skipped entirely under prefers-reduced-motion. */
function Confetti() {
  const pieces = React.useMemo(() => Array.from({ length: 28 }, (_, i) => ({ i, x: (i * 37) % 100, d: (i * 53) % 40, r: (i * 71) % 360, c: ["var(--accent)", "var(--ok)", "var(--warn)", "var(--bad)"][i % 4] })), []);
  return (<div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0 motion-reduce:hidden">
    <style>{`@keyframes tl-fall{0%{transform:translate3d(0,-20px,0) rotate(0);opacity:0}12%{opacity:1}100%{transform:translate3d(var(--dx),340px,0) rotate(var(--rot));opacity:0}}`}</style>
    {pieces.map((p) => <span key={p.i} className="absolute top-0 block w-[7px] h-[12px] rounded-[2px]" style={{ left: `${p.x}%`, background: p.c, ["--dx" as string]: `${(p.i % 2 ? 1 : -1) * (20 + p.d)}px`, ["--rot" as string]: `${p.r + 360}deg`, animation: `tl-fall ${1.5 + p.d / 40}s var(--ease) ${p.d * 12}ms both` }} />)}
  </div>);
}

export function ResultView({ data, footer }: { data: ResultData; footer?: React.ReactNode }) {
  const t = useTranslations("attempt");
  const [filter, setFilter] = React.useState<"all" | "wrong">("all");
  const ok = data.items.filter((i) => i.isCorrect).length;
  const shown = data.items.map((it, n) => ({ it, n })).filter(({ it }) => filter === "all" || !it.isCorrect);
  return (
    <div>
      <Card className="relative overflow-hidden p-7 sm:p-9 flex flex-col sm:flex-row items-center gap-7 rise">
        {data.percent >= 80 && <Confetti />}
        <Ring value={data.percent} />
        <div className="text-center sm:text-left">
          <div className="t-eyebrow">{t("resultTitle")}</div>
          <h1 className="t-title mt-1">{data.title}</h1>
          <p className="mt-2 text-muted">{t("correctOf", { ok, total: data.items.length })}</p>
          <Badge className="mt-3" tone={data.percent >= data.passPercent ? "ok" : "bad"}>{t(data.percent >= data.passPercent ? "passed" : "failed")}</Badge>
        </div>
      </Card>
      {!!data.gains.length && (
        <section className="mt-8 rise" style={{ "--i": 1 } as React.CSSProperties}>
          <h2 className="t-h2 mb-4">{t("gains")}</h2>
          <div className="flex flex-wrap gap-2">{data.gains.map((g, k) => (
            <span key={g.name} className={cn("pop inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[14px] font-medium", g.delta > 0 ? "bg-ok-soft text-ok-text" : "bg-bad-soft text-bad-text")} style={{ animationDelay: `${300 + k * 90}ms` }}>
              {g.delta > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}{g.name}<span className="tnum font-bold">{g.delta > 0 ? "+" : "−"}{Math.abs(g.delta)}</span></span>))}</div>
        </section>)}
      <section className="mt-8 rise" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="t-h2 mb-4">{t("byTopic")}</h2>
        <Card className="p-6 space-y-4">{data.topics.map((tp) => { const p = (tp.ok / tp.total) * 100; return (
          <div key={tp.name}><div className="flex justify-between gap-4 text-[15px] mb-1.5"><span>{tp.name}</span><span className="tnum text-muted">{tp.ok}/{tp.total}</span></div><ProgressBar value={p} tone={p >= 80 ? "ok" : p >= 60 ? "warn" : "bad"} label={tp.name} /></div>); })}</Card>
      </section>
      <section className="mt-8 rise" style={{ "--i": 2 } as React.CSSProperties}>
        <div className="flex items-center justify-between gap-4 mb-4"><h2 className="t-h2">{t("review")}</h2>
          <Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: t("all") }, { value: "wrong", label: t("onlyWrong") }]} /></div>
        <div className="space-y-3">{shown.map(({ it, n }) => (
          <Card key={it.id} className={cn("p-5 sm:p-6 border-l-4", it.isCorrect ? "border-l-ok" : "border-l-bad")}>
            <div className="flex items-center gap-2 t-caption"><span className={cn("grid place-items-center size-6 rounded-full text-white", it.isCorrect ? "bg-ok" : "bg-bad")}>{it.isCorrect ? <Check className="size-3.5" /> : <X className="size-3.5" />}</span>{n + 1} · {it.topic}</div>
            <div className="rich mt-3 text-[18px]" dangerouslySetInnerHTML={{ __html: it.stemHtml }} />
            <dl className="mt-4 grid sm:grid-cols-2 gap-3 text-[15px]">
              <div className="rounded-md bg-surface-2 px-4 py-3"><dt className="t-caption">{t("yourAnswer")}</dt><dd className="font-medium font-mono mt-0.5">{it.given || t("noAnswer")}</dd></div>
              {it.correct !== null && <div className="rounded-md bg-ok-soft px-4 py-3"><dt className="t-caption">{t("correct")}</dt><dd className="font-medium font-mono mt-0.5 text-ok-text">{it.correct}</dd></div>}
            </dl>
            {it.explanationHtml && !it.isCorrect && <div className="rich mt-4 text-[15px] text-ink-2" dangerouslySetInnerHTML={{ __html: it.explanationHtml }} />}
          </Card>))}</div>
      </section>
      {footer && <div className="mt-8">{footer}</div>}
    </div>
  );
}
