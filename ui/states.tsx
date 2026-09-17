import * as React from "react";
import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) { return <div className={cn("skeleton h-4", className)} aria-hidden />; }

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-3" aria-busy="true">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}</div>;
}

/** Empty state: says what this place is for and offers the next action. */
export function EmptyState({ icon, title, text, action, className }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center text-center px-6 py-14", className)}>
      {icon && <div className="mb-4 grid place-items-center size-14 rounded-2xl bg-surface-2 text-muted [&_svg]:size-6">{icon}</div>}
      <h3 className="t-h3">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm t-small text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, text, retry }: { title: string; text?: string; retry?: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-lg bg-bad-soft text-bad-text px-5 py-4">
      <div className="font-semibold">{title}</div>
      {text && <div className="t-small mt-0.5 opacity-90">{text}</div>}
      {retry && <div className="mt-3">{retry}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = "accent", className, label }: { value: number; tone?: "accent" | "ok" | "warn" | "bad" | "neutral"; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const bg = { accent: "bg-accent", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", neutral: "bg-faint" }[tone];
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn("h-1.5 w-full rounded-full bg-surface-3 overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-apple", bg)} style={{ width: `${v}%` }} />
    </div>
  );
}
