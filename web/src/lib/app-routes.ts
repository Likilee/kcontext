export const KOREAN_HOME_PATH = "/ko";
export const KOREAN_SEARCH_PATH = "/ko/search";
export const BLOG_INDEX_PATH = "/blog";

export function getKoreanSearchPath(keyword: string): string {
  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword) {
    return KOREAN_HOME_PATH;
  }

  return `${KOREAN_SEARCH_PATH}?q=${encodeURIComponent(normalizedKeyword)}`;
}

export function getBlogPostPath(slug: string): string {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    return BLOG_INDEX_PATH;
  }

  return `${BLOG_INDEX_PATH}/${encodeURIComponent(normalizedSlug)}`;
}
