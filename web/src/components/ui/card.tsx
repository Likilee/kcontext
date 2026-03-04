import type { HTMLAttributes } from "react";
import { cn } from "./utils";

type CardProps = HTMLAttributes<HTMLDivElement>;

type CardContentProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-08)] border border-[var(--border-default)] bg-[var(--bg-surface)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardContentProps) {
  return <div className={cn("p-[var(--space-inset-base)]", className)} {...props} />;
}
