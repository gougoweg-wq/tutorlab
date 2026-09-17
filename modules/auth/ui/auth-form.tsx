"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { authClient } from "@/modules/auth/client";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/form";

function GoogleIcon() {
  return (<svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.8h3.6c2.1-2 3.3-4.800 3.300-8.100Z"/><path fill="#34A853" d="M12 23c3 0 5.500-1 7.300-2.700l-3.600-2.800c-1 .7-2.300 1.100-3.700 1.100-2.900 0-5.300-1.900-6.200-4.500H2.100v2.900A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.800 14.100a6.600 6.600 0 0 1 0-4.200V7H2.100a11 11 0 0 0 0 10l3.700-2.900Z"/><path fill="#EA4335" d="M12 5.400c1.600 0 3.100.6 4.200 1.600l3.200-3.200A11 11 0 0 0 2.100 7l3.700 2.900c.9-2.600 3.300-4.500 6.200-4.500Z"/></svg>);
}

export function AuthForm({ mode, google, next }: { mode: "login" | "register"; google: boolean; next?: string }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const router = useRouter();
  const sp = useSearchParams();
  const after = next ?? sp.get("next") ?? "/onboarding";
  const [pending, setPending] = React.useState<null | "password" | "google" | "magic">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [magicSent, setMagicSent] = React.useState<string | null>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim(), password = String(fd.get("password") ?? ""), name = String(fd.get("name") ?? "").trim();
    const f: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) f.email = te("email");
    if (password.length < 8) f.password = te("passwordShort");
    if (mode === "register" && name.length < 2) f.name = te("required");
    setFields(f); setError(null);
    if (Object.keys(f).length) return;
    setPending("password");
    const res = mode === "login" ? await authClient.signIn.email({ email, password }) : await authClient.signUp.email({ email, password, name });
    setPending(null);
    if (res.error) {
      const code = res.error.code ?? "";
      setError(res.error.status === 429 ? te("rate_limited") : code.includes("USER_ALREADY_EXISTS") ? t("exists") : mode === "login" ? t("invalid") : (res.error.message ?? te("internal")));
      return;
    }
    router.push(after); router.refresh();
  }

  async function magic() {
    const email = emailRef.current?.value.trim() ?? "";
    if (!/^\S+@\S+\.\S+$/.test(email)) { setFields({ email: te("email") }); emailRef.current?.focus(); return; }
    setPending("magic");
    const res = await authClient.signIn.magicLink({ email, callbackURL: after });
    setPending(null);
    if (res.error) { toast.error(res.error.status === 429 ? te("rate_limited") : te("internal")); return; }
    setMagicSent(email);
  }

  if (magicSent) {
    return (
      <div className="text-center pop">
        <div className="mx-auto mb-5 grid place-items-center size-16 rounded-full bg-accent-soft text-accent-text"><Mail className="size-7" /></div>
        <p className="t-h3 text-balance">{t("magicSent", { email: magicSent })}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="t-title text-center">{t(mode === "login" ? "loginTitle" : "registerTitle")}</h1>
      <p className="mt-2 text-center text-muted">{t(mode === "login" ? "loginLead" : "registerLead")}</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        {mode === "register" && (
          <Field label={t("name")} htmlFor="name" error={fields.name}><Input id="name" name="name" autoComplete="name" aria-invalid={!!fields.name} /></Field>
        )}
        <Field label={t("email")} htmlFor="email" error={fields.email}><Input ref={emailRef} id="email" name="email" type="email" inputMode="email" autoComplete="email" aria-invalid={!!fields.email} /></Field>
        <Field label={t("password")} htmlFor="password" error={fields.password}>
          <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} aria-invalid={!!fields.password} />
        </Field>
        {error && <p role="alert" className="text-[14px] text-bad-text bg-bad-soft rounded-md px-3.5 py-2.5">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={pending === "password"}>{t(mode === "login" ? "signIn" : "signUp")}</Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[13px] text-muted"><span className="h-px flex-1 bg-line" />{t("or")}<span className="h-px flex-1 bg-line" /></div>

      <div className="space-y-2.5">
        {google && (
          <Button type="button" variant="outline" size="lg" className="w-full" loading={pending === "google"}
            onClick={async () => { setPending("google"); await authClient.signIn.social({ provider: "google", callbackURL: after }); }}>
            <GoogleIcon />{t("google")}
          </Button>
        )}
        <Button type="button" variant="secondary" size="lg" className="w-full" loading={pending === "magic"} onClick={magic}><Mail />{t("magic")}</Button>
      </div>

      <p className="mt-8 text-center text-[15px] text-muted">
        {mode === "login" ? (<>{t("noAccount")} <Link className="text-accent-text hover:underline" href={`/register${after !== "/onboarding" ? `?next=${encodeURIComponent(after)}` : ""}`}>{t("signUp")}</Link></>)
          : (<>{t("haveAccount")} <Link className="text-accent-text hover:underline" href={`/login${after !== "/onboarding" ? `?next=${encodeURIComponent(after)}` : ""}`}>{t("signIn")}</Link></>)}
      </p>
      {mode === "login" && <p className="mt-2 text-center text-[15px]"><Link className="text-accent-text hover:underline" href="/reset">{t("forgot")}</Link></p>}
    </div>
  );
}
