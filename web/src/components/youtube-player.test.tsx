import { act, type ComponentProps, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { YouTubePlayerHandle } from "./youtube-player";
import { YouTubePlayer } from "./youtube-player";

vi.mock("next/script", () => ({
  default: () => null,
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface MockPlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  loadVideoById: (videoId: string, startTime?: number) => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setPlaybackRate: (rate: number) => void;
}

interface MockPlayerOptions {
  videoId?: string | null;
  playerVars?: {
    start?: number;
  };
  events?: {
    onError?: () => void;
    onReady?: () => void;
    onStateChange?: (event: { data: number }) => void;
  };
}

type MockPlayerConstructor = new (elementId: string, options: MockPlayerOptions) => MockPlayer;

type MockYouTubeWindow = Window &
  typeof globalThis & {
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
  const youtubeWindow = window as MockYouTubeWindow;
  youtubeWindow.YT = {
    Player: playerConstructor,
  };
}

function createReadyPlayer(options: MockPlayerOptions): MockPlayer {
  let currentTime = options.playerVars?.start ?? 0;

  queueMicrotask(() => {
    options.events?.onReady?.();
  });

  return {
    destroy: vi.fn(),
    getCurrentTime: vi.fn(() => currentTime),
    loadVideoById: vi.fn((_videoId: string, startTime?: number) => {
      currentTime = startTime ?? currentTime;
    }),
    playVideo: vi.fn(),
    seekTo: vi.fn((seconds: number) => {
      currentTime = seconds;
    }),
    setPlaybackRate: vi.fn(),
  };
}

function createThrowingPlayerConstructor(message: string): MockPlayerConstructor {
  return function MockPlayer() {
    throw new Error(message);
  } as unknown as MockPlayerConstructor;
}

function createRetryingPlayerConstructor() {
  let callCount = 0;

  const playerConstructor = function MockPlayer(_elementId: string, options: MockPlayerOptions) {
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

  roots.push({ container, root });

  return { container, ref };
}

afterEach(() => {
  const youtubeWindow = window as MockYouTubeWindow;

  for (const { container, root } of roots) {
    act(() => {
      root.unmount();
    });
    container.remove();
  }

  roots.length = 0;
  youtubeWindow.YT = undefined;
  youtubeWindow.onYouTubeIframeAPIReady = undefined;
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
});
