import * as React from "react";
import { cn } from "./cn";

/** Surface container. `interactive` adds the lift-on-hover used by clickable tiles. */
export function Card({ className, interactive, ...p }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div className={cn("bg-surface rounded-lg border border-line shadow-sm", interactive && "transition-[transform,box-shadow] duration-300 ease-apple hover:-translate-y-0.5 hover:shadow-md", className)} {...p} />;
}
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("px-6 pt-5 pb-3 flex items-start justify-between gap-4", className)} {...p} />;
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn("t-h3", className)} {...p} />;
export const CardBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("px-6 pb-6", className)} {...p} />;

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "ok" | "warn" | "bad" }) {
  return (
    <Card className="p-5">
      <div className="t-caption">{label}</div>
      <div className={cn("mt-1 text-[34px] leading-none font-bold tracking-[-0.035em] tnum", tone === "ok" && "text-ok-text", tone === "warn" && "text-warn-text", tone === "bad" && "text-bad-text")}>{value}</div>
      {sub && <div className="mt-2 t-small text-muted">{sub}</div>}
    </Card>
  );
}
