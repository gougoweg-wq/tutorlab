import { redirect } from "next/navigation";
import { getContext, getSessionUser, homeFor } from "@/modules/auth/context";
import { OnboardingForm } from "@/modules/auth/ui/onboarding-form";
import { Logo } from "@/ui/shell/logo";

export const metadata = { title: "Начало" };

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const ctx = await getContext();
  if (ctx && !(ctx.role === "student" && !ctx.studentId)) redirect(homeFor(ctx.role));
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-14 px-5 flex items-center max-w-[980px] w-full mx-auto"><Logo /></header>
      <main id="main" className="flex-1 grid place-items-center px-5 py-10"><div className="w-full max-w-[440px] rise"><OnboardingForm defaultName="" /></div></main>
    </div>
  );
}
