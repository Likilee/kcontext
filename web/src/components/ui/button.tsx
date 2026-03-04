import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-[var(--space-gap-micro)]",
    "whitespace-nowrap font-[family-name:var(--font-family-sans)]",
    "outline-none transition-transform duration-[var(--duration-fast)]",
    "active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
    "focus-visible:ring-1 focus-visible:ring-[var(--border-focus)]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]",
        ghost:
          "rounded-[var(--radius-pill)] border border-transparent bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        outline:
          "rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface)]",
        accent:
          "rounded-[var(--radius-pill)] border border-[var(--border-focus)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface)]",
      },
      size: {
        default: "min-h-[var(--space-layout-section)] px-[var(--space-inset-base)]",
        compact:
          "min-h-[calc(var(--space-gap-group)+var(--space-inset-squish-y))] px-[var(--space-inset-base)]",
        icon: "min-h-[var(--space-layout-section)] min-w-[var(--space-layout-section)] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
