import { act, createElement, forwardRef, type ReactNode, useImperativeHandle } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSiteConfig } from "@/lib/site-config";
import { SearchPageClient } from "./search-page-client";

interface MockPlayerProps {
  playbackRate: number;
  startTime: number;
  videoId: string;
  onReady?: () => void;
  onUnavailable?: () => void;
}

interface MockSearchResultNavigationProps {
  onNext: () => void;
  onPrevious: () => void;
}

const capturedPlayerProps: MockPlayerProps[] = [];
const loadVideoMock = vi.fn();
const useSearchMock = vi.fn();
const useTranscriptLoaderMock = vi.fn();
const useSubtitleSyncMock = vi.fn();
const pushMock = vi.fn();
const searchParamsGetMock = vi.fn();
const roots: Array<{ container: HTMLDivElement; root: ReturnType<typeof createRoot> }> = [];
const siteConfig = getSiteConfig({ learningLanguageCode: "ko", uiLanguageCode: "en" });

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => ({
    get: searchParamsGetMock,
  }),
}));

vi.mock("@/application/hooks/use-search", () => ({
  useSearch: (...args: unknown[]) => useSearchMock(...args),
}));

vi.mock("@/application/hooks/use-transcript-loader", () => ({
  useTranscriptLoader: (...args: unknown[]) => useTranscriptLoaderMock(...args),
}));

vi.mock("@/components/chunk-viewer", () => ({
  ChunkViewer: () => createElement("div", { "data-testid": "chunk-viewer" }),
}));

vi.mock("@/components/player-controls", () => ({
  PlayerControls: () => createElement("div", { "data-testid": "player-controls" }),
}));

vi.mock("@/components/search-result-navigation", () => ({
  SearchResultNavigation: (props: MockSearchResultNavigationProps) => {
    return createElement("div", { "data-testid": "search-result-navigation" }, [
      createElement(
        "button",
        {
          key: "previous",
          type: "button",
          "data-testid": "search-result-navigation-previous",
          onClick: props.onPrevious,
        },
        "previous",
      ),
      createElement(
        "button",
        {
          key: "next",
          type: "button",
          "data-testid": "search-result-navigation-next",
          onClick: props.onNext,
        },
        "next",
      ),
    ]);
  },
}));

vi.mock("@/components/top-navigation", () => ({
  TopNavigation: () => createElement("div", { "data-testid": "top-navigation" }),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => createElement("div", undefined, children),
  CardContent: ({ children }: { children: ReactNode }) => createElement("div", undefined, children),
}));

vi.mock("@/components/youtube-player", () => ({
  YouTubePlayer: forwardRef<unknown, MockPlayerProps>(function MockYouTubePlayer(props, _ref) {
    useImperativeHandle(_ref, () => ({
      getCurrentTime: () => 0,
      loadVideo: loadVideoMock,
      seekBy: vi.fn(),
      seekTo: vi.fn(),
      setPlaybackRate: vi.fn(),
    }));
    capturedPlayerProps.push(props);
    return createElement("div", { "data-testid": "youtube-player" });
  }),
}));

vi.mock("@/infrastructure/adapters/supabase-subtitle-repository", () => ({
  SupabaseSubtitleRepository: class SupabaseSubtitleRepository {},
}));

vi.mock("@/lib/use-keyboard-shortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("@/lib/use-subtitle-sync", () => ({
  useSubtitleSync: (...args: unknown[]) => useSubtitleSyncMock(...args),
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderSearchPageClient() {
  const container = document.createElement("div");
  document.body.append(container);

  const root = createRoot(container);
  act(() => {
    root.render(createElement(SearchPageClient, { siteConfig }));
  });

  roots.push({ container, root });

  return { root };
}

beforeEach(() => {
  const selectedResult = {
    videoId: "test-video",
    title: "테스트 영상",
    channelName: "테스트 채널",
    startTime: 12,
    matchedText: "행복해요",
  };

  searchParamsGetMock.mockImplementation((key: string) => (key === "q" ? "행복해요" : null));
  useSearchMock.mockReturnValue({
    results: [selectedResult],
    isLoading: false,
    error: null,
    search: vi.fn(),
    selectedResult,
    selectResult: vi.fn(),
    keyword: "행복해요",
  });
  useTranscriptLoaderMock.mockReturnValue({
    transcriptChunks: [{ startTime: 12, duration: 2, text: "행복해요" }],
    transcriptError: null,
    isTranscriptLoading: false,
  });
  useSubtitleSyncMock.mockReturnValue({
    activeChunk: { startTime: 12, duration: 2, text: "행복해요" },
  });
});

afterEach(() => {
  for (const { container, root } of roots) {
    act(() => {
      root.unmount();
    });
    container.remove();
  }

  roots.length = 0;
  capturedPlayerProps.length = 0;
  loadVideoMock.mockReset();
  pushMock.mockReset();
  searchParamsGetMock.mockReset();
  useSearchMock.mockReset();
  useTranscriptLoaderMock.mockReset();
  useSubtitleSyncMock.mockReset();
});

describe("SearchPageClient", () => {
  it("keeps player callbacks stable across rerenders for the same selected result", () => {
    const { root } = renderSearchPageClient();

    const firstProps = capturedPlayerProps.at(-1);
    if (!firstProps?.onReady || !firstProps.onUnavailable) {
      throw new Error("Expected SearchPageClient to render YouTubePlayer callbacks.");
    }

    act(() => {
      root.render(createElement(SearchPageClient, { siteConfig }));
    });

    const secondProps = capturedPlayerProps.at(-1);
    expect(secondProps?.onReady).toBe(firstProps.onReady);
    expect(secondProps?.onUnavailable).toBe(firstProps.onUnavailable);
  });

  it("loads the next result within the same user gesture before selecting it", () => {
    const firstResult = {
      videoId: "video-1",
      title: "첫 영상",
      channelName: "채널",
      startTime: 12,
      matchedText: "첫 문장",
    };
    const secondResult = {
      videoId: "video-2",
      title: "둘째 영상",
      channelName: "채널",
      startTime: 34,
      matchedText: "둘째 문장",
    };
    const selectResultMock = vi.fn();

    useSearchMock.mockReturnValue({
      results: [firstResult, secondResult],
      isLoading: false,
      error: null,
      search: vi.fn(),
      selectedResult: firstResult,
      selectResult: selectResultMock,
      keyword: "행복해요",
    });

    loadVideoMock.mockReturnValue(true);
    renderSearchPageClient();

    const nextButton = document.querySelector('[data-testid="search-result-navigation-next"]');
    if (!(nextButton instanceof HTMLButtonElement)) {
      throw new Error("Expected next navigation button to render.");
    }

    act(() => {
      nextButton.click();
    });

    expect(loadVideoMock).toHaveBeenCalledWith("video-2", 33.3, 1);
    expect(selectResultMock).toHaveBeenCalledWith(secondResult);
  });
});
