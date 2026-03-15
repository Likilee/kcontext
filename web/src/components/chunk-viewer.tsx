"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";
import { renderHighlightedText } from "./highlighted-text";

interface ChunkViewerProps {
  text: string | null;
  keyword: string;
  isLoading: boolean;
  className?: string;
  contentClassName?: string;
  loadingAriaLabel: string;
}

export function ChunkViewer({
  text,
  keyword,
  isLoading,
  className,
  contentClassName,
  loadingAriaLabel,
}: ChunkViewerProps) {
  let content: ReactNode = null;

  if (isLoading) {
    content = (
      <output
        aria-label={loadingAriaLabel}
        aria-live="polite"
        className="flex h-full flex-col justify-center gap-[var(--space-gap-group)]"
      >
        <div className="flex flex-col items-center gap-[var(--space-gap-item)]">
          <div className="h-[var(--font-size-20)] w-11/12 animate-pulse rounded-[var(--radius-04)] bg-[var(--bg-surface-hover)]" />
          <div className="h-[var(--font-size-20)] w-8/12 animate-pulse rounded-[var(--radius-04)] bg-[var(--bg-surface-hover)]" />
        </div>
      </output>
    );
  } else if (text !== null) {
    content = (
      <div className="grid h-full place-items-center">
        <div className="max-h-full w-full overflow-y-auto">
          <p className="break-keep text-center font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-20)] font-medium leading-[var(--line-height-relaxed)] text-[var(--text-primary)]">
            {renderHighlightedText(text, keyword)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card data-testid="chunk-viewer" className={className}>
      <CardContent className={cn("h-[calc(var(--space-layout-section)*2)]", contentClassName)}>
        {content}
      </CardContent>
    </Card>
  );
}
