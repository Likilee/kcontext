"use client";

import type React from "react";

interface ChunkViewerProps {
  text: string | null;
  keyword: string;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightKeyword(text: string, keyword: string): React.ReactNode {
  if (!keyword.trim()) return text;
  const regex = new RegExp(`(${escapeRegex(keyword)})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) => {
    const key = `${i}-${part.slice(0, 8)}`;
    return regex.test(part) ? (
      <mark
        key={key}
        className="bg-[var(--brand-highlight)] text-[var(--text-inverse)] rounded-[var(--radius-04)] px-[var(--space-gap-micro)]"
      >
        {part}
      </mark>
    ) : (
      <span key={key}>{part}</span>
    );
  });
}

export function ChunkViewer({ text, keyword }: ChunkViewerProps) {
  return (
    <div data-testid="chunk-viewer" className="p-[var(--space-inset-base)] min-h-[80px]">
      {text !== null && (
        <p className="font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-20)] font-medium leading-[var(--line-height-relaxed)] text-[var(--text-primary)] break-keep">
          {highlightKeyword(text, keyword)}
        </p>
      )}
    </div>
  );
}
