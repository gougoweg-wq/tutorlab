import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-[transform,background-color,box-shadow,opacity,color] duration-200 ease-apple active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink hover:bg-accent-hover shadow-sm",
        secondary: "bg-surface-3/70 text-ink hover:bg-surface-3",
        outline: "border border-line-strong text-ink hover:bg-surface-2",
        ghost: "text-accent-text hover:bg-accent-soft",
        quiet: "text-ink-2 hover:bg-surface-3/60",
        danger: "bg-bad-soft text-bad-text hover:bg-bad hover:text-white",
        ink: "bg-ink text-bg hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3.5 text-[13px] rounded-full",
        md: "h-10 px-5 text-[15px] rounded-full",
        lg: "h-12 px-7 text-[17px] rounded-full",
        icon: "size-9 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({ className, variant, size, asChild, loading, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {asChild ? children : (<>{loading && <span className="size-4 rounded-full border-2 border-current border-r-transparent animate-spin" aria-hidden />}{children}</>)}
    </Comp>
  );
}
export { buttonVariants };
