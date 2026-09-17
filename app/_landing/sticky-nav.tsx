"use client";
import * as React from "react";
import Link from "next/link";
import { Logo } from "@/ui/shell/logo";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";

export function StickyNav({ login, start }: { login: string; start: string }) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => { const on = () => setScrolled(window.scrollY > 8); on(); window.addEventListener("scroll", on, { passive: true }); return () => window.removeEventListener("scroll", on); }, []);
  return (
    <header className={cn("fixed top-0 inset-x-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ease-apple border-b pt-[env(safe-area-inset-top)]", scrolled ? "glass" : "border-transparent")}>
      <div className="max-w-[1080px] mx-auto h-12 px-5 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1.5">
          <Button asChild variant="quiet" size="sm"><Link href="/login">{login}</Link></Button>
          <Button asChild size="sm"><Link href="/register">{start}</Link></Button>
        </div>
      </div>
    </header>
  );
}
