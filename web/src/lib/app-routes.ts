import {
  DEFAULT_LEARNING_LANGUAGE_CODE,
  type LearningLanguageCode,
  UI_LANGUAGE_QUERY_PARAM,
  type UiLanguageCode,
} from "./site-config";

const SEARCH_KEYWORD_QUERY_PARAM = "q";

function buildPathname(pathname: string, searchParams: URLSearchParams): string {
  const search = searchParams.toString();
  return search.length > 0 ? `${pathname}?${search}` : pathname;
}

function getNormalizedSearchParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

export function getLearningHomePath(
  learningLanguageCode: LearningLanguageCode,
  uiLanguageCode?: UiLanguageCode | null,
): string {
  const searchParams = new URLSearchParams();

  if (uiLanguageCode) {
    searchParams.set(UI_LANGUAGE_QUERY_PARAM, uiLanguageCode);
  }

  return buildPathname(`/${learningLanguageCode}`, searchParams);
}

export function getLearningSearchPath({
  learningLanguageCode,
  keyword,
  uiLanguageCode,
}: {
  readonly learningLanguageCode: LearningLanguageCode;
  readonly keyword: string;
  readonly uiLanguageCode?: UiLanguageCode | null;
}): string {
  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword) {
    return getLearningHomePath(learningLanguageCode, uiLanguageCode);
  }

  const searchParams = new URLSearchParams();
  searchParams.set(SEARCH_KEYWORD_QUERY_PARAM, normalizedKeyword);

  if (uiLanguageCode) {
    searchParams.set(UI_LANGUAGE_QUERY_PARAM, uiLanguageCode);
  }

  return buildPathname(`/${learningLanguageCode}/search`, searchParams);
}

export function getDefaultLearningHomePath(uiLanguageCode?: UiLanguageCode | null): string {
  return getLearningHomePath(DEFAULT_LEARNING_LANGUAGE_CODE, uiLanguageCode);
}

export function getDefaultLearningSearchPath({
  keyword,
  uiLanguageCode,
}: {
  readonly keyword: string;
  readonly uiLanguageCode?: UiLanguageCode | null;
}): string {
  return getLearningSearchPath({
    learningLanguageCode: DEFAULT_LEARNING_LANGUAGE_CODE,
    keyword,
    uiLanguageCode,
  });
}

export function getUiLanguageSwitchPath({
  pathname,
  search,
  uiLanguageCode,
}: {
  readonly pathname: string;
  readonly search: string;
  readonly uiLanguageCode: UiLanguageCode;
}): string {
  const searchParams = getNormalizedSearchParams(search);
  searchParams.set(UI_LANGUAGE_QUERY_PARAM, uiLanguageCode);
  return buildPathname(pathname, searchParams);
}

export function getCanonicalSearch(search: string): string {
  const searchParams = getNormalizedSearchParams(search);
  searchParams.delete(UI_LANGUAGE_QUERY_PARAM);
  const normalizedSearch = searchParams.toString();
  return normalizedSearch.length > 0 ? `?${normalizedSearch}` : "";
}
