"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PLAYER_FALLBACK_TITLE = "Video playback is temporarily unavailable.";
const PLAYER_FALLBACK_DESCRIPTION =
  "You can keep reading the transcript context below and retry the player.";
const PLAYER_STATE_PLAYING = 1;
const YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
const YOUTUBE_IFRAME_API_ATTRIBUTE = "data-youtube-iframe-api";
const YOUTUBE_IFRAME_API_STATUS_ATTRIBUTE = "data-youtube-iframe-api-status";

type YoutubeIframeApiScriptStatus = "error" | "loading" | "ready" | "stale";

export interface YouTubePlayerHandle {
  getCurrentTime: () => number;
  loadVideo: (videoId: string, startTime: number, playbackRate: number) => boolean;
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
  onUnavailable?: () => void;
}

interface PlayerLoadRequest {
  playbackRate: number;
  startTime: number;
  videoId: string;
}

function getPlayerLoadRequestSignature({
  playbackRate,
  startTime,
  videoId,
}: PlayerLoadRequest): string {
  return `${videoId}:${startTime}:${playbackRate}`;
}

function getYoutubeIframeApiScript(): HTMLScriptElement | null {
  return document.querySelector(`script[${YOUTUBE_IFRAME_API_ATTRIBUTE}="true"]`);
}

function getYoutubeIframeApiScriptStatus(
  script: HTMLScriptElement | null,
): YoutubeIframeApiScriptStatus | null {
  const status = script?.getAttribute(YOUTUBE_IFRAME_API_STATUS_ATTRIBUTE);
  if (status === "error" || status === "loading" || status === "ready" || status === "stale") {
    return status;
  }

  return null;
}

function setYoutubeIframeApiScriptStatus(
  script: HTMLScriptElement,
  status: YoutubeIframeApiScriptStatus,
) {
  script.setAttribute(YOUTUBE_IFRAME_API_STATUS_ATTRIBUTE, status);
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    { videoId, startTime, playbackRate, onReady, onStateChange, onUnavailable },
    ref,
  ) {
    const playerRef = useRef<YT.Player | null>(null);
    const playerMountHostRef = useRef<HTMLDivElement | null>(null);
    const autoplayMutedRetryAttemptedRef = useRef(false);
    const hasPlaybackStartedRef = useRef(false);
    const lastLoadedRequestSignatureRef = useRef<string | null>(null);
    const shouldRestoreAudioOnUserGestureRef = useRef(false);
    const [apiReady, setApiReady] = useState(false);
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const clearPlayerMountHost = useCallback(() => {
      const host = playerMountHostRef.current;
      if (!host) {
        return;
      }

      host.textContent = "";
    }, []);

    const createPlayerMountElement = useCallback(() => {
      const host = playerMountHostRef.current;
      if (!host) {
        return null;
      }

      clearPlayerMountHost();

      const mountElement = document.createElement("div");
      mountElement.id = `yt-player-iframe-${retryCount}`;
      mountElement.className = "h-full w-full";
      host.append(mountElement);
      return mountElement;
    }, [clearPlayerMountHost, retryCount]);

    const destroyPlayer = useCallback(() => {
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore cleanup errors
      }
      playerRef.current = null;
      autoplayMutedRetryAttemptedRef.current = false;
      hasPlaybackStartedRef.current = false;
      lastLoadedRequestSignatureRef.current = null;
      shouldRestoreAudioOnUserGestureRef.current = false;
      clearPlayerMountHost();
    }, [clearPlayerMountHost]);

    const markPlayerUnavailable = useCallback(() => {
      destroyPlayer();
      setPlayerError(PLAYER_FALLBACK_TITLE);
      onUnavailable?.();
    }, [destroyPlayer, onUnavailable]);

    useEffect(() => {
      if (typeof window.YT !== "undefined" && typeof window.YT.Player === "function") {
        setApiReady(true);
        return;
      }

      let isCancelled = false;
      const previousCallback = window.onYouTubeIframeAPIReady;
      const handleApiReady = () => {
        previousCallback?.();
        if (isCancelled) {
          return;
        }

        if (typeof window.YT !== "undefined" && typeof window.YT.Player === "function") {
          if (script) {
            setYoutubeIframeApiScriptStatus(script, "ready");
          }
          setPlayerError(null);
          setApiReady(true);
        }
      };
      const handleScriptLoad = () => {
        handleApiReady();
      };
      const handleScriptError = () => {
        if (isCancelled) {
          return;
        }

        if (script) {
          setYoutubeIframeApiScriptStatus(script, "error");
        }
        setApiReady(false);
        markPlayerUnavailable();
      };

      window.onYouTubeIframeAPIReady = handleApiReady;

      let script = getYoutubeIframeApiScript();
      const scriptStatus = getYoutubeIframeApiScriptStatus(script);
      if (script && (retryCount > 0 || scriptStatus === "error" || scriptStatus === "stale")) {
        script.remove();
        script = null;
      }

      if (!script) {
        // `next/script` reuses identical `src` loads, so retry needs a fresh DOM script tag.
        script = document.createElement("script");
        script.src = YOUTUBE_IFRAME_API_SRC;
        script.async = true;
        script.setAttribute(YOUTUBE_IFRAME_API_ATTRIBUTE, "true");
        setYoutubeIframeApiScriptStatus(script, "loading");
        document.body.append(script);
      }

      script.addEventListener("load", handleScriptLoad);
      script.addEventListener("error", handleScriptError);

      return () => {
        isCancelled = true;
        script?.removeEventListener("load", handleScriptLoad);
        script?.removeEventListener("error", handleScriptError);

        if (
          script &&
          getYoutubeIframeApiScriptStatus(script) === "loading" &&
          (typeof window.YT === "undefined" || typeof window.YT.Player !== "function")
        ) {
          // A loading script with detached listeners cannot be reused safely on the next mount.
          setYoutubeIframeApiScriptStatus(script, "stale");
        }

        if (window.onYouTubeIframeAPIReady === handleApiReady) {
          window.onYouTubeIframeAPIReady = previousCallback;
        }
      };
    }, [markPlayerUnavailable, retryCount]);

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

    const restoreAudioAfterUserGesture = useCallback((player: YT.Player) => {
      if (!shouldRestoreAudioOnUserGestureRef.current) {
        return;
      }

      if (typeof player.isMuted === "function" && !player.isMuted()) {
        shouldRestoreAudioOnUserGestureRef.current = false;
        autoplayMutedRetryAttemptedRef.current = false;
        return;
      }

      if (typeof player.unMute !== "function") {
        return;
      }

      player.unMute();
      shouldRestoreAudioOnUserGestureRef.current = false;
      autoplayMutedRetryAttemptedRef.current = false;
    }, []);

    const loadVideoIntoExistingPlayer = useCallback(
      (
        request: PlayerLoadRequest,
        options?: {
          triggeredByUserGesture?: boolean;
        },
      ): boolean => {
        const player = playerRef.current;
        if (!player || typeof player.loadVideoById !== "function") {
          return false;
        }

        if (options?.triggeredByUserGesture) {
          restoreAudioAfterUserGesture(player);
        }

        player.loadVideoById(request.videoId, request.startTime);
        if (typeof player.setPlaybackRate === "function") {
          player.setPlaybackRate(request.playbackRate);
        }
        if (typeof player.playVideo === "function") {
          player.playVideo();
        }

        lastLoadedRequestSignatureRef.current = getPlayerLoadRequestSignature(request);
        setPlayerError(null);
        return true;
      },
      [restoreAudioAfterUserGesture],
    );

    const handleAutoplayBlocked = useCallback(() => {
      const player = playerRef.current;
      if (!player) {
        return;
      }

      if (!hasPlaybackStartedRef.current || autoplayMutedRetryAttemptedRef.current) {
        return;
      }

      if (typeof player.mute !== "function" || typeof player.playVideo !== "function") {
        return;
      }

      try {
        player.mute();
        shouldRestoreAudioOnUserGestureRef.current = true;
        autoplayMutedRetryAttemptedRef.current = true;
        player.playVideo();
      } catch {
        markPlayerUnavailable();
      }
    }, [markPlayerUnavailable]);

    useImperativeHandle(ref, () => ({
      getCurrentTime: getSafeCurrentTime,
      loadVideo: (nextVideoId: string, nextStartTime: number, nextPlaybackRate: number) => {
        try {
          return loadVideoIntoExistingPlayer(
            {
              videoId: nextVideoId,
              startTime: Math.max(0, nextStartTime),
              playbackRate: nextPlaybackRate,
            },
            { triggeredByUserGesture: true },
          );
        } catch {
          markPlayerUnavailable();
          return false;
        }
      },
      seekTo: (seconds: number) => {
        const player = playerRef.current;
        if (!player || typeof player.seekTo !== "function") {
          return;
        }

        try {
          restoreAudioAfterUserGesture(player);
          player.seekTo(Math.max(0, seconds), true);
        } catch {
          markPlayerUnavailable();
        }
      },
      seekBy: (seconds: number) => {
        const player = playerRef.current;
        if (!player || typeof player.seekTo !== "function") {
          return;
        }

        try {
          restoreAudioAfterUserGesture(player);
          const current = getSafeCurrentTime();
          player.seekTo(Math.max(0, current + seconds), true);
        } catch {
          markPlayerUnavailable();
        }
      },
      setPlaybackRate: (rate: number) => {
        const player = playerRef.current;
        if (!player || typeof player.setPlaybackRate !== "function") {
          return;
        }

        try {
          restoreAudioAfterUserGesture(player);
          player.setPlaybackRate(rate);
        } catch {
          markPlayerUnavailable();
        }
      },
    }));

    useEffect(() => {
      return () => {
        destroyPlayer();
      };
    }, [destroyPlayer]);

    useEffect(() => {
      if (!apiReady || !videoId) {
        return;
      }

      const safeStartTime = Math.max(0, startTime ?? 0);
      const nextLoadRequest: PlayerLoadRequest = {
        videoId,
        startTime: safeStartTime,
        playbackRate,
      };
      const nextLoadRequestSignature = getPlayerLoadRequestSignature(nextLoadRequest);
      const player = playerRef.current;

      if (player && typeof player.loadVideoById === "function") {
        if (lastLoadedRequestSignatureRef.current === nextLoadRequestSignature) {
          setPlayerError(null);
          return;
        }

        try {
          loadVideoIntoExistingPlayer(nextLoadRequest);
          setPlayerError(null);
          onReady?.();
        } catch {
          markPlayerUnavailable();
        }
        return;
      }

      if (typeof window.YT === "undefined" || typeof window.YT.Player !== "function") {
        return;
      }

      try {
        const mountElement = createPlayerMountElement();
        if (!mountElement) {
          return;
        }

        playerRef.current = new window.YT.Player(mountElement.id, {
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
              if (!readyPlayer) {
                return;
              }

              try {
                if (typeof readyPlayer.seekTo === "function") {
                  readyPlayer.seekTo(safeStartTime, true);
                }
                if (typeof readyPlayer.setPlaybackRate === "function") {
                  readyPlayer.setPlaybackRate(playbackRate);
                }
                if (typeof readyPlayer.playVideo === "function") {
                  readyPlayer.playVideo();
                }
                lastLoadedRequestSignatureRef.current = nextLoadRequestSignature;
                setPlayerError(null);
                onReady?.();
              } catch {
                markPlayerUnavailable();
              }
            },
            onAutoplayBlocked: handleAutoplayBlocked,
            onStateChange: (event: { data: number }) => {
              if (event.data === PLAYER_STATE_PLAYING) {
                hasPlaybackStartedRef.current = true;
                autoplayMutedRetryAttemptedRef.current = false;

                const currentPlayer = playerRef.current;
                if (
                  currentPlayer &&
                  typeof currentPlayer.isMuted === "function" &&
                  !currentPlayer.isMuted()
                ) {
                  shouldRestoreAudioOnUserGestureRef.current = false;
                }
              }

              onStateChange?.(event.data);
            },
          },
        });
      } catch {
        markPlayerUnavailable();
      }
    }, [
      apiReady,
      createPlayerMountElement,
      markPlayerUnavailable,
      handleAutoplayBlocked,
      loadVideoIntoExistingPlayer,
      onReady,
      onStateChange,
      playbackRate,
      startTime,
      videoId,
    ]);

    useEffect(() => {
      const player = playerRef.current;
      if (!player || typeof player.setPlaybackRate !== "function") {
        return;
      }

      try {
        restoreAudioAfterUserGesture(player);
        player.setPlaybackRate(playbackRate);
      } catch {
        markPlayerUnavailable();
      }
    }, [markPlayerUnavailable, playbackRate, restoreAudioAfterUserGesture]);

    const handleRetry = () => {
      destroyPlayer();
      setApiReady(typeof window.YT !== "undefined" && typeof window.YT.Player === "function");
      setPlayerError(null);
      setRetryCount((current) => current + 1);
    };

    return (
      <div
        id="yt-player-container"
        className="aspect-video w-full overflow-hidden bg-[var(--bg-base)]"
      >
        {playerError ? (
          <Card
            data-testid="youtube-player-fallback"
            className="flex h-full items-center justify-center rounded-none border-0 bg-[var(--bg-surface)]"
          >
            <CardContent className="flex max-w-xl flex-col items-center gap-[var(--space-gap-item)] text-center">
              <p className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-16)] font-medium text-[var(--text-primary)]">
                {PLAYER_FALLBACK_TITLE}
              </p>
              <p className="font-[family-name:var(--font-family-sans)] text-[length:var(--font-size-13)] text-[var(--text-secondary)]">
                {PLAYER_FALLBACK_DESCRIPTION}
              </p>
              <Button
                type="button"
                variant="outline"
                data-testid="youtube-player-retry"
                onClick={handleRetry}
              >
                Retry player
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div ref={playerMountHostRef} className="h-full w-full" />
        )}
      </div>
    );
  },
);
