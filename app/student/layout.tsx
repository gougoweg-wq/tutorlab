import { getTranslations } from "next-intl/server";
import { House } from "lucide-react";
import { requireStudentPage } from "@/modules/auth/context";
import { Logo } from "@/ui/shell/logo";
import { TabLink, TopLink } from "@/ui/shell/nav-link";
import { UserMenu } from "@/ui/shell/user-menu";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStudentPage();
  const t = await getTranslations("nav");
  const links = [
    { href: "/student", exact: true, icon: <House />, label: t("today") },
  ];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 glass border-b pt-[env(safe-area-inset-top)]">
        <div className="max-w-[980px] mx-auto h-14 px-5 flex items-center justify-between gap-4">
          <Logo href="/student" />
          <nav className="hidden sm:flex items-center gap-1" aria-label={t("menu")}>{links.map((l) => <TopLink key={l.href} href={l.href} exact={l.exact}>{l.label}</TopLink>)}</nav>
          <UserMenu name={ctx.user.name} email={ctx.user.email} />
        </div>
      </header>
      <main id="main" className="max-w-[980px] mx-auto px-5 py-8 sm:py-12 pb-28 sm:pb-16">{children}</main>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 glass border-t flex pb-[env(safe-area-inset-bottom)]" aria-label={t("menu")}>
        {links.map((l) => <TabLink key={l.href} href={l.href} exact={l.exact} icon={l.icon}>{l.label}</TabLink>)}
      </nav>
    </div>
  );
}
