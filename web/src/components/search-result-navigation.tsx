"use client";

import { Button } from "@/components/ui/button";

interface SearchResultNavigationProps {
  keyword: string;
  currentIndex: number;
  totalCount: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function SearchResultNavigation({
  keyword,
  currentIndex,
  totalCount,
  onPrevious,
  onNext,
}: SearchResultNavigationProps) {
  const safeCurrent = currentIndex >= 0 ? currentIndex + 1 : 0;
  const isPreviousDisabled = totalCount <= 1 || safeCurrent <= 1;
  const isNextDisabled = totalCount <= 1 || safeCurrent >= totalCount;

  return (
    <div
      data-testid="search-result-navigation"
      className="flex items-center gap-[var(--space-gap-item)]"
    >
      <Button
        type="button"
        variant="outline"
        size="compact"
        onClick={onPrevious}
        disabled={isPreviousDisabled}
        className="shrink-0 px-[var(--space-inset-squish-x)] text-[length:var(--font-size-13)]"
      >
        Prev
      </Button>

      <p className="min-w-0 flex flex-1 items-center justify-center gap-[var(--space-gap-micro)] text-center font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
        <span className="min-w-0 truncate">
          "<span className="text-[var(--text-primary)]">{keyword}</span>"
        </span>
        <span className="shrink-0">
          ({safeCurrent}/{totalCount})
        </span>
      </p>

      <Button
        type="button"
        variant="outline"
        size="compact"
        onClick={onNext}
        disabled={isNextDisabled}
        className="shrink-0 px-[var(--space-inset-squish-x)] text-[length:var(--font-size-13)]"
      >
        Next
      </Button>
    </div>
  );
}
