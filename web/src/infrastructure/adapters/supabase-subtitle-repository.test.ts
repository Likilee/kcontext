import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseSubtitleRepository } from "./supabase-subtitle-repository";

vi.mock("@/infrastructure/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    rpc: vi.fn(),
  })),
}));

describe("SupabaseSubtitleRepository", () => {
  let repo: SupabaseSubtitleRepository;

  beforeEach(() => {
    repo = new SupabaseSubtitleRepository();
    vi.clearAllMocks();
  });

  describe("searchByKeyword", () => {
    it("should map snake_case DB response to camelCase domain model", async () => {
      const { createSupabaseBrowserClient } = await import("@/infrastructure/supabase/client");
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            video_id: "vid1",
            title: "테스트 영상",
            channel_name: "테스트 채널",
            start_time: 12.5,
            text: "안녕하세요",
          },
        ],
        error: null,
      });
      vi.mocked(createSupabaseBrowserClient).mockReturnValue({
        rpc: mockRpc,
      } as unknown as ReturnType<typeof createSupabaseBrowserClient>);

      const results = await repo.searchByKeyword("안녕");
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        videoId: "vid1",
        title: "테스트 영상",
        channelName: "테스트 채널",
        startTime: 12.5,
        matchedText: "안녕하세요",
      });
    });

    it("should throw on RPC error", async () => {
      const { createSupabaseBrowserClient } = await import("@/infrastructure/supabase/client");
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "RPC failed" },
      });
      vi.mocked(createSupabaseBrowserClient).mockReturnValue({
        rpc: mockRpc,
      } as unknown as ReturnType<typeof createSupabaseBrowserClient>);

      await expect(repo.searchByKeyword("test")).rejects.toThrow("Search failed");
    });

    it("should return empty array for no results", async () => {
      const { createSupabaseBrowserClient } = await import("@/infrastructure/supabase/client");
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      vi.mocked(createSupabaseBrowserClient).mockReturnValue({
        rpc: mockRpc,
      } as unknown as ReturnType<typeof createSupabaseBrowserClient>);

      const results = await repo.searchByKeyword("없는단어");
      expect(results).toEqual([]);
    });
  });

  describe("getFullTranscript", () => {
    it("should fetch CDN JSON and map to SubtitleChunk", async () => {
      const cdnData = [
        { start_time: 0.0, duration: 2.5, text: "안녕하세요" },
        { start_time: 2.5, duration: 3.0, text: "반갑습니다" },
      ];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => cdnData,
      } as Response);
      process.env.NEXT_PUBLIC_CDN_URL = "http://localhost:54321/storage/v1/object/public";

      const chunks = await repo.getFullTranscript("vid1");
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ startTime: 0.0, text: "안녕하세요" });
    });

    it("should throw on HTTP error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);
      process.env.NEXT_PUBLIC_CDN_URL = "http://localhost:54321/storage/v1/object/public";

      await expect(repo.getFullTranscript("missing_vid")).rejects.toThrow(
        "Failed to fetch transcript: 404",
      );
    });

    it("should throw when CDN_URL is missing", async () => {
      delete process.env.NEXT_PUBLIC_CDN_URL;

      await expect(repo.getFullTranscript("vid1")).rejects.toThrow("Missing NEXT_PUBLIC_CDN_URL");
    });
  });
});
