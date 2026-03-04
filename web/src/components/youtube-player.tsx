"use client";

import Script from "next/script";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface YouTubePlayerHandle {
  getCurrentTime: () => number;
  seekTo: (seconds: number) => void;
  seekBy: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
}

interface YouTubePlayerProps {
  videoId: string | null;
  startTime?: number;
  playbackRate: number;
  onReady?: () => void;
  onStateChange?: (state: number) => void;
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ videoId, startTime, playbackRate, onReady, onStateChange }, ref) {
    const playerRef = useRef<YT.Player | null>(null);
    const [apiReady, setApiReady] = useState(false);

    useEffect(() => {
      if (typeof window.YT !== "undefined" && typeof window.YT.Player === "function") {
        setApiReady(true);
        return;
      }

      const previousCallback = window.onYouTubeIframeAPIReady;
      const handleApiReady = () => {
        previousCallback?.();
        setApiReady(true);
      };

      window.onYouTubeIframeAPIReady = handleApiReady;

      return () => {
        if (window.onYouTubeIframeAPIReady === handleApiReady) {
          window.onYouTubeIframeAPIReady = previousCallback;
        }
      };
    }, []);

    const getSafeCurrentTime = () => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function") {
        return 0;
      }

      try {
        const time = player.getCurrentTime();
        return Number.isFinite(time) ? time : 0;
      } catch {
        return 0;
      }
    };

    useImperativeHandle(ref, () => ({
      getCurrentTime: getSafeCurrentTime,
      seekTo: (seconds: number) => {
        const player = playerRef.current;
        if (!player || typeof player.seekTo !== "function") {
          return;
        }

        player.seekTo(Math.max(0, seconds), true);
      },
      seekBy: (seconds: number) => {
        const player = playerRef.current;
        if (!player || typeof player.seekTo !== "function") {
          return;
        }

        const current = getSafeCurrentTime();
        player.seekTo(Math.max(0, current + seconds), true);
      },
      setPlaybackRate: (rate: number) => {
        const player = playerRef.current;
        if (!player || typeof player.setPlaybackRate !== "function") {
          return;
        }

        player.setPlaybackRate(rate);
      },
    }));

    useEffect(() => {
      return () => {
        try {
          playerRef.current?.destroy();
        } catch {
          // ignore cleanup errors
        }
        playerRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (!apiReady || !videoId) {
        return;
      }

      const safeStartTime = Math.max(0, startTime ?? 0);
      const player = playerRef.current;

      if (player && typeof player.loadVideoById === "function") {
        player.loadVideoById(videoId, safeStartTime);
        if (typeof player.setPlaybackRate === "function") {
          player.setPlaybackRate(playbackRate);
        }
        if (typeof player.playVideo === "function") {
          player.playVideo();
        }
        return;
      }

      if (typeof window.YT === "undefined" || typeof window.YT.Player !== "function") {
        return;
      }

      playerRef.current = new window.YT.Player("yt-player-iframe", {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          cc_load_policy: 0,
          disablekb: 1,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          start: Math.floor(safeStartTime),
        },
        events: {
          onReady: () => {
            const readyPlayer = playerRef.current;
            if (readyPlayer && typeof readyPlayer.seekTo === "function") {
              readyPlayer.seekTo(safeStartTime, true);
            }
            if (typeof playerRef.current?.setPlaybackRate === "function") {
              playerRef.current.setPlaybackRate(playbackRate);
            }
            if (typeof playerRef.current?.playVideo === "function") {
              playerRef.current.playVideo();
            }
            onReady?.();
          },
          onStateChange: (event: { data: number }) => onStateChange?.(event.data),
        },
      });
    }, [apiReady, onReady, onStateChange, playbackRate, startTime, videoId]);

    useEffect(() => {
      const player = playerRef.current;
      if (!player || typeof player.setPlaybackRate !== "function") {
        return;
      }

      player.setPlaybackRate(playbackRate);
    }, [playbackRate]);

    const handleScriptLoad = () => {
      if (typeof window.YT !== "undefined" && typeof window.YT.Player === "function") {
        setApiReady(true);
      }
    };

    return (
      <>
        <Script
          src="https://www.youtube.com/iframe_api"
          strategy="afterInteractive"
          onLoad={handleScriptLoad}
          onReady={handleScriptLoad}
        />
        <div
          id="yt-player-container"
          className="aspect-video w-full overflow-hidden bg-[var(--bg-base)]"
        >
          <div id="yt-player-iframe" className="h-full w-full" />
        </div>
      </>
    );
  },
);
