import { describe, expect, it } from "vitest";
import { isValidYouTubeVideoId } from "./is-valid-youtube-video-id";

describe("isValidYouTubeVideoId", () => {
  it("accepts a standard 11-character video id", () => {
    expect(isValidYouTubeVideoId("dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects nullish ids", () => {
    expect(isValidYouTubeVideoId(null)).toBe(false);
    expect(isValidYouTubeVideoId(undefined)).toBe(false);
  });

  it("rejects ids that do not match the YouTube format", () => {
    expect(isValidYouTubeVideoId("test_video_01")).toBe(false);
    expect(isValidYouTubeVideoId("short")).toBe(false);
    expect(isValidYouTubeVideoId("contains.period")).toBe(false);
  });
});
