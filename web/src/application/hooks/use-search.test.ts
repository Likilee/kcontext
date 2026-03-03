import { act, createElement, createRef, forwardRef, useImperativeHandle } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SubtitleRepository } from "@/application/ports/subtitle-repository";
import type { SearchResult } from "@/domain/models/subtitle";
import { useSearch } from "./use-search";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const MOCK_RESULTS: SearchResult[] = [
  {
    videoId: "vid1",
    title: "테스트",
    channelName: "채널",
    startTime: 0,
    matchedText: "안녕",
  },
];

interface SearchSnapshot {
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  selectedResult: SearchResult | null;
  keyword: string;
}

interface SearchHarnessHandle {
  search: (keyword: string) => void;
  selectResult: (result: SearchResult) => void;
  getSnapshot: () => SearchSnapshot;
}

const SearchHarness = forwardRef<SearchHarnessHandle, { repository: SubtitleRepository }>(
  ({ repository }, ref) => {
    const state = useSearch(repository);

    useImperativeHandle(
      ref,
      () => ({
        search: state.search,
        selectResult: state.selectResult,
        getSnapshot: () => ({
          results: state.results,
          isLoading: state.isLoading,
          error: state.error,
          selectedResult: state.selectedResult,
          keyword: state.keyword,
        }),
      }),
      [state],
    );

    return null;
  },
);

SearchHarness.displayName = "SearchHarness";

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

describe("useSearch", () => {
  const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

  afterEach(() => {
    for (const { root, container } of roots) {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    roots.length = 0;
  });

  const renderHookHarness = (repository: SubtitleRepository) => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const ref = createRef<SearchHarnessHandle>();

    act(() => {
      root.render(createElement(SearchHarness, { repository, ref }));
    });

    roots.push({ root, container });

    if (!ref.current) {
      throw new Error("Search harness did not initialize");
    }

    return ref;
  };

  it("calls repository and stores successful search results", async () => {
    const repository: SubtitleRepository = {
      searchByKeyword: vi.fn().mockResolvedValue(MOCK_RESULTS),
      getFullTranscript: vi.fn(),
    };

    const ref = renderHookHarness(repository);

    act(() => {
      ref.current?.search("안녕");
    });

    await waitFor(() => {
      expect(repository.searchByKeyword).toHaveBeenCalledWith("안녕");
      expect(ref.current?.getSnapshot().results).toEqual(MOCK_RESULTS);
      expect(ref.current?.getSnapshot().keyword).toBe("안녕");
      expect(ref.current?.getSnapshot().error).toBeNull();
    });
  });

  it("clears results and keyword for blank search", () => {
    const repository: SubtitleRepository = {
      searchByKeyword: vi.fn().mockResolvedValue(MOCK_RESULTS),
      getFullTranscript: vi.fn(),
    };

    const ref = renderHookHarness(repository);

    act(() => {
      ref.current?.search("   ");
    });

    expect(repository.searchByKeyword).not.toHaveBeenCalled();
    expect(ref.current?.getSnapshot().results).toEqual([]);
    expect(ref.current?.getSnapshot().keyword).toBe("");
  });

  it("captures repository errors and resets results", async () => {
    const repository: SubtitleRepository = {
      searchByKeyword: vi.fn().mockRejectedValue(new Error("boom")),
      getFullTranscript: vi.fn(),
    };

    const ref = renderHookHarness(repository);

    act(() => {
      ref.current?.search("실패");
    });

    await waitFor(() => {
      expect(ref.current?.getSnapshot().error).toBe("boom");
      expect(ref.current?.getSnapshot().results).toEqual([]);
      expect(ref.current?.getSnapshot().keyword).toBe("실패");
    });
  });

  it("updates selectedResult when selectResult is called", () => {
    const repository: SubtitleRepository = {
      searchByKeyword: vi.fn().mockResolvedValue(MOCK_RESULTS),
      getFullTranscript: vi.fn(),
    };

    const ref = renderHookHarness(repository);
    const firstResult = MOCK_RESULTS[0];
    if (!firstResult) {
      throw new Error("Expected at least one mock result");
    }

    act(() => {
      ref.current?.selectResult(firstResult);
    });

    expect(ref.current?.getSnapshot().selectedResult).toEqual(firstResult);
  });
});
