import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseSubtitleRepository } from "./supabase-subtitle-repository";

describe("SupabaseSubtitleRepository", () => {
  let repo: SupabaseSubtitleRepository;

  beforeEach(() => {
    repo = new SupabaseSubtitleRepository();
    vi.clearAllMocks();
  });

  describe("searchByKeyword", () => {
    it("should request the server search API and return domain results", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            videoId: "vid1",
            title: "테스트 영상",
            channelName: "테스트 채널",
            startTime: 12.5,
            matchedText: "안녕하세요",
          },
        ],
      } as Response);

      const results = await repo.searchByKeyword("안녕", "ko");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/search?lang=ko&q=%EC%95%88%EB%85%95",
        {
          headers: {
            Accept: "application/json",
          },
        },
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        videoId: "vid1",
        title: "테스트 영상",
        channelName: "테스트 채널",
        startTime: 12.5,
        matchedText: "안녕하세요",
      });
    });

    it("should throw on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "RPC failed" }),
      } as Response);

      await expect(repo.searchByKeyword("test", "ko")).rejects.toThrow("RPC failed");
    });

    it("should return empty array for no results", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);

      const results = await repo.searchByKeyword("없는단어", "ko");
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
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:54321/storage/v1/object/public/subtitles/vid1.json",
        {
          cache: "force-cache",
          headers: {
            Accept: "application/json",
          },
        },
      );
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ startTime: 0.0, duration: 2.5, text: "안녕하세요" });
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
