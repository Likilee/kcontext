import { act, type ComponentProps, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { YouTubePlayerHandle } from "./youtube-player";
import { YouTubePlayer } from "./youtube-player";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface MockPlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  isMuted: () => boolean;
  loadVideoById: (videoId: string, startTime?: number) => void;
  mute: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  unMute: () => void;
}

interface MockPlayerOptions {
  videoId?: string | null;
  playerVars?: {
    start?: number;
  };
  events?: {
    onAutoplayBlocked?: () => void;
    onError?: () => void;
    onReady?: () => void;
    onStateChange?: (event: { data: number }) => void;
  };
}

type MockPlayerMountTarget = HTMLElement | string;

type MockPlayerConstructor = new (
  mountTarget: MockPlayerMountTarget,
  options: MockPlayerOptions,
) => MockPlayer;

type MockYouTubeWindow = {
  YT?: {
    Player?: MockPlayerConstructor;
  };
  onYouTubeIframeAPIReady?: (() => void) | undefined;
};

const roots: Array<{ container: HTMLDivElement; root: ReturnType<typeof createRoot> }> = [];

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

async function waitFor(check: () => void): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      check();
      return;
    } catch {
      await act(async () => {
        await flushMicrotasks();
      });
    }
  }

  check();
}

function installPlayerConstructor(playerConstructor: MockPlayerConstructor) {
  const youtubeWindow = window as unknown as MockYouTubeWindow;
  youtubeWindow.YT = {
    Player: playerConstructor,
  };
}

function createReadyPlayer(options: MockPlayerOptions): MockPlayer {
  let currentTime = options.playerVars?.start ?? 0;
  let isMuted = false;

  queueMicrotask(() => {
    options.events?.onReady?.();
  });

  return {
    destroy: vi.fn(),
    getCurrentTime: vi.fn(() => currentTime),
    isMuted: vi.fn(() => isMuted),
    loadVideoById: vi.fn((_videoId: string, startTime?: number) => {
      currentTime = startTime ?? currentTime;
    }),
    mute: vi.fn(() => {
      isMuted = true;
    }),
    playVideo: vi.fn(),
    seekTo: vi.fn((seconds: number) => {
      currentTime = seconds;
    }),
    setPlaybackRate: vi.fn(),
    unMute: vi.fn(() => {
      isMuted = false;
    }),
  };
}

function createThrowingPlayerConstructor(message: string): MockPlayerConstructor {
  return function MockPlayer() {
    throw new Error(message);
  } as unknown as MockPlayerConstructor;
}

function createReadyPlayerConstructor(): MockPlayerConstructor {
  return function MockPlayer(_mountTarget: MockPlayerMountTarget, options: MockPlayerOptions) {
    return createReadyPlayer(options);
  } as unknown as MockPlayerConstructor;
}

function createInspectablePlayerConstructor() {
  const events: MockPlayerOptions["events"][] = [];
  const players: MockPlayer[] = [];

  const playerConstructor = function MockPlayer(
    _mountTarget: MockPlayerMountTarget,
    options: MockPlayerOptions,
  ) {
    events.push(options.events);
    const player = createReadyPlayer(options);
    players.push(player);
    return player;
  } as unknown as MockPlayerConstructor;

  return {
    events,
    playerConstructor,
    players,
  };
}

function createRetryingPlayerConstructor() {
  let callCount = 0;

  const playerConstructor = function MockPlayer(
    _mountTarget: MockPlayerMountTarget,
    options: MockPlayerOptions,
  ) {
    callCount += 1;
    if (callCount === 1) {
      throw new Error("player init failed");
    }

    return createReadyPlayer(options);
  } as unknown as MockPlayerConstructor;

  return {
    playerConstructor,
    getCallCount: () => callCount,
  };
}

function renderPlayer(
  props: Partial<ComponentProps<typeof YouTubePlayer>> = {},
  ref = createRef<YouTubePlayerHandle>(),
) {
  const container = document.createElement("div");
  document.body.append(container);

  const root = createRoot(container);
  act(() => {
    root.render(
      createElement(YouTubePlayer, {
        ref,
        videoId: "video-1",
        playbackRate: 1,
        ...props,
      }),
    );
  });

  const renderedPlayer = { container, root };
  roots.push(renderedPlayer);

  const rerender = (nextProps: Partial<ComponentProps<typeof YouTubePlayer>>) => {
    act(() => {
      root.render(
        createElement(YouTubePlayer, {
          ref,
          videoId: "video-1",
          playbackRate: 1,
          ...nextProps,
        }),
      );
    });
  };

  return {
    container,
    ref,
    rerender,
    unmount: () => {
      const renderedPlayerIndex = roots.indexOf(renderedPlayer);
      if (renderedPlayerIndex >= 0) {
        roots.splice(renderedPlayerIndex, 1);
      }

      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function createDomReplacingPlayerConstructor(): MockPlayerConstructor {
  return function MockPlayer(mountTarget: MockPlayerMountTarget, options: MockPlayerOptions) {
    const mountElement =
      mountTarget instanceof HTMLElement ? mountTarget : document.getElementById(mountTarget);
    if (!(mountElement instanceof HTMLElement)) {
      throw new Error("Expected player mount target to resolve to an element.");
    }

    const iframe = document.createElement("iframe");
    mountElement.replaceWith(iframe);

    return createReadyPlayer(options);
  } as unknown as MockPlayerConstructor;
}

afterEach(() => {
  const youtubeWindow = window as unknown as MockYouTubeWindow;

  for (const { container, root } of roots) {
    act(() => {
      root.unmount();
    });
    container.remove();
  }

  roots.length = 0;
  delete youtubeWindow.YT;
  delete youtubeWindow.onYouTubeIframeAPIReady;
  document.querySelectorAll('script[data-youtube-iframe-api="true"]').forEach((script) => {
    script.remove();
  });
  vi.restoreAllMocks();
});

describe("YouTubePlayer", () => {
  it("shows an inline fallback instead of crashing when player init throws", async () => {
    const onUnavailable = vi.fn();
    const playerConstructor = createThrowingPlayerConstructor("player init failed");

    installPlayerConstructor(playerConstructor);
    const { container } = renderPlayer({ onUnavailable });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="youtube-player-fallback"]')).not.toBeNull();
      expect(onUnavailable).toHaveBeenCalledTimes(1);
    });
  });

  it("retries initialization and recovers when a later player attempt succeeds", async () => {
    const onReady = vi.fn();
    const onUnavailable = vi.fn();
    const { playerConstructor, getCallCount } = createRetryingPlayerConstructor();

    installPlayerConstructor(playerConstructor);
    const { container, ref } = renderPlayer({ onReady, onUnavailable });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="youtube-player-fallback"]')).not.toBeNull();
      expect(onUnavailable).toHaveBeenCalledTimes(1);
    });

    const retryButton = container.querySelector('[data-testid="youtube-player-retry"]');
    if (!(retryButton instanceof HTMLButtonElement)) {
      throw new Error("Expected retry button to render.");
    }

    act(() => {
      retryButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="youtube-player-fallback"]')).toBeNull();
      expect(onReady).toHaveBeenCalledTimes(1);
    });

    expect(getCallCount()).toBe(2);
    expect(ref.current).not.toBeNull();
    expect(() => ref.current?.seekTo(12)).not.toThrow();
    expect(ref.current?.getCurrentTime()).toBe(12);
  });

  it("reinjects the iframe API script on retry after the initial script load fails", async () => {
    const onReady = vi.fn();
    const onUnavailable = vi.fn();
    const { container } = renderPlayer({ onReady, onUnavailable });

    const firstScript = document.querySelector('script[data-youtube-iframe-api="true"]');
    if (!(firstScript instanceof HTMLScriptElement)) {
      throw new Error("Expected iframe API script to be injected.");
    }

    act(() => {
      firstScript.dispatchEvent(new Event("error"));
    });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="youtube-player-fallback"]')).not.toBeNull();
      expect(onUnavailable).toHaveBeenCalledTimes(1);
    });

    const retryButton = container.querySelector('[data-testid="youtube-player-retry"]');
    if (!(retryButton instanceof HTMLButtonElement)) {
      throw new Error("Expected retry button to render.");
    }

    act(() => {
      retryButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => {
      const nextScript = document.querySelector('script[data-youtube-iframe-api="true"]');
      expect(nextScript).not.toBe(firstScript);
    });

    installPlayerConstructor(createReadyPlayerConstructor());

    act(() => {
      (window as MockYouTubeWindow).onYouTubeIframeAPIReady?.();
    });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="youtube-player-fallback"]')).toBeNull();
      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });

  it("reinjects the iframe API script on a fresh mount after the previous script load failed", async () => {
    const firstRender = renderPlayer();

    const firstScript = document.querySelector('script[data-youtube-iframe-api="true"]');
    if (!(firstScript instanceof HTMLScriptElement)) {
      throw new Error("Expected iframe API script to be injected.");
    }

    act(() => {
      firstScript.dispatchEvent(new Event("error"));
    });

    await waitFor(() => {
      expect(
        firstRender.container.querySelector('[data-testid="youtube-player-fallback"]'),
      ).not.toBeNull();
    });

    firstRender.unmount();

    const onReady = vi.fn();
    const secondRender = renderPlayer({ onReady });

    await waitFor(() => {
      const nextScript = document.querySelector('script[data-youtube-iframe-api="true"]');
      expect(nextScript).not.toBe(firstScript);
    });

    installPlayerConstructor(createReadyPlayerConstructor());

    act(() => {
      (window as unknown as MockYouTubeWindow).onYouTubeIframeAPIReady?.();
    });

    await waitFor(() => {
      expect(
        secondRender.container.querySelector('[data-testid="youtube-player-fallback"]'),
      ).toBeNull();
      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });

  it("reinjects the iframe API script on a fresh mount when the previous mount left a stale loading script", async () => {
    const firstRender = renderPlayer();

    const firstScript = document.querySelector('script[data-youtube-iframe-api="true"]');
    if (!(firstScript instanceof HTMLScriptElement)) {
      throw new Error("Expected iframe API script to be injected.");
    }

    firstRender.unmount();

    act(() => {
      firstScript.dispatchEvent(new Event("error"));
    });

    const onReady = vi.fn();
    const secondRender = renderPlayer({ onReady });

    await waitFor(() => {
      const nextScript = document.querySelector('script[data-youtube-iframe-api="true"]');
      expect(nextScript).not.toBe(firstScript);
    });

    installPlayerConstructor(createReadyPlayerConstructor());

    act(() => {
      (window as MockYouTubeWindow).onYouTubeIframeAPIReady?.();
    });

    await waitFor(() => {
      expect(
        secondRender.container.querySelector('[data-testid="youtube-player-fallback"]'),
      ).toBeNull();
      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });

  it("reuses the existing player instance when video props change", async () => {
    const onReady = vi.fn();
    const { events, playerConstructor, players } = createInspectablePlayerConstructor();

    installPlayerConstructor(playerConstructor);
    const { rerender } = renderPlayer({ onReady });

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(players).toHaveLength(1);
    });

    rerender({
      videoId: "video-2",
      startTime: 24,
      playbackRate: 1.25,
    });

    await waitFor(() => {
      expect(players).toHaveLength(1);
      expect(players[0]?.loadVideoById).toHaveBeenCalledWith("video-2", 24);
      expect(players[0]?.setPlaybackRate).toHaveBeenCalledWith(1.25);
      expect(players[0]?.playVideo).toHaveBeenCalled();
      expect(events).toHaveLength(1);
    });
  });

  it("deduplicates a user-gesture load before the matching prop rerender", async () => {
    const { playerConstructor, players } = createInspectablePlayerConstructor();
    const ref = createRef<YouTubePlayerHandle>();

    installPlayerConstructor(playerConstructor);
    const { rerender } = renderPlayer({}, ref);

    await act(async () => {
      await flushMicrotasks();
    });

    await waitFor(() => {
      expect(players).toHaveLength(1);
      expect(ref.current).not.toBeNull();
    });

    act(() => {
      expect(ref.current?.loadVideo("video-2", 18, 1.25)).toBe(true);
    });

    expect(players[0]?.loadVideoById).toHaveBeenCalledTimes(1);
    expect(players[0]?.loadVideoById).toHaveBeenLastCalledWith("video-2", 18);

    rerender({
      videoId: "video-2",
      startTime: 18,
      playbackRate: 1.25,
    });

    expect(players[0]?.loadVideoById).toHaveBeenCalledTimes(1);
  });

  it("retries blocked autoplay muted after prior playback and restores audio on the next user gesture", async () => {
    const { events, playerConstructor, players } = createInspectablePlayerConstructor();
    const ref = createRef<YouTubePlayerHandle>();

    installPlayerConstructor(playerConstructor);
    renderPlayer({}, ref);

    await act(async () => {
      await flushMicrotasks();
    });

    await waitFor(() => {
      expect(players).toHaveLength(1);
      expect(ref.current).not.toBeNull();
      expect(events[0]?.onStateChange).toBeDefined();
      expect(events[0]?.onAutoplayBlocked).toBeDefined();
    });

    act(() => {
      events[0]?.onStateChange?.({ data: 1 });
    });

    act(() => {
      events[0]?.onAutoplayBlocked?.();
    });

    expect(players[0]?.mute).toHaveBeenCalledTimes(1);
    expect(players[0]?.playVideo).toHaveBeenCalledTimes(2);
    expect(players[0]?.isMuted()).toBe(true);

    act(() => {
      ref.current?.seekBy(5);
    });

    expect(players[0]?.unMute).toHaveBeenCalledTimes(1);
    expect(players[0]?.isMuted()).toBe(false);
  });

  it("keeps rerenders stable when the YouTube iframe API replaces its mount node", async () => {
    const onReady = vi.fn();

    installPlayerConstructor(createDomReplacingPlayerConstructor());
    const { container, rerender } = renderPlayer({ onReady });

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(container.querySelector("#yt-player-container iframe")).not.toBeNull();
    });

    expect(() => {
      rerender({ playbackRate: 1.25 });
    }).not.toThrow();

    expect(container.querySelector("#yt-player-container iframe")).not.toBeNull();
    expect(container.querySelector('[data-testid="youtube-player-fallback"]')).toBeNull();
  });
});
