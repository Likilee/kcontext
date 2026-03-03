"use client";

import { useRef } from "react";
import { useSearch } from "@/application/hooks/use-search";
import { ChunkViewer } from "@/components/chunk-viewer";
import { PlayerControls } from "@/components/player-controls";
import { SearchBar } from "@/components/search-bar";
import { SearchResultList } from "@/components/search-result-list";
import type { YouTubePlayerHandle } from "@/components/youtube-player";
import { YouTubePlayer } from "@/components/youtube-player";
import type { SearchResult } from "@/domain/models/subtitle";
import { SupabaseSubtitleRepository } from "@/infrastructure/adapters/supabase-subtitle-repository";
import { useSubtitleSync } from "@/lib/use-subtitle-sync";

const repository = new SupabaseSubtitleRepository();

export default function HomePage() {
  const playerRef = useRef<YouTubePlayerHandle | null>(null);
  const cdnBaseUrl = process.env.NEXT_PUBLIC_CDN_URL ?? "";

  const { results, isLoading, error, search, selectedResult, selectResult, keyword } =
    useSearch(repository);

  const { activeChunk, loadTranscript } = useSubtitleSync(playerRef, cdnBaseUrl);

  const handleSearch = (kw: string) => {
    search(kw);
  };

  const handleSelectResult = (result: SearchResult) => {
    selectResult(result);
    void loadTranscript(result.videoId);
  };

  const handleReplayContext = () => {
    if (selectedResult && playerRef.current) {
      playerRef.current.seekTo(selectedResult.startTime);
    }
  };

  return (
    <main className="min-h-screen px-[var(--space-layout-screen)] py-[var(--space-layout-section)]">
      <div className="mb-[var(--space-gap-group)]">
        <SearchBar onSearch={handleSearch} isLoading={isLoading} />
      </div>

      <div className="flex flex-col lg:flex-row gap-[var(--space-gap-group)]">
        <div className="lg:w-[360px] lg:shrink-0 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
          <SearchResultList
            results={results}
            keyword={keyword}
            selectedResult={selectedResult}
            onSelectResult={handleSelectResult}
            isLoading={isLoading}
            error={error}
          />
        </div>

        <div className="flex-1 min-w-0">
          {selectedResult ? (
            <>
              <YouTubePlayer
                ref={playerRef}
                videoId={selectedResult.videoId}
                startTime={selectedResult.startTime}
              />
              <div className="mt-[var(--space-gap-group)]">
                <ChunkViewer text={activeChunk?.text ?? null} keyword={keyword} />
              </div>
              <div className="mt-[var(--space-gap-item)]">
                <PlayerControls
                  onReplayContext={handleReplayContext}
                  isDisabled={!selectedResult}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center aspect-video rounded-[var(--radius-08)] bg-[var(--bg-surface)]">
              <p className="text-[var(--text-disabled)] text-[length:var(--font-size-16)]">
                Search for Korean and select a result to start watching.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
