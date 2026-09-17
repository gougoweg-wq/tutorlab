"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createQuestionAction, deleteQuestionAction } from "@/modules/questions/actions";
import { renderRich } from "@/ui/rich-text";
import { Button } from "@/ui/button";
import { Field, Input, Select, Textarea, Label } from "@/ui/form";
import { Segmented } from "@/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "@/ui/dialog";

const SNIPPETS: [string, string][] = [["a/b", "$\\frac{a}{b}$"], ["√", "$\\sqrt{x}$"], ["x²", "$x^{2}$"], ["xₙ", "$x_{n}$"], ["≤", "$\\le$"], ["≥", "$\\ge$"], ["≠", "$\\ne$"], ["·", "$\\cdot$"], ["π", "$\\pi$"]];

export function NewQuestion({ topics }: { topics: { id: string; grade: number | null; name: string }[] }) {
  const t = useTranslations("questions"); const c = useTranslations("common"); const te = useTranslations("errors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<"numeric" | "single_choice">("numeric");
  const [stem, setStem] = React.useState(""); const [choices, setChoices] = React.useState(["", "", "", ""]); const [correct, setCorrect] = React.useState(0);
  const [pending, start] = React.useTransition();
  const area = React.useRef<HTMLTextAreaElement>(null);
  const insert = (snip: string) => { const el = area.current; if (!el) return; const a = el.selectionStart, b = el.selectionEnd; const next = stem.slice(0, a) + snip + stem.slice(b); setStem(next); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + snip.length, a + snip.length); }); };
  const grades = [...new Set(topics.map((x) => x.grade))];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus />{t("new")}</Button></DialogTrigger>
      <DialogContent title={t("new")} wide>
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
          start(async () => { const r = await createQuestionAction({ kind, stem, explanation: fd.get("explanation"), topicId: fd.get("topic"), difficulty: fd.get("difficulty"), numeric: fd.get("numeric"), choices: choices.filter((x) => x.trim()), correct });
            if (!r.ok) { toast.error(r.error.fields?.numeric ? t("errNumeric") : r.error.fields?.choices ? t("errChoices") : te(r.error.code)); return; }
            toast.success(c("saved")); setOpen(false); setStem(""); setChoices(["", "", "", ""]); router.refresh(); }); }}>
          <Segmented ariaLabel={t("type")} value={kind} onChange={setKind} options={[{ value: "numeric", label: t("type_numeric") }, { value: "single_choice", label: t("type_single_choice") }]} />
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label htmlFor="q-stem">{t("stem")}</Label>
              <div className="flex flex-wrap gap-1 mb-2">{SNIPPETS.map(([l, s]) => <button key={l} type="button" onClick={() => insert(s)} className="h-8 min-w-8 px-2 rounded-md bg-surface-2 hover:bg-surface-3 text-[14px] transition-colors">{l}</button>)}</div>
              <Textarea id="q-stem" ref={area} value={stem} onChange={(e) => setStem(e.target.value)} required minLength={5} className="min-h-36 font-mono text-[14px]" placeholder={t("stemPh")} /></div>
            <div><Label>{t("preview")}</Label><div className="rich min-h-36 rounded-md border border-line bg-surface-2 px-4 py-3 text-[17px]" dangerouslySetInnerHTML={{ __html: stem ? renderRich(stem) : `<span style="color:var(--faint)">${t("previewEmpty")}</span>` }} /></div>
          </div>
          {kind === "numeric" ? <Field label={t("answer")} htmlFor="q-num" hint={t("answerHint")}><Input id="q-num" name="numeric" required className="font-mono max-w-xs" placeholder="2; -3" /></Field> : (
            <div><Label>{t("choices")}</Label><div className="space-y-2">{choices.map((v, i) => (
              <div key={i} className="flex items-center gap-2.5"><input type="radio" name="correct" aria-label={t("markCorrect")} checked={correct === i} onChange={() => setCorrect(i)} className="size-5 accent-[var(--accent)]" />
                <Input aria-label={`${t("choices")} ${i + 1}`} value={v} onChange={(e) => setChoices((p) => p.map((x, k) => (k === i ? e.target.value : x)))} placeholder={String.fromCharCode(97 + i)} /></div>))}</div><p className="t-caption mt-2">{t("choicesHint")}</p></div>)}
          <Field label={t("explanation")} htmlFor="q-exp"><Textarea id="q-exp" name="explanation" className="min-h-20" /></Field>
          <div className="grid sm:grid-cols-[1fr_140px] gap-4">
            <Field label={t("topic")} htmlFor="q-topic"><Select id="q-topic" name="topic" required>{grades.map((g) => <optgroup key={String(g)} label={c("grade", { grade: g ?? 0 })}>{topics.filter((x) => x.grade === g).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</Select></Field>
            <Field label={c("difficulty")} htmlFor="q-d"><Select id="q-d" name="difficulty" defaultValue="3">{[1, 2, 3, 4, 5].map((d) => <option key={d}>{d}</option>)}</Select></Field>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={pending}>{c("save")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteQuestion({ id }: { id: string }) {
  const c = useTranslations("common"); const te = useTranslations("errors"); const router = useRouter(); const [pending, start] = React.useTransition();
  return <Button variant="quiet" size="icon" aria-label={c("delete")} loading={pending} onClick={() => { if (!confirm(c("delete") + "?")) return; start(async () => { const r = await deleteQuestionAction(id); if (!r.ok) toast.error(te(r.error.code)); else { toast.success(c("deleted")); router.refresh(); } }); }}><Trash2 /></Button>;
}
