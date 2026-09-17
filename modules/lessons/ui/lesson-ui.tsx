"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BookCheck, Check, Plus, Trash2, X } from "lucide-react";
import { createLessonAction, createHomeworkAction, deleteLessonAction, setLessonStatusAction } from "@/modules/lessons/actions";
import { Button } from "@/ui/button";
import { Field, Input, Select, Textarea, Checkbox, Label } from "@/ui/form";
import { Dialog, DialogContent, DialogTrigger } from "@/ui/dialog";

type Topic = { id: string; grade: number | null; name: string };

export function NewLesson({ topics, students }: { topics: Topic[]; students: { id: string; name: string }[] }) {
  const t = useTranslations("lessons"); const c = useTranslations("common"); const te = useTranslations("errors"); const router = useRouter();
  const [open, setOpen] = React.useState(false); const [st, setSt] = React.useState<Set<string>>(new Set()); const [tp, setTp] = React.useState<string[]>([]);
  const [pending, start] = React.useTransition();
  const grades = [...new Set(topics.map((x) => x.grade))];
  const def = React.useMemo(() => { const d = new Date(Date.now() + 86_400_000); d.setMinutes(0, 0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }, []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus />{t("new")}</Button></DialogTrigger>
      <DialogContent title={t("new")} wide>
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
          start(async () => { const r = await createLessonAction({ startsAt: new Date(String(fd.get("at"))).toISOString(), durationMin: fd.get("dur"), studentIds: [...st], topicIds: tp, noteMd: fd.get("note"), callUrl: fd.get("url") || null, repeatWeeks: fd.get("repeat") });
            if (!r.ok) { toast.error(te(r.error.code)); return; } toast.success(c("saved")); setOpen(false); setSt(new Set()); setTp([]); router.refresh(); }); }}>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label={t("when")} htmlFor="l-at"><Input id="l-at" name="at" type="datetime-local" required defaultValue={def} /></Field>
            <Field label={t("duration")} htmlFor="l-dur"><Select id="l-dur" name="dur" defaultValue="60">{[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{c("minutes", { n: m })}</option>)}</Select></Field>
            <Field label={t("repeat")} htmlFor="l-rep"><Select id="l-rep" name="repeat" defaultValue="1"><option value="1">{t("repeatNo")}</option>{[4, 8, 12].map((w) => <option key={w} value={w}>{t("repeatWeeks", { n: w })}</option>)}</Select></Field>
          </div>
          <div><Label>{t("students")}</Label>{!students.length ? <p className="t-small text-muted">{t("noStudents")}</p> : <div className="grid sm:grid-cols-2 gap-1.5">{students.map((s) => (
            <label key={s.id} className="flex items-center gap-3 h-11 px-3.5 rounded-md border border-line cursor-pointer transition-colors hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"><Checkbox checked={st.has(s.id)} onChange={(e) => setSt((p) => { const n = new Set(p); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} /><span className="truncate">{s.name}</span></label>))}</div>}</div>
          <div><Label htmlFor="l-topic">{t("topics")}</Label>
            <Select id="l-topic" value="" onChange={(e) => { const v = e.target.value; if (v && !tp.includes(v) && tp.length < 8) setTp([...tp, v]); }}><option value="">{t("addTopic")}</option>{grades.map((g) => <optgroup key={String(g)} label={c("grade", { grade: g ?? 0 })}>{topics.filter((x) => x.grade === g).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</Select>
            {!!tp.length && <div className="mt-2 flex flex-wrap gap-1.5">{tp.map((id) => <span key={id} className="inline-flex items-center gap-1 h-8 pl-3 pr-1.5 rounded-full bg-accent-soft text-accent-text text-[13px] font-medium">{topics.find((x) => x.id === id)?.name}<button type="button" aria-label={c("delete")} onClick={() => setTp(tp.filter((x) => x !== id))} className="grid place-items-center size-5 rounded-full hover:bg-accent hover:text-accent-ink transition-colors"><X className="size-3" /></button></span>)}</div>}
            <p className="t-caption mt-1.5">{t("topicsHint")}</p></div>
          <Field label={t("callUrl")} htmlFor="l-url"><Input id="l-url" name="url" type="url" placeholder="https://meet.google.com/…" /></Field>
          <Field label={t("note")} htmlFor="l-note"><Textarea id="l-note" name="note" className="min-h-20" /></Field>
          <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!st.size}>{c("save")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LessonActions({ id, status, hasTopics, homework, defaultTitle }: { id: string; status: string; hasTopics: boolean; homework: boolean; defaultTitle: string }) {
  const t = useTranslations("lessons"); const c = useTranslations("common"); const te = useTranslations("errors"); const router = useRouter();
  const [open, setOpen] = React.useState(false); const [pending, start] = React.useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: { code: string } }>) => start(async () => { const r = await fn(); if (!r.ok && r.error) toast.error(te(r.error.code)); else router.refresh(); });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "planned" && <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => setLessonStatusAction(id, "done"))}><Check />{t("markDone")}</Button>}
      {status !== "cancelled" && !homework && hasTopics && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><BookCheck />{t("homework")}</Button></DialogTrigger>
          <DialogContent title={t("homework")} description={t("homeworkText")}>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
              start(async () => { const r = await createHomeworkAction(id, { title: fd.get("title"), count: fd.get("count"), dueDays: fd.get("due") }); if (!r.ok) { toast.error(te(r.error.code)); return; }
                const bad = r.data.filter((x) => !x.ok).length; if (bad) toast.error(t("homeworkPartial", { n: bad })); else toast.success(t("homeworkDone", { n: r.data.length })); setOpen(false); router.refresh(); }); }}>
              <Field label={t("hwTitle")} htmlFor={`hw-t-${id}`}><Input id={`hw-t-${id}`} name="title" required defaultValue={defaultTitle} /></Field>
              <div className="grid grid-cols-2 gap-4"><Field label={t("hwCount")} htmlFor={`hw-c-${id}`}><Input id={`hw-c-${id}`} name="count" type="number" min={3} max={40} defaultValue={10} /></Field>
                <Field label={t("hwDue")} htmlFor={`hw-d-${id}`}><Input id={`hw-d-${id}`} name="due" type="number" min={1} max={30} defaultValue={3} /></Field></div>
              <Button type="submit" size="lg" className="w-full" loading={pending}>{t("hwCreate")}</Button>
            </form>
          </DialogContent>
        </Dialog>)}
      {status === "planned" && <Button variant="quiet" size="sm" onClick={() => run(() => setLessonStatusAction(id, "cancelled"))}>{t("cancel")}</Button>}
      <Button variant="quiet" size="icon" aria-label={c("delete")} onClick={() => { if (confirm(c("delete") + "?")) run(() => deleteLessonAction(id)); }}><Trash2 /></Button>
    </div>
  );
}
