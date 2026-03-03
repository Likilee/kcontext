"use client";

import { useCallback, useState, useTransition } from "react";
import type { SubtitleRepository } from "@/application/ports/subtitle-repository";
import type { SearchResult } from "@/domain/models/subtitle";

interface UseSearchReturn {
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  search: (keyword: string) => void;
  selectedResult: SearchResult | null;
  selectResult: (result: SearchResult) => void;
  keyword: string;
}

export function useSearch(repository: SubtitleRepository): UseSearchReturn {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [keyword, setKeyword] = useState<string>("");

  const search = useCallback(
    (kw: string) => {
      if (!kw.trim()) {
        setResults([]);
        setKeyword("");
        return;
      }

      setKeyword(kw);
      setError(null);

      startTransition(async () => {
        try {
          const data = await repository.searchByKeyword(kw);
          setResults(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Search failed");
          setResults([]);
        }
      });
    },
    [repository],
  );

  const selectResult = useCallback((result: SearchResult) => {
    setSelectedResult(result);
  }, []);

  return {
    results,
    isLoading: isPending,
    error,
    search,
    selectedResult,
    selectResult,
    keyword,
  };
}
