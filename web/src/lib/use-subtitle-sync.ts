"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SyncChunk {
  startTime: number;
  duration: number;
  text: string;
}

interface UseSubtitleSyncReturn {
  activeChunk: SyncChunk | null;
  activeIndex: number;
  loadTranscript: (videoId: string) => Promise<void>;
  isLoaded: boolean;
}

export function findActiveChunkIndex(chunks: SyncChunk[], currentTime: number): number {
  if (chunks.length === 0) {
    return -1;
  }

  let low = 0;
  let high = chunks.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const chunk = chunks[mid];
    if (!chunk) {
      return -1;
    }

    const chunkEnd = chunk.startTime + chunk.duration;
    if (currentTime >= chunk.startTime && currentTime < chunkEnd) {
      return mid;
    }

    if (currentTime < chunk.startTime) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return -1;
}

export function useSubtitleSync(
  playerRef: React.RefObject<{ getCurrentTime: () => number } | null>,
  cdnBaseUrl: string,
): UseSubtitleSyncReturn {
  const [chunks, setChunks] = useState<SyncChunk[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoaded, setIsLoaded] = useState(false);
  const rafId = useRef<number>(0);

  const loadTranscript = useCallback(
    async (videoId: string) => {
      setIsLoaded(false);
      const response = await fetch(`${cdnBaseUrl}/subtitles/${videoId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load transcript: ${response.status}`);
      }

      const data: Array<{ start_time: number; duration: number; text: string }> =
        (await response.json()) as Array<{ start_time: number; duration: number; text: string }>;

      const mapped: SyncChunk[] = data.map((chunk) => ({
        startTime: chunk.start_time,
        duration: chunk.duration,
        text: chunk.text,
      }));

      setChunks(mapped);
      setIsLoaded(true);
    },
    [cdnBaseUrl],
  );

  useEffect(() => {
    if (!isLoaded || chunks.length === 0) {
      return;
    }

    const tick = () => {
      const player = playerRef.current;
      if (player) {
        const currentTime = player.getCurrentTime();
        const index = findActiveChunkIndex(chunks, currentTime);
        setActiveIndex((previous) => (previous !== index ? index : previous));
      }
      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId.current);
    };
  }, [chunks, isLoaded, playerRef]);

  const activeChunk = activeIndex >= 0 ? (chunks[activeIndex] ?? null) : null;

  return {
    activeChunk,
    activeIndex,
    loadTranscript,
    isLoaded,
  };
}
