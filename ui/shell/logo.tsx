import Link from "next/link";
import { cn } from "@/ui/cn";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-[-0.03em] text-[17px]", className)}>
      <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
        <rect width="28" height="28" rx="8" fill="var(--ink)" />
        <path d="M8 9.2h12M14 9.2v10.6M9.5 19.8h9" stroke="var(--bg)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </svg>
      TutorLab
    </Link>
  );
}
