"use client";

import type React from "react";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderHighlightedText(text: string, keyword: string): React.ReactNode {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return text;
  }

  const regex = new RegExp(`(${escapeRegex(normalizedKeyword)})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const key = `${index}-${part.slice(0, 8)}`;
    const isMatch = part.toLowerCase() === normalizedKeyword.toLowerCase();

    if (!isMatch) {
      return <span key={key}>{part}</span>;
    }

    return (
      <mark
        key={key}
        className="rounded-[var(--radius-04)] bg-[var(--brand-highlight)] px-[var(--space-gap-micro)] text-[var(--text-inverse)]"
      >
        {part}
      </mark>
    );
  });
}
