"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "./cn";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ title, description, children, className, wide }: { title: string; description?: string; children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[6px] data-[state=open]:animate-[fade_.25s_var(--ease)] data-[state=closed]:opacity-0 transition-opacity" />
      <D.Content className={cn("fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-h-[calc(100dvh-48px)] overflow-y-auto scroll-thin bg-elevated rounded-xl shadow-lg border border-line p-6 sm:p-8 data-[state=open]:animate-[pop_.4s_var(--ease)]", wide ? "max-w-3xl" : "max-w-lg", className)}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <D.Title className="t-h2">{title}</D.Title>
            {description && <D.Description className="t-small text-muted mt-1">{description}</D.Description>}
          </div>
          <D.Close className="grid place-items-center size-8 -mr-1 -mt-1 rounded-full bg-surface-3/70 text-ink-2 hover:bg-surface-3 transition-colors" aria-label="Close"><X className="size-4" /></D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
