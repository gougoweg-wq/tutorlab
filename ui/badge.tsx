import * as React from "react";
import { cn } from "./cn";

const tones = {
  neutral: "bg-surface-3/70 text-ink-2",
  accent: "bg-accent-soft text-accent-text",
  ok: "bg-ok-soft text-ok-text",
  warn: "bg-warn-soft text-warn-text",
  bad: "bg-bad-soft text-bad-text",
} as const;

export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[12px] font-medium whitespace-nowrap", tones[tone], className)} {...p} />;
}

/** Five dots, the product-wide way to show 1–5 difficulty. */
export function Difficulty({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-[3px] items-center", className)} role="img" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={cn("size-[6px] rounded-full", i <= value ? "bg-ink-2" : "bg-surface-3")} />)}
    </span>
  );
}
