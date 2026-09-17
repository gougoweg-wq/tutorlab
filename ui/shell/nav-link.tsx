"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/ui/cn";

export function SideLink({ href, exact, icon, children }: { href: string; exact?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("group flex items-center gap-3 h-10 px-3 rounded-[12px] text-[15px] font-medium transition-[background-color,color] duration-200 ease-apple [&_svg]:size-[18px] [&_svg]:shrink-0",
        active ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:bg-surface/60 hover:text-ink")}>
      <span className={cn("transition-colors", active ? "text-accent" : "text-muted group-hover:text-ink-2")}>{icon}</span>
      <span className="truncate">{children}</span>
    </Link>
  );
}

export function TabLink({ href, exact, icon, children }: { href: string; exact?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 h-14 text-[10.5px] font-medium transition-colors duration-200 [&_svg]:size-[23px]", active ? "text-accent" : "text-muted")}>
      <span className={cn("transition-transform duration-300 ease-spring", active && "scale-110")}>{icon}</span>
      {children}
    </Link>
  );
}

export function TopLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return <Link href={href} aria-current={active ? "page" : undefined} className={cn("h-8 px-3.5 grid place-items-center rounded-full text-[14px] font-medium transition-colors duration-200", active ? "bg-surface-3/80 text-ink" : "text-ink-2 hover:text-ink")}>{children}</Link>;
}
