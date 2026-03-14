import { type NextRequest, NextResponse } from "next/server";
import {
  normalizeSearchKeyword,
  SearchRateLimitError,
  searchSubtitles,
} from "@/infrastructure/search/search-service";

const SEARCH_RESPONSE_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const keyword = normalizeSearchKeyword(request.nextUrl.searchParams.get("q") ?? "");
  const audioLanguageCode = (request.nextUrl.searchParams.get("lang") ?? "ko").trim().toLowerCase();

  if (!keyword) {
    return NextResponse.json(
      { error: "Missing q query parameter." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const clientId = buildClientId(request);

  try {
    const { results, cacheHit } = await searchSubtitles({
      keyword,
      audioLanguageCode,
      clientId,
    });

    logSearchEvent({
      keyword,
      audioLanguageCode,
      cacheHit,
      durationMs: Date.now() - startedAt,
      resultCount: results.length,
      status: 200,
    });

    return NextResponse.json(results, {
      headers: {
        "Cache-Control": SEARCH_RESPONSE_CACHE_CONTROL,
        "X-Search-Cache": cacheHit ? "HIT" : "MISS",
      },
    });
  } catch (error) {
    if (error instanceof SearchRateLimitError) {
      logSearchEvent({
        keyword,
        audioLanguageCode,
        cacheHit: false,
        durationMs: Date.now() - startedAt,
        rateLimited: true,
        resultCount: 0,
        status: 429,
      });

      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": error.retryAfterSeconds.toString(),
          },
        },
      );
    }

    const message = error instanceof Error ? error.message : "Search failed";
    logSearchEvent({
      keyword,
      audioLanguageCode,
      cacheHit: false,
      durationMs: Date.now() - startedAt,
      errorMessage: message,
      resultCount: 0,
      status: 500,
    });

    return NextResponse.json(
      { error: "Search failed. Please try again." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

function buildClientId(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const clientIp = forwardedFor.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return `${clientIp}:${userAgent}`;
}

function logSearchEvent({
  keyword,
  audioLanguageCode,
  cacheHit,
  durationMs,
  errorMessage,
  rateLimited = false,
  resultCount,
  status,
}: {
  audioLanguageCode: string;
  cacheHit: boolean;
  durationMs: number;
  errorMessage?: string;
  keyword: string;
  rateLimited?: boolean;
  resultCount: number;
  status: number;
}) {
  console.info(
    JSON.stringify({
      event: "search_api",
      audioLanguageCode,
      cacheHit,
      durationMs,
      errorMessage,
      keyword,
      rateLimited,
      resultCount,
      status,
    }),
  );
}
