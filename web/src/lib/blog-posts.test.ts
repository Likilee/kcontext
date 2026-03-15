import { describe, expect, it } from "vitest";
import { getBlogPostBySlug, getBlogPostSlugs, getBlogPosts } from "./blog-posts";

describe("blog-posts", () => {
  it("returns the seeded blog posts", () => {
    const posts = getBlogPosts();

    expect(posts).toHaveLength(1);
    expect(posts[0]?.slug).toBe("learn-korean-with-youtube-context");
  });

  it("returns every registered slug for static route generation", () => {
    expect(getBlogPostSlugs()).toEqual(["learn-korean-with-youtube-context"]);
  });

  it("finds a post by slug and returns undefined for missing slugs", () => {
    expect(getBlogPostBySlug("learn-korean-with-youtube-context")?.title).toBe(
      "Learn Korean in real context with YouTube subtitles",
    );
    expect(getBlogPostBySlug("missing-post")).toBeUndefined();
  });
});
