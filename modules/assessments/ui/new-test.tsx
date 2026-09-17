"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createTestAction, countForRuleAction } from "@/modules/assessments/actions";
import { Button } from "@/ui/button";
import { Field, Input, Select, Checkbox, Label } from "@/ui/form";
import { Dialog, DialogContent, DialogTrigger } from "@/ui/dialog";

type Topic = { id: string; grade: number | null; name: string };
type Kind = "any" | "single_choice" | "numeric";
type Rule = { key: number; topicId: string; count: number; dmin: number; dmax: number; kind: Kind; inBank: number | null };

export function NewTest({ topics, students }: { topics: Topic[]; students: { id: string; name: string; grade: number }[] }) {
  const t = useTranslations("assessments"); const te = useTranslations("errors"); const c = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rules, setRules] = React.useState<Rule[]>([{ key: 1, topicId: topics[0]?.id ?? "", count: 5, dmin: 2, dmax: 4, kind: "any", inBank: null }]);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [pending, start] = React.useTransition();
  const total = rules.reduce((s, r) => s + (r.count || 0), 0);

  React.useEffect(() => {
    rules.filter((r) => r.inBank === null && r.topicId).forEach(async (r) => {
      const res = await countForRuleAction(r.topicId, r.dmin, r.dmax, r.kind === "any" ? null : [r.kind]);
      setRules((rs) => rs.map((x) => (x.key === r.key ? { ...x, inBank: res.ok ? res.data : 0 } : x)));
    });
  }, [rules]);
  const patch = (key: number, p: Partial<Rule>) => setRules((rs) => rs.map((r) => (r.key === key ? { ...r, ...p, inBank: "topicId" in p || "dmin" in p || "dmax" in p || "kind" in p ? null : r.inBank } : r)));
  const grades = [...new Set(topics.map((x) => x.grade))];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus />{t("new")}</Button></DialogTrigger>
      <DialogContent title={t("new")} wide>
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await createTestAction({ title: fd.get("title"), dueAt: fd.get("due") ? new Date(String(fd.get("due"))).toISOString() : null, maxAttempts: fd.get("attempts"), timeLimitMin: fd.get("limit") || null, studentIds: [...picked],
              rules: rules.map((r) => ({ topicId: r.topicId, includeSubtree: true, count: r.count, difficultyMin: r.dmin, difficultyMax: r.dmax, types: r.kind === "any" ? null : [r.kind] })) });
            if (!res.ok) { toast.error(te(res.error.code)); return; }
            toast.success(t("created")); setOpen(false); router.refresh();
          }); }}>
          <Field label={t("name")} htmlFor="t-title"><Input id="t-title" name="title" required minLength={2} placeholder={t("namePh")} /></Field>
          <div>
            <Label>{t("topics")}</Label>
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_76px_104px_150px_auto] gap-2 items-center">
                  <Select aria-label={t("topics")} value={r.topicId} onChange={(e) => patch(r.key, { topicId: e.target.value })}>
                    {grades.map((g) => <optgroup key={String(g)} label={c("grade", { grade: g ?? 0 })}>{topics.filter((x) => x.grade === g).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}
                  </Select>
                  <Input aria-label={t("count")} type="number" min={1} max={40} value={r.count} onChange={(e) => patch(r.key, { count: Number(e.target.value) })} />
                  <Select aria-label={t("difficulty")} value={`${r.dmin}-${r.dmax}`} onChange={(e) => { const [a, b] = e.target.value.split("-").map(Number); patch(r.key, { dmin: a, dmax: b }); }}>
                    <option value="1-5">1–5</option><option value="2-3">2–3</option><option value="2-4">2–4</option><option value="3-4">3–4</option><option value="4-5">4–5</option>
                  </Select>
                  <Select aria-label={t("kind")} value={r.kind} onChange={(e) => patch(r.key, { kind: e.target.value as Kind })}><option value="any">{t("kindAny")}</option><option value="single_choice">{t("kindChoice")}</option><option value="numeric">{t("kindNumeric")}</option></Select>
                  <div className="flex items-center gap-2 justify-end"><span className="t-caption tnum whitespace-nowrap">{r.inBank === null ? "…" : t("inBank", { n: r.inBank })}</span>
                    {rules.length > 1 && <Button type="button" variant="quiet" size="icon" aria-label={c("delete")} onClick={() => setRules((rs) => rs.filter((x) => x.key !== r.key))}><Trash2 /></Button>}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between"><Button type="button" variant="ghost" size="sm" onClick={() => setRules((rs) => [...rs, { key: Date.now(), topicId: topics[0]?.id ?? "", count: 5, dmin: 2, dmax: 4, kind: "any", inBank: null }])}><Plus />{t("addTopic")}</Button><span className="t-small text-muted tnum">{t("total", { n: total })}</span></div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label={t("due")} htmlFor="t-due"><Input id="t-due" name="due" type="datetime-local" /></Field>
            <Field label={t("attempts")} htmlFor="t-att"><Input id="t-att" name="attempts" type="number" min={1} max={10} defaultValue={1} /></Field>
            <Field label={t("timeLimit")} htmlFor="t-lim"><Input id="t-lim" name="limit" type="number" min={1} max={600} placeholder="—" /></Field>
          </div>
          <div>
            <Label>{t("students")}</Label>
            {!students.length ? <p className="t-small text-muted">{t("noStudents")}</p> : (
              <div className="grid sm:grid-cols-2 gap-1.5">{students.map((s) => (
                <label key={s.id} className="flex items-center gap-3 h-11 px-3.5 rounded-md border border-line cursor-pointer transition-colors hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <Checkbox checked={picked.has(s.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
                  <span className="flex-1 truncate">{s.name}</span><span className="t-caption">{c("gradeShort", { grade: s.grade })}</span></label>))}</div>)}
          </div>
          <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!students.length || !picked.size}>{t("create")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
