"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { createPracticeAction } from "@/modules/assessments/actions";
import { Button } from "@/ui/button";
import { Segmented } from "@/ui/tabs";
import { Switch } from "@/ui/form";
import { cn } from "@/ui/cn";

type Topic = { id: string; grade: number | null; isSat: boolean; name: string; done: number; percent: number | null };

export function PracticeBuilder({ topics, defaultGroup }: { topics: Topic[]; defaultGroup: string }) {
  const t = useTranslations("practice"); const te = useTranslations("errors"); const c = useTranslations("common");
  const router = useRouter();
  const groups = React.useMemo(() => { const m = new Map<string, Topic[]>(); for (const x of topics) { const k = x.isSat ? "sat" : String(x.grade); m.set(k, [...(m.get(k) ?? []), x]); } return m; }, [topics]);
  const [group, setGroup] = React.useState(groups.has(defaultGroup) ? defaultGroup : [...groups.keys()][0] ?? "");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [count, setCount] = React.useState("10");
  const [level, setLevel] = React.useState<"easy" | "normal" | "hard">("normal");
  const [timed, setTimed] = React.useState(false);
  const [pending, start] = React.useTransition();
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 8 ? p : [...p, id]));
  const weak = topics.filter((x) => x.percent !== null && x.done >= 3).sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0)).slice(0, 3);

  const go = (ids: string[]) => start(async () => {
    const r = await createPracticeAction({ topicIds: ids, count: Number(count), level, timed });
    if (!r.ok) { toast.error(te(r.error.code)); return; }
    router.push(`/student/attempt/${r.data.attemptId}`);
  });

  return (
    <div className="pb-32">
      {!!weak.length && (
        <section className="mb-10 rise rounded-xl bg-accent-soft p-6 sm:p-8">
          <div className="t-eyebrow text-accent-text">{t("weakEyebrow")}</div>
          <h2 className="t-h2 mt-1">{t("weakTitle")}</h2>
          <ul className="mt-3 space-y-1 text-[16px]">{weak.map((w) => <li key={w.id} className="flex justify-between gap-4"><span>{w.name}</span><span className="tnum text-muted">{w.percent}%</span></li>)}</ul>
          <Button className="mt-5" size="lg" loading={pending} onClick={() => go(weak.map((w) => w.id))}>{t("weakGo")}</Button>
        </section>
      )}
      <section className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="t-h2 mb-4">{t("pick")}</h2>
        <Segmented ariaLabel={t("pick")} value={group} onChange={setGroup} options={[...groups.keys()].map((k) => ({ value: k, label: k === "sat" ? "SAT Math" : c("grade", { grade: Number(k) }) }))} />
        <div className="mt-5 grid sm:grid-cols-2 gap-2.5">
          {(groups.get(group) ?? []).map((x) => { const on = picked.includes(x.id); return (
            <button key={x.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(x.id)}
              className={cn("flex items-center gap-3 min-h-[56px] px-4 py-3 rounded-lg border text-left transition-[background-color,border-color,transform] duration-200 ease-apple active:scale-[0.99]", on ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2")}>
              <span className={cn("grid place-items-center size-6 shrink-0 rounded-full border transition-colors", on ? "bg-accent border-accent text-accent-ink" : "border-line-strong")}>{on && <Check className="size-3.5" />}</span>
              <span className="flex-1 text-[16px] leading-snug">{x.name}</span>
              {x.percent !== null && <span className={cn("text-[13px] tnum font-medium", x.percent >= 80 ? "text-ok-text" : x.percent >= 60 ? "text-warn-text" : "text-bad-text")}>{x.percent}%</span>}
            </button>); })}
        </div>
      </section>
      <section className="mt-10 rise grid sm:grid-cols-3 gap-6" style={{ "--i": 2 } as React.CSSProperties}>
        <div><div className="t-caption mb-2">{t("count")}</div><Segmented ariaLabel={t("count")} value={count} onChange={setCount} options={["5", "10", "15", "20"].map((v) => ({ value: v, label: v }))} /></div>
        <div><div className="t-caption mb-2">{c("difficulty")}</div><Segmented ariaLabel={c("difficulty")} value={level} onChange={setLevel} options={[{ value: "easy", label: t("easy") }, { value: "normal", label: t("normal") }, { value: "hard", label: t("hard") }]} /></div>
        <div><div className="t-caption mb-2">{t("timed")}</div><div className="flex items-center gap-3 h-[38px]"><Switch id="timed" label={t("timed")} checked={timed} onChange={setTimed} /><span className="t-small text-muted">{timed ? t("timedOn", { n: Math.max(5, Math.round(Number(count) * 1.6)) }) : t("timedOff")}</span></div></div>
      </section>
      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] sm:bottom-0 inset-x-0 z-30 glass border-t sm:pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-[980px] mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <span className="t-small text-muted">{picked.length ? t("picked", { n: picked.length }) : t("pickHint")}</span>
          <Button size="lg" disabled={!picked.length} loading={pending} onClick={() => go(picked)}>{t("start")}</Button>
        </div>
      </div>
    </div>
  );
}
