import { describe, expect, it } from "vitest";
import { getDisplayChannelName, getDisplayVideoTitle } from "./video-meta-fallback";

describe("video-meta-fallback", () => {
  it("returns the original values when title and channel are present", () => {
    expect(getDisplayVideoTitle("테스트 영상")).toBe("테스트 영상");
    expect(getDisplayChannelName("테스트 채널")).toBe("테스트 채널");
  });

  it("returns deterministic fallbacks for missing metadata", () => {
    expect(getDisplayVideoTitle(null)).toBe("Untitled video");
    expect(getDisplayChannelName(null)).toBe("Unknown channel");
  });

  it("treats blank metadata as missing", () => {
    expect(getDisplayVideoTitle("   ")).toBe("Untitled video");
    expect(getDisplayChannelName("")).toBe("Unknown channel");
  });
});
