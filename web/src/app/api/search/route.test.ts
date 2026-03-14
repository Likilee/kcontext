import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchRateLimitError } from "@/infrastructure/search/search-service";
import { GET } from "./route";

const { mockSearchSubtitles } = vi.hoisted(() => ({
  mockSearchSubtitles: vi.fn(),
}));

vi.mock("@/infrastructure/search/search-service", async () => {
  const actual = await vi.importActual<typeof import("@/infrastructure/search/search-service")>(
    "@/infrastructure/search/search-service",
  );

  return {
    ...actual,
    searchSubtitles: mockSearchSubtitles,
  };
});

describe("/api/search route", () => {
  beforeEach(() => {
    mockSearchSubtitles.mockReset();
  });

  it("returns 400 when q is missing", async () => {
    const response = await GET(new NextRequest("https://tubelang.com/api/search?lang=ko"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing q query parameter.",
    });
  });

  it("returns cached search results with cache headers", async () => {
    mockSearchSubtitles.mockResolvedValue({
      cacheHit: true,
      results: [
        {
          videoId: "vid1",
          title: "테스트",
          channelName: "채널",
          startTime: 1,
          matchedText: "안녕",
        },
      ],
    });

    const response = await GET(
      new NextRequest("https://tubelang.com/api/search?lang=ko&q=%EC%95%88%EB%85%95", {
        headers: {
          "user-agent": "vitest",
          "x-forwarded-for": "127.0.0.1",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    expect(response.headers.get("X-Search-Cache")).toBe("HIT");
    await expect(response.json()).resolves.toEqual([
      {
        videoId: "vid1",
        title: "테스트",
        channelName: "채널",
        startTime: 1,
        matchedText: "안녕",
      },
    ]);
  });

  it("returns 429 when the search service rate limits a client", async () => {
    mockSearchSubtitles.mockRejectedValue(new SearchRateLimitError(12));

    const response = await GET(
      new NextRequest("https://tubelang.com/api/search?lang=ko&q=%ED%85%8C%EC%8A%A4%ED%8A%B8", {
        headers: {
          "user-agent": "vitest",
          "x-forwarded-for": "127.0.0.1",
        },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    await expect(response.json()).resolves.toEqual({
      error: "Too many search requests. Please try again in a moment.",
    });
  });
});
