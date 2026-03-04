import type { InputHTMLAttributes } from "react";
import { cn } from "./utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        [
          "w-full rounded-[var(--radius-pill)] border border-[var(--border-default)]",
          "bg-[var(--bg-surface)] text-[var(--text-primary)]",
          "px-[var(--space-inset-base)] py-[var(--space-inset-squish-y)]",
          "font-[family-name:var(--font-family-sans)]",
          "placeholder:text-[var(--text-disabled)] outline-none",
          "focus-visible:border-[var(--border-focus)] focus-visible:ring-1 focus-visible:ring-[var(--border-focus)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        ].join(" "),
        className,
      )}
      {...props}
    />
  );
}
