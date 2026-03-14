import type { SearchResult, SubtitleChunk, VideoMeta } from "./subtitle";

describe("Domain Models", () => {
  it("should define VideoMeta shape", () => {
    const meta: VideoMeta = {
      videoId: "abc123",
      title: "Test Video",
      channelName: "Test Channel",
    };
    expect(meta.videoId).toBe("abc123");
  });

  it("should define SearchResult extending VideoMeta", () => {
    const result: SearchResult = {
      videoId: "abc123",
      title: "Test Video",
      channelName: "Test Channel",
      startTime: 12.5,
      matchedText: "안녕하세요",
    };
    expect(result.startTime).toBe(12.5);
    expect(result.matchedText).toBe("안녕하세요");
  });

  it("should allow missing video metadata", () => {
    const result: SearchResult = {
      videoId: "abc123",
      title: null,
      channelName: null,
      startTime: 12.5,
      matchedText: "안녕하세요",
    };

    expect(result.title).toBeNull();
    expect(result.channelName).toBeNull();
  });

  it("should define SubtitleChunk shape", () => {
    const chunk: SubtitleChunk = {
      startTime: 0,
      duration: 2.5,
      text: "테스트 자막",
    };
    expect(chunk.duration).toBe(2.5);
    expect(chunk.text).toBe("테스트 자막");
  });
});
