import type { SubtitleRepository } from "@/application/ports/subtitle-repository";
import type { SearchResult, SubtitleChunk } from "@/domain/models/subtitle";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/client";

interface SearchResultRow {
  video_id: string;
  title: string;
  channel_name: string;
  start_time: number;
  text: string;
}

interface CdnSubtitleChunk {
  start_time: number;
  duration: number;
  text: string;
}

export class SupabaseSubtitleRepository implements SubtitleRepository {
  async searchByKeyword(keyword: string): Promise<SearchResult[]> {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("search_subtitles", {
      search_keyword: keyword,
    });

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    return (data as SearchResultRow[]).map((row) => ({
      videoId: row.video_id,
      title: row.title,
      channelName: row.channel_name,
      startTime: row.start_time,
      matchedText: row.text,
    }));
  }

  async getFullTranscript(videoId: string): Promise<SubtitleChunk[]> {
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
    if (!cdnUrl) {
      throw new Error("Missing NEXT_PUBLIC_CDN_URL environment variable");
    }

    const response = await fetch(`${cdnUrl}/subtitles/${videoId}.json`);
    if (!response.ok) {
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
