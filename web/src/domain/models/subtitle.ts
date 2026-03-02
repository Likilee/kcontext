export interface VideoMeta {
  videoId: string;
  title: string;
  channelName: string;
}

export interface SearchResult extends VideoMeta {
  startTime: number;
  matchedText: string;
}

export interface SubtitleChunk {
  startTime: number;
  text: string;
}
