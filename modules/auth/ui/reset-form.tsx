"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { authClient } from "@/modules/auth/client";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/form";

export function ResetForm() {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const token = useSearchParams().get("token");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [err, setErr] = React.useState<string>();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(undefined);
    const fd = new FormData(e.currentTarget);
    if (token) {
      const password = String(fd.get("password") ?? "");
      if (password.length < 8) return setErr(te("passwordShort"));
      setPending(true);
      const res = await authClient.resetPassword({ newPassword: password, token });
      setPending(false);
      if (res.error) return setErr(res.error.message ?? te("internal"));
      toast.success(t("passwordChanged")); router.push("/login");
    } else {
      const email = String(fd.get("email") ?? "").trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return setErr(te("email"));
      setPending(true);
      await authClient.requestPasswordReset({ email, redirectTo: "/reset" });
      setPending(false); setSent(true);
    }
  }

  return (
    <div>
      <h1 className="t-title text-center">{t("resetTitle")}</h1>
      <p className="mt-2 text-center text-muted">{sent ? t("resetSent") : t("resetLead")}</p>
      {!sent && (
        <form onSubmit={submit} noValidate className="mt-8 space-y-4">
          {token
            ? <Field label={t("newPassword")} htmlFor="password" error={err}><Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!err} /></Field>
            : <Field label={t("email")} htmlFor="email" error={err}><Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!err} /></Field>}
          <Button type="submit" size="lg" className="w-full" loading={pending}>{t(token ? "setPassword" : "resetSend")}</Button>
        </form>
      )}
    </div>
  );
}
