"use client";

import Script from "next/script";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface YouTubePlayerHandle {
  getCurrentTime: () => number;
  seekTo: (seconds: number) => void;
}

interface YouTubePlayerProps {
  videoId: string | null;
  startTime?: number;
  onReady?: () => void;
  onStateChange?: (state: number) => void;
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ videoId, startTime, onReady, onStateChange }, ref) {
    const playerRef = useRef<YT.Player | null>(null);
    const [apiReady, setApiReady] = useState(false);

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      seekTo: (s: number) => {
        const player = playerRef.current;
        if (!player || typeof player.seekTo !== "function") return;
        player.seekTo(s, true);
      },
    }));

    useEffect(() => {
      return () => {
        try {
          playerRef.current?.destroy();
        } catch (_) {
          // ignore
        }
        playerRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (!apiReady || !videoId) return;

      if (playerRef.current) {
        playerRef.current.loadVideoById(videoId, startTime ?? 0);
        return;
      }

      if (typeof window.YT === "undefined" || typeof window.YT.Player !== "function") {
        console.error("YouTubePlayer: YT API is not ready");
        return;
      }

      try {
        playerRef.current = new window.YT.Player("yt-player-iframe", {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            cc_load_policy: 0,
            start: Math.floor(startTime ?? 0),
          },
          events: {
            onReady: () => onReady?.(),
            onStateChange: (e: { data: number }) => onStateChange?.(e.data),
          },
        });
      } catch (e) {
        // YouTube IFrame API initialization failed (e.g. invalid video ID in test env)
        console.error("YouTubePlayer: failed to initialize player", e);
      }
    }, [apiReady, videoId, startTime, onReady, onStateChange]);

    const handleScriptLoad = () => {
      try {
        if (typeof window.YT !== "undefined" && typeof window.YT.Player === "function") {
          setApiReady(true);
        } else {
          window.onYouTubeIframeAPIReady = () => setApiReady(true);
        }
      } catch {
        window.onYouTubeIframeAPIReady = () => setApiReady(true);
      }
    };

    return (
      <>
        <Script
          src="https://www.youtube.com/iframe_api"
          strategy="lazyOnload"
          onLoad={handleScriptLoad}
        />
        <div
          id="yt-player-container"
          className="aspect-video w-full rounded-[var(--radius-08)] overflow-hidden bg-[var(--bg-base)]"
        >
          <div id="yt-player-iframe" className="w-full h-full" />
        </div>
      </>
    );
  },
);
