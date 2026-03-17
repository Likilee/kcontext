import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeSearchKeyword,
  resetSearchServiceState,
  SearchRateLimitError,
  searchSubtitles,
} from "./search-service";

const mockRpc = vi.fn();

vi.mock("@/infrastructure/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

describe("search-service", () => {
  beforeEach(() => {
    resetSearchServiceState();
    mockRpc.mockReset();
  });

  it("normalizes repeated whitespace in keywords", () => {
    expect(normalizeSearchKeyword("  안녕   하세요  ")).toBe("안녕 하세요");
  });

  it("maps RPC rows and caches repeated searches", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          video_id: "vid1",
          title: "테스트 영상",
          channel_name: "채널",
          start_time: 12.5,
          text: "안녕하세요",
        },
      ],
      error: null,
    });

    const first = await searchSubtitles({
      keyword: "안녕",
      audioLanguageCode: "ko",
      clientId: "client-1",
    });
    const second = await searchSubtitles({
      keyword: "안녕",
      audioLanguageCode: "ko",
      clientId: "client-1",
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      "search_subtitles",
      {
        audio_language_code: "ko",
        search_keyword: "안녕",
      },
      {
        get: true,
      },
    );
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.results).toEqual([
      {
        videoId: "vid1",
        title: "테스트 영상",
        channelName: "채널",
        startTime: 12.5,
        matchedText: "안녕하세요",
      },
    ]);
  });

  it("surfaces RPC failures", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "rpc boom" },
    });

    await expect(
      searchSubtitles({
        keyword: "실패",
        audioLanguageCode: "ko",
        clientId: "client-2",
      }),
    ).rejects.toThrow("Search failed: rpc boom");
  });

  it("preserves missing title and channel metadata for UI fallbacks", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          video_id: "vid2",
          title: null,
          channel_name: null,
          start_time: 33,
          text: "제목이 없어도 검색됩니다",
        },
      ],
      error: null,
    });

    const response = await searchSubtitles({
      keyword: "검색",
      audioLanguageCode: "ko",
      clientId: "client-3",
    });

    expect(response.results).toEqual([
      {
        videoId: "vid2",
        title: null,
        channelName: null,
        startTime: 33,
        matchedText: "제목이 없어도 검색됩니다",
      },
    ]);
  });

  it("rate limits repeated anonymous searches from the same client", async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await searchSubtitles({
        keyword: `테스트 ${attempt}`,
        audioLanguageCode: "ko",
        clientId: "rate-limited-client",
      });
    }

    await expect(
      searchSubtitles({
        keyword: "한 번 더",
        audioLanguageCode: "ko",
        clientId: "rate-limited-client",
      }),
    ).rejects.toBeInstanceOf(SearchRateLimitError);
  });
});
