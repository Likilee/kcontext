"use client";

import type React from "react";
import type { SearchResult } from "@/domain/models/subtitle";

interface SearchResultCardProps {
  result: SearchResult;
  keyword: string;
  isSelected: boolean;
  onClick: () => void;
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

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

export function SearchResultCard({ result, keyword, isSelected, onClick }: SearchResultCardProps) {
  return (
    <button
      type="button"
      data-testid="search-result-card"
      onClick={onClick}
      className={[
        "w-full text-left cursor-pointer bg-[var(--bg-surface)] rounded-[var(--radius-08)] p-[var(--space-inset-base)]",
        "hover:bg-[var(--bg-surface-hover)]",
        "active:scale-[0.96] transition-transform duration-[var(--duration-fast)]",
        isSelected ? "ring-1 ring-[var(--border-focus)]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-[var(--space-gap-micro)]">
        <div className="flex items-center justify-between gap-[var(--space-gap-item)]">
          <p
            data-testid="video-title"
            className="font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-16)] font-bold text-[var(--text-primary)] truncate"
          >
            {result.title}
          </p>
          <span className="text-[length:var(--font-size-13)] text-[var(--text-secondary)] shrink-0">
            {formatTimestamp(result.startTime)}
          </span>
        </div>
        <p
          data-testid="channel-name"
          className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]"
        >
          {result.channelName}
        </p>
        <p className="font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-16)] text-[var(--text-primary)]">
          {highlightKeyword(result.matchedText, keyword)}
        </p>
      </div>
    </button>
  );
}
