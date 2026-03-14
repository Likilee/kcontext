"use client";

import { cn } from "@/components/ui/utils";
import type { SearchResult } from "@/domain/models/subtitle";
import { getDisplayChannelName, getDisplayVideoTitle } from "@/lib/video-meta-fallback";
import { renderHighlightedText } from "./highlighted-text";

interface SearchResultCardProps {
  result: SearchResult;
  keyword: string;
  isSelected: boolean;
  onClick: () => void;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

export function SearchResultCard({ result, keyword, isSelected, onClick }: SearchResultCardProps) {
  const displayTitle = getDisplayVideoTitle(result.title);
  const displayChannelName = getDisplayChannelName(result.channelName);

  return (
    <button
      type="button"
      data-testid="search-result-card"
      onClick={onClick}
      className={cn(
        "w-full cursor-pointer rounded-[var(--radius-08)] border p-[var(--space-inset-base)] text-left transition-transform duration-[var(--duration-fast)] active:scale-[0.96]",
        isSelected
          ? "border-[var(--border-focus)] bg-[var(--bg-surface-hover)]"
          : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]",
      )}
    >
      <div className="flex flex-col gap-[var(--space-gap-micro)]">
        <div className="flex items-center justify-between gap-[var(--space-gap-item)]">
          <p
            data-testid="video-title"
            className="truncate font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-16)] font-bold text-[var(--text-primary)]"
          >
            {displayTitle}
          </p>
          <span className="shrink-0 text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
            {formatTimestamp(result.startTime)}
          </span>
        </div>
        <p
          data-testid="channel-name"
          className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]"
        >
          {displayChannelName}
        </p>
        <p className="break-keep font-[family-name:var(--font-family-kr)] text-[length:var(--font-size-16)] text-[var(--text-primary)]">
          {renderHighlightedText(result.matchedText, keyword)}
        </p>
      </div>
    </button>
  );
}
