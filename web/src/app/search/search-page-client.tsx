"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "@/application/hooks/use-search";
import { ChunkViewer } from "@/components/chunk-viewer";
import { PlayerControls } from "@/components/player-controls";
import { SearchResultNavigation } from "@/components/search-result-navigation";
import { TopNavigation } from "@/components/top-navigation";
import { Card, CardContent } from "@/components/ui/card";
import type { YouTubePlayerHandle } from "@/components/youtube-player";
import { YouTubePlayer } from "@/components/youtube-player";
import type { SubtitleChunk } from "@/domain/models/subtitle";
import { SupabaseSubtitleRepository } from "@/infrastructure/adapters/supabase-subtitle-repository";
import { useSubtitleSync } from "@/lib/use-subtitle-sync";

const repository = new SupabaseSubtitleRepository();
const PLAYBACK_RATES = [0.75, 1, 1.25] as const;
const PRE_ROLL_SECONDS = 0.7;
const EMPTY_RESULT_TEXT =
  "Hmm, even native speakers rarely use this exact phrase. Try searching for a shorter keyword.";

export function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();

  const playerRef = useRef<YouTubePlayerHandle | null>(null);
  const transcriptCache = useRef<Map<string, SubtitleChunk[]>>(new Map());

  const [searchInput, setSearchInput] = useState(query);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [transcriptChunks, setTranscriptChunks] = useState<SubtitleChunk[]>([]);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);

  const { results, isLoading, error, search, selectedResult, selectResult, keyword } =
    useSearch(repository);
  const { activeChunk } = useSubtitleSync(playerRef, transcriptChunks);

  const selectedIndex = useMemo(() => {
    if (!selectedResult) {
      return -1;
    }

    return results.findIndex(
      (result) =>
        result.videoId === selectedResult.videoId && result.startTime === selectedResult.startTime,
    );
  }, [results, selectedResult]);

  const executeSearch = useCallback(
    (keywordToSearch: string) => {
      const normalizedKeyword = keywordToSearch.trim();
      setSearchInput(normalizedKeyword);
      if (!normalizedKeyword) {
        router.push("/");
        return;
      }

      router.push(`/search?q=${encodeURIComponent(normalizedKeyword)}`);
    },
    [router],
  );

  useEffect(() => {
    setSearchInput(query);
    search(query);
  }, [query, search]);

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

    const cached = transcriptCache.current.get(selectedResult.videoId);
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

        transcriptCache.current.set(selectedResult.videoId, chunks);
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
  }, [selectedResult]);

  const handlePreviousResult = useCallback(() => {
    if (selectedIndex <= 0) {
      return;
    }

    const previousResult = results[selectedIndex - 1];
    if (!previousResult) {
      return;
    }

    selectResult(previousResult);
  }, [results, selectResult, selectedIndex]);

  const handleNextResult = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= results.length - 1) {
      return;
    }

    const nextResult = results[selectedIndex + 1];
    if (!nextResult) {
      return;
    }

    selectResult(nextResult);
  }, [results, selectResult, selectedIndex]);

  const handleReplayContext = useCallback(() => {
    if (!selectedResult || !playerRef.current) {
      return;
    }

    playerRef.current.seekTo(selectedResult.startTime);
  }, [selectedResult]);

  const handleSeekBackward = useCallback(() => {
    playerRef.current?.seekBy(-5);
  }, []);

  const handleSeekForward = useCallback(() => {
    playerRef.current?.seekBy(5);
  }, []);

  const handleToggleSpeed = useCallback(() => {
    setPlaybackRate((currentRate) => {
      const currentIndex = PLAYBACK_RATES.indexOf(currentRate as 0.75 | 1 | 1.25);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % PLAYBACK_RATES.length : 1;
      const nextRate = PLAYBACK_RATES[nextIndex] ?? 1;
      playerRef.current?.setPlaybackRate(nextRate);
      return nextRate;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;

      if (isTextInput) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePreviousResult();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNextResult();
        return;
      }

      if (event.key === "r" || event.key === "R" || event.key === " ") {
        event.preventDefault();
        handleReplayContext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleNextResult, handlePreviousResult, handleReplayContext]);

  const playerStartTime = selectedResult
    ? Math.max(0, selectedResult.startTime - PRE_ROLL_SECONDS)
    : 0;

  return (
    <main className="relative min-h-screen bg-[var(--bg-base)] pb-[calc(var(--space-layout-section)+var(--space-safe-bottom))]">
      <TopNavigation
        mode="search"
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearchSubmit={executeSearch}
        isSearchLoading={isLoading}
        onLogoClick={() => {
          router.push("/");
        }}
      />

      <section className="mx-auto flex w-full max-w-4xl flex-col gap-[var(--space-gap-group)] px-[var(--space-layout-screen)] pt-[var(--space-gap-group)]">
        {error ? (
          <Card>
            <CardContent>
              <p className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
                {error}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && !error && keyword.length > 0 && results.length === 0 ? (
          <Card>
            <CardContent>
              <p className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-16)] text-[var(--text-secondary)]">
                {EMPTY_RESULT_TEXT}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {selectedResult ? (
          <>
            <SearchResultNavigation
              keyword={keyword}
              currentIndex={selectedIndex}
              totalCount={results.length}
              onPrevious={handlePreviousResult}
              onNext={handleNextResult}
            />

            <YouTubePlayer
              ref={playerRef}
              videoId={selectedResult.videoId}
              startTime={playerStartTime}
              playbackRate={playbackRate}
            />

            <ChunkViewer
              text={activeChunk?.text ?? null}
              keyword={keyword}
              isLoading={isTranscriptLoading}
            />

            {transcriptError ? (
              <p className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
                {transcriptError}
              </p>
            ) : null}

            <PlayerControls
              onSeekBackward={handleSeekBackward}
              onReplayContext={handleReplayContext}
              onSeekForward={handleSeekForward}
              onToggleSpeed={handleToggleSpeed}
              playbackRate={playbackRate}
              isDisabled={!selectedResult}
            />

            <p className="text-center font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
              Keyboard: ← → switch videos | R or Space replay
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}
