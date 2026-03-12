"use client";

import { useCallback, useState, useTransition } from "react";
import type { SubtitleRepository } from "@/application/ports/subtitle-repository";
import type { SearchResult } from "@/domain/models/subtitle";

interface UseSearchReturn {
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  search: (keyword: string) => void;
  reset: () => void;
  selectedResult: SearchResult | null;
  selectResult: (result: SearchResult) => void;
  keyword: string;
}

export function useSearch(
  repository: SubtitleRepository,
  audioLanguageCode: string,
): UseSearchReturn {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [keyword, setKeyword] = useState<string>("");

  const search = useCallback(
    (kw: string) => {
      const normalizedKeyword = kw.trim();

      if (!normalizedKeyword) {
        setResults([]);
        setKeyword("");
        setError(null);
        setSelectedResult(null);
        return;
      }

      setKeyword(normalizedKeyword);
      setError(null);

      startTransition(async () => {
        try {
          const data = await repository.searchByKeyword(normalizedKeyword, audioLanguageCode);
          setResults(data);
          const firstResult = data[0] ?? null;
          setSelectedResult(firstResult);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Search failed");
          setResults([]);
          setSelectedResult(null);
        }
      });
    },
    [audioLanguageCode, repository],
  );

  const reset = useCallback(() => {
    setResults([]);
    setError(null);
    setSelectedResult(null);
    setKeyword("");
  }, []);

  const selectResult = useCallback((result: SearchResult) => {
    setSelectedResult(result);
  }, []);

  return {
    results,
    isLoading: isPending,
    error,
    search,
    reset,
    selectedResult,
    selectResult,
    keyword,
  };
}
