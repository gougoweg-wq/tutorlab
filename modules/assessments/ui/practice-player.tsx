"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, Check, Flame, X } from "lucide-react";
import { checkItemAction, submitAttemptAction } from "@/modules/assessments/actions";
import type { AnswerPayload } from "@/modules/questions/types";
import { Button } from "@/ui/button";
import { Input } from "@/ui/form";
import { cn } from "@/ui/cn";

type Checked = { isCorrect: boolean; correct: string; explanationHtml: string };
type Q = { versionId: string; type: "numeric" | "single_choice"; choices?: { id: string; html: string }[]; stemHtml: string; expectedValues?: number; unit?: string; draft: string; checked: Checked | null };
const EASE = [0.28, 0.11, 0.32, 1] as const;

/** One question at a time with instant, server-side checking — for practice sets only. */
export function PracticePlayer({ attemptId, title, questions, renderExplanation }: { attemptId: string; title: string; questions: Q[]; renderExplanation: (md: string) => Promise<string> }) {
  const t = useTranslations("attempt"); const te = useTranslations("errors");
  const router = useRouter(); const reduce = useReducedMotion();
  const firstOpen = Math.max(0, questions.findIndex((q) => !q.checked));
  const [i, setI] = React.useState(questions.every((q) => q.checked) ? questions.length - 1 : firstOpen);
  const [values, setValues] = React.useState<Record<string, string>>(() => Object.fromEntries(questions.map((q) => [q.versionId, q.draft])));
  const [results, setResults] = React.useState<Record<string, Checked>>(() => Object.fromEntries(questions.filter((q) => q.checked).map((q) => [q.versionId, q.checked!])));
  const [pending, setPending] = React.useState(false); const [finishing, setFinishing] = React.useState(false);
  const q = questions[i]; const res = results[q.versionId]; const value = values[q.versionId] ?? "";
  const inputRef = React.useRef<HTMLInputElement>(null);
  const done = Object.keys(results).length; const right = Object.values(results).filter((r) => r.isCorrect).length;
  let combo = 0; for (let k = i - (res ? 0 : 1); k >= 0; k--) { if (results[questions[k].versionId]?.isCorrect) combo += 1; else break; }

  React.useEffect(() => { if (!res) inputRef.current?.focus(); }, [i, res]);

  const check = React.useCallback(async () => {
    if (pending || res || !value.trim()) return; setPending(true);
    const payload: AnswerPayload = q.type === "single_choice" ? { type: "single_choice", choice: value } : { type: "numeric", raw: value };
    const r = await checkItemAction(attemptId, q.versionId, payload).catch(() => null); setPending(false);
    if (!r) { toast.error(te("offline")); return; }
    if (!r.ok) { if (r.error.code === "already_submitted" || r.error.code === "deadline_passed") { router.replace(`/student/attempt/${attemptId}/result`); return; } toast.error(te(r.error.code)); return; }
    const explanationHtml = r.data.explanationMd ? await renderExplanation(r.data.explanationMd) : "";
    setResults((p) => ({ ...p, [q.versionId]: { isCorrect: r.data.isCorrect, correct: r.data.correct, explanationHtml } }));
  }, [attemptId, pending, q, renderExplanation, res, router, te, value]);

  const next = React.useCallback(async () => {
    if (i < questions.length - 1) { setI(i + 1); return; }
    if (finishing) return; setFinishing(true);
    const r = await submitAttemptAction(attemptId);
    if (!r.ok && r.error.code !== "already_submitted") { toast.error(te(r.error.code)); setFinishing(false); return; }
    router.replace(`/student/attempt/${attemptId}/result`);
  }, [attemptId, finishing, i, questions.length, router, te]);

  React.useEffect(() => { const on = (e: KeyboardEvent) => { if (e.key !== "Enter") return; e.preventDefault(); if (results[q.versionId]) void next(); else void check(); };
    document.addEventListener("keydown", on, true); return () => document.removeEventListener("keydown", on, true); }, [check, next, q.versionId, results]);

  return (
    <div className="pb-56 sm:pb-48">
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={done} aria-label={t("answered", { n: done, total: questions.length })}>
          <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-apple" style={{ width: `${(done / questions.length) * 100}%` }} /></div>
        <span className="t-small tnum text-muted">{Math.min(i + 1, questions.length)}/{questions.length}</span>
        <span className={cn("inline-flex items-center gap-1 text-[15px] font-semibold tnum transition-colors duration-300", combo >= 2 ? "text-warn-text" : "text-faint")} aria-label={t("combo", { n: combo })}><Flame className={cn("size-[18px] transition-transform duration-300 ease-spring", combo >= 2 && "scale-125")} />{combo}</span>
      </div>
      <p className="t-caption mt-4">{title}</p>
      <AnimatePresence mode="wait">
        <motion.div key={q.versionId} initial={reduce ? false : { opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -28 }} transition={{ duration: 0.32, ease: EASE }}>
          <div className="rich mt-3 text-[21px] sm:text-[24px] leading-relaxed font-medium tracking-[-0.01em]" dangerouslySetInnerHTML={{ __html: q.stemHtml }} />
          {q.type === "single_choice" ? (
            <div role="radiogroup" aria-label={t("answer")} className="mt-7 grid sm:grid-cols-2 gap-3">
              {(q.choices ?? []).map((c, k) => { const on = value === c.id; return (
                <button key={c.id} ref={k === 0 ? (inputRef as unknown as React.Ref<HTMLButtonElement>) : undefined} type="button" role="radio" aria-checked={on} disabled={!!res} onClick={() => setValues((p) => ({ ...p, [q.versionId]: c.id }))}
                  onKeyDown={(e) => { const n = Number(e.key); if (n >= 1 && n <= (q.choices?.length ?? 0)) setValues((p) => ({ ...p, [q.versionId]: q.choices![n - 1].id })); }}
                  className={cn("flex items-center gap-3.5 min-h-[64px] px-5 rounded-xl border-2 text-left text-[19px] transition-[background-color,border-color,transform] duration-200 ease-apple enabled:active:scale-[0.98] disabled:cursor-default",
                    on ? (res ? (res.isCorrect ? "border-ok bg-ok-soft" : "border-bad bg-bad-soft") : "border-accent bg-accent-soft") : "border-line hover:enabled:border-line-strong hover:enabled:bg-surface-2")}>
                  <span className={cn("grid place-items-center size-8 shrink-0 rounded-full border-2 text-[13px] font-bold transition-colors", on ? "bg-accent border-accent text-accent-ink" : "border-line-strong text-muted")}>{k + 1}</span>
                  <span className="rich" dangerouslySetInnerHTML={{ __html: c.html }} /></button>); })}
            </div>
          ) : (
            <div className="mt-7 max-w-md"><label htmlFor="pp-answer" className="block t-caption mb-1.5">{t("answer")}{q.unit ? `, ${q.unit}` : ""}</label>
              <Input id="pp-answer" ref={inputRef} value={value} disabled={!!res} onChange={(e) => setValues((p) => ({ ...p, [q.versionId]: e.target.value }))} autoComplete="off" autoCapitalize="off" spellCheck={false}
                className={cn("h-14 text-[22px] font-mono rounded-xl border-2", res && (res.isCorrect ? "border-ok bg-ok-soft" : "border-bad bg-bad-soft"))} />
              {(q.expectedValues ?? 1) > 1 && <p className="t-caption mt-1.5">{t("hintMany")}</p>}</div>)}
        </motion.div>
      </AnimatePresence>

      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] sm:bottom-0 inset-x-0 z-30">
        <AnimatePresence mode="wait">
          {res ? (
            <motion.div key="fb" role="status" aria-live="polite" initial={reduce ? false : { y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className={cn("border-t backdrop-blur-xl sm:pb-[env(safe-area-inset-bottom)]", res.isCorrect ? "bg-[color-mix(in_srgb,var(--ok)_16%,var(--bg-elevated))] border-ok" : "bg-[color-mix(in_srgb,var(--bad)_14%,var(--bg-elevated))] border-bad")}>
              <div className="max-w-[980px] mx-auto px-5 py-4 flex flex-wrap items-center gap-4">
                <motion.span initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 16, delay: 0.05 }} className={cn("grid place-items-center size-11 shrink-0 rounded-full text-white", res.isCorrect ? "bg-ok" : "bg-bad")}>{res.isCorrect ? <Check /> : <X />}</motion.span>
                <div className="flex-1 min-w-[200px]"><div className={cn("text-[18px] font-bold", res.isCorrect ? "text-ok-text" : "text-bad-text")}>{res.isCorrect ? t(combo >= 3 ? "greatCombo" : "right", { n: combo }) : t("wrong")}</div>
                  {!res.isCorrect && <div className="text-[15px] mt-0.5">{t("correct")}: <span className="font-mono font-semibold">{res.correct}</span></div>}
                  {res.explanationHtml && !res.isCorrect && <div className="rich text-[14px] text-ink-2 mt-1 max-h-24 overflow-y-auto scroll-thin" dangerouslySetInnerHTML={{ __html: res.explanationHtml }} />}</div>
                <Button size="lg" variant={res.isCorrect ? "primary" : "ink"} onClick={next} loading={finishing} className="w-full sm:w-auto">{i < questions.length - 1 ? t("nextQ") : t("finish")}<ArrowRight /></Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="bar" initial={false} animate={{ opacity: 1 }} className="glass border-t sm:pb-[env(safe-area-inset-bottom)]">
              <div className="max-w-[980px] mx-auto px-5 py-3 flex items-center justify-between gap-4"><span className="t-small text-muted tnum">{t("score", { ok: right, total: done })}</span>
                <Button size="lg" onClick={check} loading={pending} disabled={!value.trim()}>{t("check")}</Button></div>
            </motion.div>)}
        </AnimatePresence>
      </div>
    </div>
  );
}
