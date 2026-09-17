"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tabs";
import { cn } from "./cn";

export const Tabs = T.Root;
export const TabsContent = ({ className, ...p }: React.ComponentProps<typeof T.Content>) => <T.Content className={cn("mt-5 focus-visible:outline-none data-[state=active]:animate-[rise_.45s_var(--ease)]", className)} {...p} />;

/** iOS-style segmented control */
export function TabsList({ className, ...p }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("inline-flex p-[3px] rounded-full bg-surface-3/70 gap-[2px] max-w-full overflow-x-auto scroll-thin", className)} {...p} />;
}
export function TabsTrigger({ className, ...p }: React.ComponentProps<typeof T.Trigger>) {
  return <T.Trigger className={cn("h-8 px-4 rounded-full text-[14px] font-medium text-ink-2 whitespace-nowrap transition-[background-color,color,box-shadow] duration-250 ease-apple data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm", className)} {...p} />;
}

/** Same look for non-Radix use (filters, toggles). */
export function Segmented<T extends string>({ value, onChange, options, className, ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex p-[3px] rounded-full bg-surface-3/70 gap-[2px] max-w-full overflow-x-auto scroll-thin", className)}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("h-8 px-4 rounded-full text-[14px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-250 ease-apple", value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
