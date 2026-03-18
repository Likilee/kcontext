import { describe, expect, it } from "vitest";
import { BLOG_PUBLISHED_DATE_FORMAT_OPTIONS, formatBlogPublishedDate } from "./blog-published-date";

describe("blog-published-date", () => {
  it("formats published dates as fixed UTC calendar days", () => {
    expect(formatBlogPublishedDate("2026-03-14")).toBe("March 14, 2026");
  });

  it("pins the formatter to UTC to avoid server timezone drift", () => {
    expect(BLOG_PUBLISHED_DATE_FORMAT_OPTIONS).toEqual({
      dateStyle: "long",
      timeZone: "UTC",
    });
  });
});
