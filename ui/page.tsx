import * as React from "react";
import { cn } from "./cn";

export function PageHeader({ eyebrow, title, lead, actions, className }: { eyebrow?: string; title: string; lead?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4 mb-8 rise", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="t-eyebrow mb-2">{eyebrow}</div>}
        <h1 className="t-title">{title}</h1>
        {lead && <p className="mt-2 text-muted max-w-2xl">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export const Section = ({ title, actions, children, className, i }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; i?: number }) => (
  <section className={cn("mb-10 rise", className)} style={{ "--i": i ?? 1 } as React.CSSProperties}>
    {(title || actions) && <div className="flex items-center justify-between gap-4 mb-4">{title && <h2 className="t-h2">{title}</h2>}{actions}</div>}
    {children}
  </section>
);
