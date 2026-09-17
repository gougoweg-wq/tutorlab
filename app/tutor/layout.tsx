import { getTranslations } from "next-intl/server";
import { CalendarDays, ClipboardList, LayoutDashboard, Library, Users } from "lucide-react";
import { requireTutorPage } from "@/modules/auth/context";
import { Logo } from "@/ui/shell/logo";
import { SideLink, TabLink } from "@/ui/shell/nav-link";
import { UserMenu } from "@/ui/shell/user-menu";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireTutorPage();
  const t = await getTranslations("nav");
  const links = [
    { href: "/tutor", exact: true, icon: <LayoutDashboard />, label: t("dashboard") },
    { href: "/tutor/students", icon: <Users />, label: t("students") },
    { href: "/tutor/assessments", icon: <ClipboardList />, label: t("assessments") },
    { href: "/tutor/questions", icon: <Library />, label: t("questions") },
    { href: "/tutor/lessons", icon: <CalendarDays />, label: t("lessons") },
  ];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="hidden lg:flex flex-col gap-1 sticky top-0 h-dvh p-4 border-r border-line bg-surface-2/60">
        <div className="px-3 pt-2 pb-5"><Logo href="/tutor" /></div>
        <nav className="flex flex-col gap-0.5" aria-label={t("menu")}>
          {links.map((l) => <SideLink key={l.href} href={l.href} exact={l.exact} icon={l.icon}>{l.label}</SideLink>)}
        </nav>
        <div className="mt-auto flex items-center gap-3 px-2 pt-4 border-t border-line">
          <UserMenu name={ctx.user.name} email={ctx.user.email} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold truncate">{ctx.user.name}</div>
            <div className="text-[12px] text-muted truncate">{ctx.workspaceName}</div>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="lg:hidden sticky top-0 z-40 glass border-b h-14 px-4 flex items-center justify-between pt-[env(safe-area-inset-top)]">
          <Logo href="/tutor" /><UserMenu name={ctx.user.name} email={ctx.user.email} />
        </header>
        <main id="main" className="px-5 sm:px-8 lg:px-12 py-8 lg:py-12 pb-28 lg:pb-16 max-w-[1240px] mx-auto">{children}</main>
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t flex pb-[env(safe-area-inset-bottom)]" aria-label={t("menu")}>
          {links.slice(0, 5).map((l) => <TabLink key={l.href} href={l.href} exact={l.exact} icon={l.icon}>{l.label}</TabLink>)}
        </nav>
      </div>
    </div>
  );
}
