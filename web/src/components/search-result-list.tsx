"use client";

import type { SearchResult } from "@/domain/models/subtitle";
import { SearchResultCard } from "./search-result-card";

interface SearchResultListProps {
  results: SearchResult[];
  keyword: string;
  selectedResult: SearchResult | null;
  onSelectResult: (result: SearchResult) => void;
  isLoading: boolean;
  error: string | null;
}

export function SearchResultList({
  results,
  keyword,
  selectedResult,
  onSelectResult,
  isLoading,
  error,
}: SearchResultListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-[var(--space-gap-item)]">
        <p className="text-[var(--text-secondary)]">Searching...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-[var(--space-gap-item)]">
        <p className="text-[var(--text-secondary)]">{error}</p>
      </div>
    );
  }

  if (!keyword) {
    return null;
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col gap-[var(--space-gap-item)]">
        <p className="text-[var(--text-secondary)] text-center">
          Hmm, even native speakers rarely use this exact phrase. Try searching for a shorter
          keyword!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-gap-item)]">
      {results.map((result) => (
        <SearchResultCard
          key={`${result.videoId}-${result.startTime}`}
          result={result}
          keyword={keyword}
          isSelected={
            selectedResult?.videoId === result.videoId &&
            selectedResult?.startTime === result.startTime
          }
          onClick={() => onSelectResult(result)}
        />
      ))}
    </div>
  );
}
