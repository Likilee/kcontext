"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    <Card>
      <CardContent>
        <p className="text-center font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
          "<span className="text-[var(--text-primary)]">{keyword}</span>" in native videos (
          {safeCurrent}/{totalCount})
        </p>
        <div className="mt-[var(--space-gap-item)] grid grid-cols-2 gap-[var(--space-gap-item)]">
          <Button
            type="button"
            variant="outline"
            onClick={onPrevious}
            disabled={isPreviousDisabled}
            className="text-[length:var(--font-size-13)]"
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onNext}
            disabled={isNextDisabled}
            className="text-[length:var(--font-size-13)]"
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
