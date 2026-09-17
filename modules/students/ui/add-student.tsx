"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Plus } from "lucide-react";
import { createStudentAction, newInviteAction } from "@/modules/students/actions";
import { Button } from "@/ui/button";
import { Field, Input, Select } from "@/ui/form";
import { Dialog, DialogContent, DialogTrigger } from "@/ui/dialog";

function InviteBox({ link, code }: { link: string; code: string }) {
  const t = useTranslations("students"); const c = useTranslations("common");
  return (
    <div className="pop">
      <p className="text-muted">{t("inviteText")}</p>
      <div className="mt-5 text-center text-[34px] font-bold tracking-[0.18em] tnum">{code}</div>
      <div className="mt-4 flex gap-2"><Input readOnly value={link} aria-label={t("invite")} onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="secondary" className="h-11 shrink-0" onClick={async () => { await navigator.clipboard.writeText(link); toast.success(c("copied")); }}><Copy />{c("copy")}</Button></div>
    </div>
  );
}

export function AddStudent() {
  const t = useTranslations("students"); const te = useTranslations("errors");
  const [open, setOpen] = React.useState(false);
  const [invite, setInvite] = React.useState<{ link: string; code: string } | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setInvite(null); }}>
      <DialogTrigger asChild><Button><Plus />{t("add")}</Button></DialogTrigger>
      <DialogContent title={invite ? t("inviteTitle") : t("add")}>
        {invite ? <InviteBox {...invite} /> : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
            start(async () => { const r = await createStudentAction({ name: fd.get("name"), grade: fd.get("grade") }); if (!r.ok) { toast.error(te(r.error.code)); return; } setInvite(r.data); }); }}>
            <Field label={t("name")} htmlFor="st-name"><Input id="st-name" name="name" required minLength={2} autoFocus /></Field>
            <Field label={t("grade")} htmlFor="st-grade"><Select id="st-grade" name="grade" defaultValue="7">{[5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g} value={g}>{g}</option>)}</Select></Field>
            <Button type="submit" size="lg" className="w-full" loading={pending}>{t("add")}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InviteButton({ studentId }: { studentId: string }) {
  const t = useTranslations("students"); const te = useTranslations("errors");
  const [invite, setInvite] = React.useState<{ link: string; code: string } | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={!!invite} onOpenChange={(o) => !o && setInvite(null)}>
      <Button variant="ghost" size="sm" loading={pending} onClick={() => start(async () => { const r = await newInviteAction(studentId); if (!r.ok) toast.error(te(r.error.code)); else setInvite(r.data); })}>{t("invite")}</Button>
      <DialogContent title={t("inviteTitle")}>{invite && <InviteBox {...invite} />}</DialogContent>
    </Dialog>
  );
}
