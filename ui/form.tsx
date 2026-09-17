import * as React from "react";
import { cn } from "./cn";

const field = "w-full bg-surface text-ink placeholder:text-faint border border-line-strong rounded-md px-3.5 text-[16px] transition-[border-color,box-shadow] duration-200 ease-apple focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft disabled:opacity-50 aria-[invalid=true]:border-bad aria-[invalid=true]:ring-bad-soft";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(field, "h-11", className)} {...p} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, "py-2.5 min-h-24 leading-relaxed", className)} {...p} />,
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...p }, ref) => (
    <select ref={ref} className={cn(field, "h-11 pr-9 appearance-none bg-no-repeat bg-[right_0.8rem_center] bg-[length:12px] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 8%22 fill=%22none%22 stroke=%22%2386868b%22 stroke-width=%221.8%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M1 1.5 6 6.5l5-5%22/></svg>')]", className)} {...p}>{children}</select>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-[13px] font-medium text-ink-2 mb-1.5", className)} {...p} />;
}

/** Label + control + hint/error, wired with aria attributes. */
export function Field({ label, hint, error, htmlFor, children, className }: { label: string; hint?: string; error?: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-[13px] text-bad-text">{error}</p>
        : hint ? <p id={`${htmlFor}-hint`} className="mt-1.5 text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn("size-[18px] rounded-[5px] accent-[var(--accent)] align-[-3px]", className)} {...p} />;
}

export function Switch({ checked, onChange, id, label }: { checked: boolean; onChange: (v: boolean) => void; id: string; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} id={id} onClick={() => onChange(!checked)}
      className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 ease-apple", checked ? "bg-ok" : "bg-surface-3")}>
      <span className={cn("absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-md transition-transform duration-300 ease-spring", checked && "translate-x-5")} />
    </button>
  );
}
