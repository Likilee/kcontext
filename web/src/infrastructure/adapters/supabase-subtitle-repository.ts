import type { SubtitleRepository } from "@/application/ports/subtitle-repository";
import type { SearchResult, SubtitleChunk } from "@/domain/models/subtitle";

interface CdnSubtitleChunk {
  start_time: number;
  duration: number;
  text: string;
}

export class SupabaseSubtitleRepository implements SubtitleRepository {
  async searchByKeyword(keyword: string, audioLanguageCode: string): Promise<SearchResult[]> {
    const searchUrl = new URL("/api/search", window.location.origin);
    searchUrl.searchParams.set("lang", audioLanguageCode);
    searchUrl.searchParams.set("q", keyword);

    const response = await fetch(searchUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errorPayload?.error ?? `Search failed: ${response.status}`);
    }

    return (await response.json()) as SearchResult[];
  }

  async getFullTranscript(videoId: string): Promise<SubtitleChunk[]> {
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
    if (!cdnUrl) {
      throw new Error("Missing NEXT_PUBLIC_CDN_URL environment variable");
    }

    const response = await fetch(`${cdnUrl}/subtitles/${encodeURIComponent(videoId)}.json`, {
      cache: "force-cache",
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      console.error(
        JSON.stringify({
          event: "transcript_fetch_failed",
          status: response.status,
          videoId,
        }),
      );
      throw new Error(`Failed to fetch transcript: ${response.status}`);
    }

    const chunks = (await response.json()) as CdnSubtitleChunk[];

    return chunks.map((chunk) => ({
      startTime: chunk.start_time,
      duration: chunk.duration,
      text: chunk.text,
    }));
  }
}
