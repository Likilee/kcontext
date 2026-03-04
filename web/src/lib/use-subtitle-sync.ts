"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { SubtitleChunk } from "@/domain/models/subtitle";

interface UseSubtitleSyncReturn {
  activeChunk: SubtitleChunk | null;
  activeIndex: number;
}

export function findActiveChunkIndex(chunks: SubtitleChunk[], currentTime: number): number {
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
  chunks: SubtitleChunk[],
): UseSubtitleSyncReturn {
  const [activeIndex, setActiveIndex] = useState(-1);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (chunks.length === 0) {
      setActiveIndex(-1);
      return;
    }

    const tick = () => {
      const player = playerRef.current;
      if (player && typeof player.getCurrentTime === "function") {
        try {
          const currentTime = player.getCurrentTime();
          const index = findActiveChunkIndex(chunks, currentTime);
          setActiveIndex((previous) => (previous !== index ? index : previous));
        } catch {
          setActiveIndex((previous) => (previous !== -1 ? -1 : previous));
        }
      }
      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId.current);
    };
  }, [chunks, playerRef]);

  const activeChunk = activeIndex >= 0 ? (chunks[activeIndex] ?? null) : null;

  return {
    activeChunk,
    activeIndex,
  };
}
