import { act, createElement, forwardRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KOREAN_SITE_CONFIG } from "@/lib/site-config";
import { SearchPageClient } from "./search-page-client";

interface MockPlayerProps {
  onReady?: () => void;
  onUnavailable?: () => void;
}

const capturedPlayerProps: MockPlayerProps[] = [];
const useSearchMock = vi.fn();
const useTranscriptLoaderMock = vi.fn();
const useSubtitleSyncMock = vi.fn();
const pushMock = vi.fn();
const searchParamsGetMock = vi.fn();
const roots: Array<{ container: HTMLDivElement; root: ReturnType<typeof createRoot> }> = [];

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
  SearchResultNavigation: () => createElement("div", { "data-testid": "search-result-navigation" }),
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
    root.render(createElement(SearchPageClient, { siteConfig: KOREAN_SITE_CONFIG }));
  });

  roots.push({ container, root });

  return { root };
}

beforeEach(() => {
  const selectedResult = {
    videoId: "test-video",
    startTime: 12,
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
      root.render(createElement(SearchPageClient, { siteConfig: KOREAN_SITE_CONFIG }));
    });

    const secondProps = capturedPlayerProps.at(-1);
    expect(secondProps?.onReady).toBe(firstProps.onReady);
    expect(secondProps?.onUnavailable).toBe(firstProps.onUnavailable);
  });
});
