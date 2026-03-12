"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "@/application/hooks/use-search";
import { useTranscriptLoader } from "@/application/hooks/use-transcript-loader";
import { ChunkViewer } from "@/components/chunk-viewer";
import { PlayerControls } from "@/components/player-controls";
import { SearchResultNavigation } from "@/components/search-result-navigation";
import { TopNavigation } from "@/components/top-navigation";
import { Card, CardContent } from "@/components/ui/card";
import type { YouTubePlayerHandle } from "@/components/youtube-player";
import { YouTubePlayer } from "@/components/youtube-player";
import { SupabaseSubtitleRepository } from "@/infrastructure/adapters/supabase-subtitle-repository";
import { getKoreanSearchPath, KOREAN_HOME_PATH } from "@/lib/app-routes";
import type { SiteConfig } from "@/lib/site-config";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { useSubtitleSync } from "@/lib/use-subtitle-sync";

const repository = new SupabaseSubtitleRepository();
const PLAYBACK_RATES = [0.75, 1, 1.25] as const;
const PRE_ROLL_SECONDS = 0.7;
const EMPTY_RESULT_TEXT =
  "Hmm, even native speakers rarely use this exact phrase. Try searching for a shorter keyword.";

interface SearchPageClientProps {
  siteConfig: SiteConfig;
}

export function SearchPageClient({ siteConfig }: SearchPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();

  const playerRef = useRef<YouTubePlayerHandle | null>(null);

  const [searchInput, setSearchInput] = useState(query);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  const { results, isLoading, error, search, selectedResult, selectResult, keyword } =
    useSearch(repository);
  const { transcriptChunks, transcriptError, isTranscriptLoading } = useTranscriptLoader(
    repository,
    selectedResult,
  );
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
        router.push(KOREAN_HOME_PATH);
        return;
      }

      router.push(getKoreanSearchPath(normalizedKeyword));
    },
    [router],
  );

  useEffect(() => {
    setSearchInput(query);
    search(query);
  }, [query, search]);

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

  useKeyboardShortcuts({
    onPrevious: handlePreviousResult,
    onNext: handleNextResult,
    onReplay: handleReplayContext,
  });

  const playerStartTime = selectedResult
    ? Math.max(0, selectedResult.startTime - PRE_ROLL_SECONDS)
    : 0;

  return (
    <main className="relative min-h-screen bg-[var(--bg-base)] pb-[calc(var(--space-layout-section)+var(--space-safe-bottom))]">
      <TopNavigation
        mode="search"
        siteConfig={siteConfig}
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearchSubmit={executeSearch}
        isSearchLoading={isLoading}
        onLogoClick={() => {
          router.push(KOREAN_HOME_PATH);
        }}
      />

      <section className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-gap-group)] px-[var(--space-layout-screen)] pt-[var(--space-gap-group)]">
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

            <div className="-mx-[var(--space-layout-screen)] w-[calc(100%+var(--space-layout-screen)+var(--space-layout-screen))] lg:mx-0 lg:w-full">
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
                className="rounded-t-none border-t-0"
              />
            </div>

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
