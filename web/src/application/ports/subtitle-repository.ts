import type { SearchResult, SubtitleChunk } from "@/domain/models/subtitle";

export interface SubtitleRepository {
  searchByKeyword(keyword: string): Promise<SearchResult[]>;
  getFullTranscript(videoId: string): Promise<SubtitleChunk[]>;
}
