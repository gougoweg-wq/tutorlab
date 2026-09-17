import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getContext, getSessionUser, homeFor } from "@/modules/auth/context";
import { googleEnabled } from "@/modules/auth/auth";
import { AuthForm } from "@/modules/auth/ui/auth-form";

export const metadata = { title: "Регистрация" };

export default async function RegisterPage() {
  if (await getSessionUser()) { const ctx = await getContext(); redirect(ctx ? homeFor(ctx.role) : "/onboarding"); }
  return <Suspense><AuthForm mode="register" google={googleEnabled()} /></Suspense>;
}
