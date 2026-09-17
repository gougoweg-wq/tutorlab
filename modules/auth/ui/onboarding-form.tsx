"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createWorkspaceAction } from "@/modules/auth/actions";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/form";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const t = useTranslations("onboarding");
  const ta = useTranslations("auth");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [code, setCode] = React.useState("");
  return (
    <div>
      <h1 className="t-title text-center">{t("title")}</h1>
      <p className="mt-2 text-center text-muted">{t("lead")}</p>
      <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); const name = String(new FormData(e.currentTarget).get("name") ?? "");
        start(async () => { const res = await createWorkspaceAction({ name }); if (!res.ok) { toast.error(te(res.error.code)); return; } router.push("/tutor"); router.refresh(); }); }}>
        <Field label={t("workspaceName")} htmlFor="name"><Input id="name" name="name" required minLength={2} maxLength={80} defaultValue={defaultName} placeholder={t("workspacePlaceholder")} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>{t("create")}</Button>
      </form>
      <div className="mt-10 pt-6 border-t border-line">
        <p className="t-small text-muted text-center">{t("studentHint")}</p>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) router.push(`/invite/${encodeURIComponent(code.trim().toUpperCase())}`); }}>
          <Input aria-label={ta("code")} placeholder={ta("code")} value={code} onChange={(e) => setCode(e.target.value)} className="uppercase tracking-[0.12em] text-center" maxLength={12} />
          <Button type="submit" variant="secondary" className="h-11 shrink-0">{ta("codeOpen")}</Button>
        </form>
      </div>
    </div>
  );
}
