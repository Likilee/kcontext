export const BLOG_PUBLISHED_DATE_FORMAT_OPTIONS = {
  dateStyle: "long",
  timeZone: "UTC",
} as const satisfies Intl.DateTimeFormatOptions;

export function formatBlogPublishedDate(publishedAt: string): string {
  return new Intl.DateTimeFormat("en-US", BLOG_PUBLISHED_DATE_FORMAT_OPTIONS).format(
    new Date(`${publishedAt}T00:00:00Z`),
  );
}
