import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getContext, getSessionUser, homeFor } from "@/modules/auth/context";
import { googleEnabled } from "@/modules/auth/auth";
import { AuthForm } from "@/modules/auth/ui/auth-form";

export const metadata = { title: "Вход" };

export default async function LoginPage() {
  if (await getSessionUser()) { const ctx = await getContext(); redirect(ctx ? homeFor(ctx.role) : "/onboarding"); }
  return <Suspense><AuthForm mode="login" google={googleEnabled()} /></Suspense>;
}
