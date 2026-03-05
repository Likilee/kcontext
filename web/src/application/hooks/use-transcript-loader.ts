"use client";

import { useEffect, useState } from "react";
import type { SubtitleRepository } from "@/application/ports/subtitle-repository";
import type { SearchResult, SubtitleChunk } from "@/domain/models/subtitle";

const transcriptCache = new Map<string, SubtitleChunk[]>();

interface UseTranscriptLoaderReturn {
  transcriptChunks: SubtitleChunk[];
  transcriptError: string | null;
  isTranscriptLoading: boolean;
}

export function useTranscriptLoader(
  repository: SubtitleRepository,
  selectedResult: SearchResult | null,
): UseTranscriptLoaderReturn {
  const [transcriptChunks, setTranscriptChunks] = useState<SubtitleChunk[]>([]);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!selectedResult) {
      setTranscriptChunks([]);
      setTranscriptError(null);
      setIsTranscriptLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const cached = transcriptCache.get(selectedResult.videoId);
    if (cached) {
      setTranscriptChunks(cached);
      setTranscriptError(null);
      setIsTranscriptLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsTranscriptLoading(true);
    setTranscriptError(null);
    setTranscriptChunks([]);

    void repository
      .getFullTranscript(selectedResult.videoId)
      .then((chunks) => {
        if (cancelled) {
          return;
        }

        transcriptCache.set(selectedResult.videoId, chunks);
        setTranscriptChunks(chunks);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setTranscriptChunks([]);
        setTranscriptError(
          loadError instanceof Error ? loadError.message : "Failed to load subtitles.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsTranscriptLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repository, selectedResult]);

  return { transcriptChunks, transcriptError, isTranscriptLoading };
}
