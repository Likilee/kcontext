import { describe, expect, it } from "vitest";
import {
  BLOG_INDEX_PATH,
  getBlogPostPath,
  getKoreanSearchPath,
  KOREAN_HOME_PATH,
  KOREAN_SEARCH_PATH,
} from "./app-routes";

describe("app-routes", () => {
  it("returns the Korean home path constant", () => {
    expect(KOREAN_HOME_PATH).toBe("/ko");
  });

  it("returns the Korean search path constant", () => {
    expect(KOREAN_SEARCH_PATH).toBe("/ko/search");
  });

  it("builds an encoded Korean search path", () => {
    expect(getKoreanSearchPath(" hello world ")).toBe("/ko/search?q=hello%20world");
  });

  it("falls back to the Korean home path for empty search input", () => {
    expect(getKoreanSearchPath("   ")).toBe("/ko");
  });

  it("returns the blog index path constant", () => {
    expect(BLOG_INDEX_PATH).toBe("/blog");
  });

  it("builds an encoded blog detail path", () => {
    expect(getBlogPostPath(" learn-korean with youtube ")).toBe(
      "/blog/learn-korean%20with%20youtube",
    );
  });

  it("falls back to the blog index path for empty slug input", () => {
    expect(getBlogPostPath("   ")).toBe("/blog");
  });
});
