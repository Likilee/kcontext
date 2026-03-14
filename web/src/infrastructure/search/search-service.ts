import type { SearchResult } from "@/domain/models/subtitle";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin";

interface SearchResultRow {
  video_id: string;
  title: string;
  channel_name: string;
  start_time: number;
  text: string;
}

interface SearchCacheEntry {
  expiresAt: number;
  results: SearchResult[];
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface SearchRequestContext {
  audioLanguageCode: string;
  clientId: string;
  keyword: string;
}

export interface SearchServiceResult {
  cacheHit: boolean;
  results: SearchResult[];
}

const SEARCH_CACHE_TTL_MS = 60_000;
const SEARCH_CACHE_MAX_ENTRIES = 500;
const SEARCH_RATE_LIMIT_WINDOW_MS = 60_000;
const SEARCH_RATE_LIMIT_MAX_REQUESTS = 30;

const searchCache = new Map<string, SearchCacheEntry>();
const rateLimitStore = new Map<string, RateLimitEntry>();

export class SearchRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many search requests. Please try again in a moment.");
    this.name = "SearchRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function normalizeSearchKeyword(keyword: string): string {
  return keyword.trim().replace(/\s+/g, " ");
}

export function resetSearchServiceState() {
  searchCache.clear();
  rateLimitStore.clear();
}

export async function searchSubtitles(context: SearchRequestContext): Promise<SearchServiceResult> {
  const keyword = normalizeSearchKeyword(context.keyword);
  const audioLanguageCode = context.audioLanguageCode.trim().toLowerCase();
  if (!keyword) {
    return { cacheHit: false, results: [] };
  }

  pruneExpiredEntries(Date.now());
  enforceRateLimit(context.clientId);

  const cacheKey = `${audioLanguageCode}:${keyword}`;
  const now = Date.now();

  const cachedEntry = searchCache.get(cacheKey);
  if (cachedEntry && cachedEntry.expiresAt > now) {
    return {
      cacheHit: true,
      results: cachedEntry.results,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    "search_subtitles",
    {
      audio_language_code: audioLanguageCode,
      search_keyword: keyword,
    },
    {
      get: true,
    },
  );

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  const results = ((data as SearchResultRow[] | null) ?? []).map((row) => ({
    videoId: row.video_id,
    title: row.title,
    channelName: row.channel_name,
    startTime: row.start_time,
    matchedText: row.text,
  }));

  searchCache.set(cacheKey, {
    expiresAt: now + SEARCH_CACHE_TTL_MS,
    results,
  });
  trimSearchCache();

  return {
    cacheHit: false,
    results,
  };
}

function enforceRateLimit(clientId: string) {
  const now = Date.now();
  const existing = rateLimitStore.get(clientId);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(clientId, {
      count: 1,
      resetAt: now + SEARCH_RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  if (existing.count >= SEARCH_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    throw new SearchRateLimitError(retryAfterSeconds);
  }

  rateLimitStore.set(clientId, {
    count: existing.count + 1,
    resetAt: existing.resetAt,
  });
}

function pruneExpiredEntries(now: number) {
  for (const [cacheKey, entry] of searchCache.entries()) {
    if (entry.expiresAt <= now) {
      searchCache.delete(cacheKey);
    }
  }

  for (const [clientId, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(clientId);
    }
  }
}

function trimSearchCache() {
  while (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (!oldestKey) {
      return;
    }
    searchCache.delete(oldestKey);
  }
}
