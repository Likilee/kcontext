export const KOREAN_HOME_PATH = "/ko";
export const KOREAN_SEARCH_PATH = "/ko/search";

export function getKoreanSearchPath(keyword: string): string {
  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword) {
    return KOREAN_HOME_PATH;
  }

  return `${KOREAN_SEARCH_PATH}?q=${encodeURIComponent(normalizedKeyword)}`;
}
