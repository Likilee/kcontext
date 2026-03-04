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
}

export function ChunkViewer({
  text,
  keyword,
  isLoading,
  className,
  contentClassName,
}: ChunkViewerProps) {
  let content: ReactNode = null;

  if (isLoading) {
    content = (
      <p className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
        Loading subtitles...
      </p>
    );
  } else if (text !== null) {
    content = (
      <p className="break-keep text-center font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-20)] font-medium leading-[var(--line-height-relaxed)] text-[var(--text-primary)]">
        {renderHighlightedText(text, keyword)}
      </p>
    );
  }

  return (
    <Card data-testid="chunk-viewer" className={className}>
      <CardContent className={cn("min-h-[calc(var(--space-layout-section)*2)]", contentClassName)}>
        {content}
      </CardContent>
    </Card>
  );
}
