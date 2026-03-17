export interface VideoMeta {
  videoId: string;
  title: string | null;
  channelName: string | null;
}

export interface SearchResult extends VideoMeta {
  startTime: number;
  matchedText: string;
}

export interface SubtitleChunk {
  startTime: number;
  duration: number;
  text: string;
}
