"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveAnswerAction, submitAttemptAction } from "@/modules/assessments/actions";
import type { AnswerPayload } from "@/modules/questions/types";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Input } from "@/ui/form";
import { ProgressBar } from "@/ui/states";
import { Dialog, DialogContent, DialogClose } from "@/ui/dialog";
import { cn } from "@/ui/cn";

type Q = { versionId: string; type: "numeric" | "single_choice"; choices?: { id: string; html: string }[]; stemHtml: string; expectedValues?: number; unit?: string; draft: string };
type SaveState = "saved" | "saving" | "offline";

export function Player({ attemptId, title, questions, deadlineAt, serverNow }: { attemptId: string; title: string; questions: Q[]; deadlineAt: string | null; serverNow: string }) {
  const t = useTranslations("attempt"); const te = useTranslations("errors"); const c = useTranslations("common");
  const router = useRouter();
  const lsKey = `attempt:${attemptId}`;
  const [values, setValues] = React.useState<Record<string, string>>(() => Object.fromEntries(questions.map((q) => [q.versionId, q.draft])));
  const [state, setState] = React.useState<SaveState>("saved");
  const [confirm, setConfirm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const dirty = React.useRef(new Set<string>()); const latest = React.useRef(values); latest.current = values;
  const timers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // restore local drafts that never reached the server (reload / lost connection)
  React.useEffect(() => { try { const raw = localStorage.getItem(lsKey); if (!raw) return; const local = JSON.parse(raw) as Record<string, string>;
    const diff = Object.entries(local).filter(([k, v]) => k in latest.current && v !== latest.current[k] && v !== "");
    if (diff.length) { setValues((p) => ({ ...p, ...Object.fromEntries(diff) })); diff.forEach(([k]) => dirty.current.add(k)); void flush(); } } catch { /* storage unavailable */ } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = React.useCallback(async () => {
    const ids = [...dirty.current]; if (!ids.length) return true;
    setState("saving");
    for (const id of ids) {
      const kind = questions.find((q) => q.versionId === id)?.type ?? "numeric";
      const payload: AnswerPayload = kind === "single_choice" ? { type: "single_choice", choice: latest.current[id] || null } : { type: "numeric", raw: latest.current[id] ?? "" };
      const res = await saveAnswerAction(attemptId, id, payload).catch(() => null);
      if (!res) { setState("offline"); return false; }
      if (!res.ok) { if (res.error.code === "already_submitted" || res.error.code === "deadline_passed") { router.replace(`/student/attempt/${attemptId}/result`); return false; } toast.error(te(res.error.code)); setState("offline"); return false; }
      dirty.current.delete(id);
    }
    setState("saved"); return true;
  }, [attemptId, questions, router, te]);

  const change = (id: string, v: string) => {
    setValues((p) => { const n = { ...p, [id]: v }; try { localStorage.setItem(lsKey, JSON.stringify(n)); } catch { /* ignore */ } return n; });
    dirty.current.add(id); clearTimeout(timers.current[id]); timers.current[id] = setTimeout(() => void flush(), 800);
  };
  React.useEffect(() => { const on = () => void flush(); const vis = () => { if (document.visibilityState === "hidden") void flush(); };
    window.addEventListener("online", on); document.addEventListener("visibilitychange", vis); const iv = setInterval(on, 15000);
    return () => { window.removeEventListener("online", on); document.removeEventListener("visibilitychange", vis); clearInterval(iv); }; }, [flush]);

  const submit = React.useCallback(async () => {
    if (submitting) return; setSubmitting(true);
    const okSave = await flush(); if (!okSave && navigator.onLine === false) { setSubmitting(false); return; }
    const res = await submitAttemptAction(attemptId);
    if (!res.ok && res.error.code !== "already_submitted") { toast.error(te(res.error.code)); setSubmitting(false); return; }
    try { localStorage.removeItem(lsKey); } catch { /* ignore */ }
    router.replace(`/student/attempt/${attemptId}/result`);
  }, [attemptId, flush, lsKey, router, submitting, te]);

  // countdown from the server deadline, corrected by the client/server clock offset
  const offset = React.useMemo(() => new Date(serverNow).getTime() - Date.now(), [serverNow]);
  const [left, setLeft] = React.useState<number | null>(null);
  React.useEffect(() => { if (!deadlineAt) return; const end = new Date(deadlineAt).getTime();
    const tick = () => { const ms = end - (Date.now() + offset); setLeft(ms); if (ms <= 0) void submit(); };
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv); }, [deadlineAt, offset, submit]);

  const answered = questions.filter((q) => (values[q.versionId] ?? "").trim()).length;
  const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  return (
    <div className="pb-28">
      <h1 className="t-title rise">{title}</h1>
      <div className="mt-6 space-y-4">
        {questions.map((q, i) => (
          <Card key={q.versionId} className="p-5 sm:p-7 rise" style={{ "--i": Math.min(i, 6) } as React.CSSProperties}>
            <div className="grid place-items-center size-8 rounded-full bg-accent-soft text-accent-text text-[14px] font-semibold tnum">{i + 1}</div>
            <div className="rich mt-3 text-[19px] sm:text-[20px] leading-relaxed" dangerouslySetInnerHTML={{ __html: q.stemHtml }} />
            {q.type === "single_choice" ? (
              <div role="radiogroup" aria-label={t("answer")} className="mt-5 grid sm:grid-cols-2 gap-2.5">
                {(q.choices ?? []).map((c, k) => { const on = values[q.versionId] === c.id; return (
                  <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => change(q.versionId, c.id)}
                    onKeyDown={(e) => { const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0; if (!dir) return; e.preventDefault(); const list = q.choices ?? []; const nx = list[(k + dir + list.length) % list.length]; change(q.versionId, nx.id); (e.currentTarget.parentElement?.children[(k + dir + list.length) % list.length] as HTMLElement | undefined)?.focus(); }}
                    tabIndex={on || (!values[q.versionId] && k === 0) ? 0 : -1}
                    className={cn("flex items-center gap-3 min-h-[56px] px-4 rounded-lg border text-left text-[18px] transition-[background-color,border-color,transform] duration-200 ease-apple active:scale-[0.99]", on ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-surface-2")}>
                    <span className={cn("grid place-items-center size-7 shrink-0 rounded-full border text-[13px] font-semibold uppercase transition-colors", on ? "bg-accent border-accent text-accent-ink" : "border-line-strong text-muted")}>{c.id}</span>
                    <span className="rich" dangerouslySetInnerHTML={{ __html: c.html }} />
                  </button>); })}
              </div>
            ) : (<>
            <label htmlFor={`a-${i}`} className="block t-caption mt-5 mb-1.5">{t("answer")}{q.unit ? `, ${q.unit}` : ""}</label>
            <Input id={`a-${i}`} value={values[q.versionId] ?? ""} onChange={(e) => change(q.versionId, e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} className="h-12 text-[18px] font-mono max-w-sm"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const nx = document.getElementById(`a-${i + 1}`); if (nx) nx.focus(); else setConfirm(true); } }} />
            {(q.expectedValues ?? 1) > 1 && <p className="t-caption mt-1.5">{t("hintMany")}</p>}
            </>)}
          </Card>
        ))}
      </div>
      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] sm:bottom-0 inset-x-0 z-30 glass border-t sm:pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-[980px] mx-auto px-5 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0"><div className="flex justify-between gap-3 t-caption mb-1.5"><span>{t("answered", { n: answered, total: questions.length })}</span>
            <span className={cn(state === "offline" && "text-bad-text")}>{t(state)}</span></div><ProgressBar value={(answered / questions.length) * 100} label={t("answered", { n: answered, total: questions.length })} /></div>
          {left !== null && <div className={cn("text-[15px] font-semibold tnum", left < 60_000 ? "text-bad-text" : left < 300_000 ? "text-warn-text" : "text-ink-2")} aria-label={t("timeLeft")}>{fmt(left)}</div>}
          <Button onClick={() => setConfirm(true)} loading={submitting}>{t("submit")}</Button>
        </div>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title={t("confirmTitle")} description={answered < questions.length ? t("confirmText", { n: questions.length - answered }) : t("confirmAll")}>
          <div className="flex gap-2 justify-end"><DialogClose asChild><Button variant="secondary">{c("cancel")}</Button></DialogClose><Button onClick={submit} loading={submitting}>{t("submit")}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
