"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { renderHighlightedText } from "./highlighted-text";

interface ChunkViewerProps {
  text: string | null;
  keyword: string;
  isLoading: boolean;
}

export function ChunkViewer({ text, keyword, isLoading }: ChunkViewerProps) {
  let content: ReactNode = (
    <p className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
      Select a context to start syncing subtitles.
    </p>
  );

  if (isLoading) {
    content = (
      <p className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
        Loading subtitles...
      </p>
    );
  } else if (text !== null) {
    content = (
      <p className="break-keep font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-20)] font-medium leading-[var(--line-height-relaxed)] text-[var(--text-primary)]">
        {renderHighlightedText(text, keyword)}
      </p>
    );
  }

  return (
    <Card data-testid="chunk-viewer">
      <CardContent className="min-h-[calc(var(--space-layout-section)+var(--space-gap-group))]">
        {content}
      </CardContent>
    </Card>
  );
}
