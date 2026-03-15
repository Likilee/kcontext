export const SUPPORTED_UI_LANGUAGE_CODES = ["en", "ko"] as const;
export const SUPPORTED_LEARNING_LANGUAGE_CODES = ["ko", "en"] as const;
export const LIVE_LEARNING_LANGUAGE_CODES = ["ko"] as const;

export const DEFAULT_UI_LANGUAGE_CODE = "en";
export const DEFAULT_LEARNING_LANGUAGE_CODE = "ko";

export const UI_LANGUAGE_QUERY_PARAM = "hl";
export const UI_LANGUAGE_COOKIE_NAME = "tubelang-ui-lang";

export type UiLanguageCode = (typeof SUPPORTED_UI_LANGUAGE_CODES)[number];
export type LearningLanguageCode = (typeof SUPPORTED_LEARNING_LANGUAGE_CODES)[number];

interface SiteCopy {
  readonly homeHeadline: readonly [string, string];
  readonly homeAriaLabel: string;
  readonly heroSearchAriaLabel: string;
  readonly globalSearchAriaLabel: string;
  readonly searchPlaceholder: string;
  readonly clearSearchInputAriaLabel: string;
  readonly submitSearchAriaLabel: string;
  readonly searchEmptyState: string;
  readonly searchResultPreviousLabel: string;
  readonly searchResultNextLabel: string;
  readonly replayContextLabel: string;
  readonly seekBackwardAriaLabel: string;
  readonly seekForwardAriaLabel: string;
  readonly togglePlaybackSpeedAriaLabel: string;
  readonly loadingSubtitlesAriaLabel: string;
  readonly keyboardShortcutHint: string;
  readonly uiLanguageSwitcherLabel: string;
  readonly switchToEnglishLabel: string;
  readonly switchToKoreanLabel: string;
  readonly reservedLearningEyebrow: string;
  readonly reservedLearningDescription: string;
  readonly reservedLearningCtaLabel: string;
}

export interface SiteConfig {
  readonly appName: string;
  readonly uiLanguageCode: UiLanguageCode;
  readonly learningLanguageCode: LearningLanguageCode;
  readonly learningLanguageName: string;
  readonly learningLanguageNativeName: string;
  readonly isLearningLanguageLive: boolean;
  readonly metadataTitle: string;
  readonly metadataDescription: string;
  readonly openGraphLocale: string;
  readonly primaryHost: string;
  readonly developmentHost: string;
  readonly baseUrl: string;
  readonly brandAssets: {
    readonly horizontalLogoPath: string;
    readonly verticalLogoPath: string;
  };
  readonly copy: SiteCopy;
}

interface SiteConfigBase
  extends Omit<
    SiteConfig,
    | "uiLanguageCode"
    | "learningLanguageCode"
    | "learningLanguageName"
    | "learningLanguageNativeName"
    | "isLearningLanguageLive"
    | "metadataTitle"
    | "metadataDescription"
    | "openGraphLocale"
    | "copy"
  > {}

interface UiLanguageDefinition {
  readonly openGraphLocale: string;
  readonly copy: SiteCopy;
  readonly metadataDescriptions: Record<LearningLanguageCode, string>;
}

interface LearningLanguageDefinition {
  readonly nativeName: string;
  readonly displayNames: Record<UiLanguageCode, string>;
  readonly isLive: boolean;
}

const BASE_SITE_CONFIG: SiteConfigBase = {
  appName: "Tubelang",
  primaryHost: "tubelang.com",
  developmentHost: "localhost",
  baseUrl: "https://tubelang.com",
  brandAssets: {
    horizontalLogoPath: "/brand/tubelang-ko-horizontal.png",
    verticalLogoPath: "/brand/tubelang-ko-vertical.png",
  },
};

const LEARNING_LANGUAGE_DEFINITIONS: Record<LearningLanguageCode, LearningLanguageDefinition> = {
  ko: {
    nativeName: "한국어",
    displayNames: {
      en: "Korean",
      ko: "한국어",
    },
    isLive: true,
  },
  en: {
    nativeName: "영어",
    displayNames: {
      en: "English",
      ko: "영어",
    },
    isLive: false,
  },
};

const UI_LANGUAGE_DEFINITIONS: Record<UiLanguageCode, UiLanguageDefinition> = {
  en: {
    openGraphLocale: "en_US",
    metadataDescriptions: {
      ko: "Real Korean, Right in Context.",
      en: "English learning is coming soon.",
    },
    copy: {
      homeHeadline: ["Learn real Korean beyond textbooks.", "See it in native context."],
      homeAriaLabel: "Go to Tubelang home",
      heroSearchAriaLabel: "Search Korean in context",
      globalSearchAriaLabel: "Search real Korean",
      searchPlaceholder: "Search real Korean",
      clearSearchInputAriaLabel: "Clear search input",
      submitSearchAriaLabel: "Submit search",
      searchEmptyState:
        "Hmm, even native speakers rarely use this exact phrase. Try searching for a shorter keyword.",
      searchResultPreviousLabel: "Prev",
      searchResultNextLabel: "Next",
      replayContextLabel: "Replay context",
      seekBackwardAriaLabel: "Seek backward 5 seconds",
      seekForwardAriaLabel: "Seek forward 5 seconds",
      togglePlaybackSpeedAriaLabel: "Toggle playback speed",
      loadingSubtitlesAriaLabel: "Loading subtitles",
      keyboardShortcutHint: "Keyboard: ← → switch videos | R or Space replay",
      uiLanguageSwitcherLabel: "Switch interface language",
      switchToEnglishLabel: "Switch interface to English",
      switchToKoreanLabel: "Switch interface to Korean",
      reservedLearningEyebrow: "Reserved route",
      reservedLearningDescription:
        "Tubelang is live for Korean today. Explore the Korean route while the English experience is still in progress.",
      reservedLearningCtaLabel: "Explore Korean now",
    },
  },
  ko: {
    openGraphLocale: "ko_KR",
    metadataDescriptions: {
      ko: "진짜 한국어를 맥락 속에서 익히세요.",
      en: "영어 학습 경험은 준비 중입니다.",
    },
    copy: {
      homeHeadline: ["교과서 밖 진짜 한국어를", "맥락 속에서 익히세요."],
      homeAriaLabel: "튜브랭 홈으로 이동",
      heroSearchAriaLabel: "한국어 문맥 검색",
      globalSearchAriaLabel: "실전 한국어 검색",
      searchPlaceholder: "진짜 한국어 검색",
      clearSearchInputAriaLabel: "검색어 지우기",
      submitSearchAriaLabel: "검색 실행",
      searchEmptyState:
        "원어민도 이 표현을 딱 그대로는 거의 쓰지 않아요. 더 짧은 키워드로 다시 검색해 보세요.",
      searchResultPreviousLabel: "이전",
      searchResultNextLabel: "다음",
      replayContextLabel: "문맥 다시 듣기",
      seekBackwardAriaLabel: "5초 뒤로 이동",
      seekForwardAriaLabel: "5초 앞으로 이동",
      togglePlaybackSpeedAriaLabel: "재생 속도 전환",
      loadingSubtitlesAriaLabel: "자막 불러오는 중",
      keyboardShortcutHint: "키보드: ← → 영상 전환 | R 또는 Space 다시 재생",
      uiLanguageSwitcherLabel: "인터페이스 언어 전환",
      switchToEnglishLabel: "영어 UI로 전환",
      switchToKoreanLabel: "한국어 UI로 전환",
      reservedLearningEyebrow: "준비 중인 학습 경로",
      reservedLearningDescription:
        "현재 Tubelang은 한국어 학습 경로만 제공하고 있습니다. 영어 경험은 준비되는 동안 한국어 경로를 먼저 둘러보세요.",
      reservedLearningCtaLabel: "한국어 경로 둘러보기",
    },
  },
};

function createSiteConfig(
  learningLanguageCode: LearningLanguageCode,
  uiLanguageCode: UiLanguageCode,
): SiteConfig {
  const learningLanguage = LEARNING_LANGUAGE_DEFINITIONS[learningLanguageCode];
  const uiLanguage = UI_LANGUAGE_DEFINITIONS[uiLanguageCode];
  const learningLanguageName = learningLanguage.displayNames[uiLanguageCode];

  return {
    ...BASE_SITE_CONFIG,
    uiLanguageCode,
    learningLanguageCode,
    learningLanguageName,
    learningLanguageNativeName: learningLanguage.nativeName,
    isLearningLanguageLive: learningLanguage.isLive,
    metadataTitle:
      uiLanguageCode === "ko"
        ? `튜브랭 ${learningLanguageName}`
        : `Tubelang ${learningLanguageName}`,
    metadataDescription: uiLanguage.metadataDescriptions[learningLanguageCode],
    openGraphLocale: uiLanguage.openGraphLocale,
    copy: uiLanguage.copy,
  };
}

const SITE_CONFIGS: Record<LearningLanguageCode, Record<UiLanguageCode, SiteConfig>> = {
  ko: {
    en: createSiteConfig("ko", "en"),
    ko: createSiteConfig("ko", "ko"),
  },
  en: {
    en: createSiteConfig("en", "en"),
    ko: createSiteConfig("en", "ko"),
  },
};

export const DEFAULT_SITE_CONFIG =
  SITE_CONFIGS[DEFAULT_LEARNING_LANGUAGE_CODE][DEFAULT_UI_LANGUAGE_CODE];

const PRODUCTION_REDIRECT_HOSTS = new Set([
  "kcontext.vercel.app",
  "ko.tubelang.com",
  "www.tubelang.com",
]);
const DEVELOPMENT_REDIRECT_HOSTS = new Set(["127.0.0.1", "ko.localhost"]);

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
}

export function isDevelopmentHost(host: string | null | undefined): boolean {
  const normalizedHost = normalizeHost(host);
  return (
    normalizedHost === BASE_SITE_CONFIG.developmentHost ||
    DEVELOPMENT_REDIRECT_HOSTS.has(normalizedHost)
  );
}

export function isSupportedUiLanguageCode(value: string): value is UiLanguageCode {
  return SUPPORTED_UI_LANGUAGE_CODES.some((languageCode) => languageCode === value);
}

export function isSupportedLearningLanguageCode(value: string): value is LearningLanguageCode {
  return SUPPORTED_LEARNING_LANGUAGE_CODES.some((languageCode) => languageCode === value);
}

export function isLiveLearningLanguageCode(learningLanguageCode: LearningLanguageCode): boolean {
  return LIVE_LEARNING_LANGUAGE_CODES.some((languageCode) => languageCode === learningLanguageCode);
}

function normalizeRequestedLanguageCode(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
}

export function resolveRequestedUiLanguageCode(
  value: string | null | undefined,
): UiLanguageCode | null {
  const normalizedValue = normalizeRequestedLanguageCode(value);

  if (!normalizedValue || !isSupportedUiLanguageCode(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

interface RequestedLocaleCandidate {
  readonly locale: string;
  readonly quality: number;
  readonly order: number;
}

function resolveLocaleQuality(parameters: readonly string[]): number {
  for (const parameter of parameters) {
    const trimmedParameter = parameter.trim().toLowerCase();
    if (!trimmedParameter.startsWith("q=")) {
      continue;
    }

    const quality = Number.parseFloat(trimmedParameter.slice(2));
    if (Number.isNaN(quality)) {
      return 0;
    }

    return Math.max(0, Math.min(quality, 1));
  }

  return 1;
}

function getRequestedLocaleCandidates(
  requestedLocale: string | null | undefined,
): readonly string[] {
  const parsedCandidates = (requestedLocale ?? "")
    .split(",")
    .flatMap<RequestedLocaleCandidate>((entry, order) => {
      const [rawLocale, ...parameters] = entry.split(";");
      const locale = rawLocale?.trim().toLowerCase();
      if (!locale) {
        return [];
      }

      const quality = resolveLocaleQuality(parameters);
      if (quality <= 0) {
        return [];
      }

      return [{ locale, quality, order }];
    })
    .sort((left, right) => {
      if (left.quality !== right.quality) {
        return right.quality - left.quality;
      }

      return left.order - right.order;
    });

  const candidates: string[] = [];
  const seenCandidates = new Set<string>();

  for (const parsedCandidate of parsedCandidates) {
    const baseLanguageCode = parsedCandidate.locale.split("-")[0];
    const localeVariants = [parsedCandidate.locale];

    if (baseLanguageCode && baseLanguageCode !== parsedCandidate.locale) {
      localeVariants.push(baseLanguageCode);
    }

    for (const localeVariant of localeVariants) {
      if (seenCandidates.has(localeVariant)) {
        continue;
      }

      seenCandidates.add(localeVariant);
      candidates.push(localeVariant);
    }
  }

  return candidates;
}

export function resolveUiLanguageCodeFromRequestedLocale(
  requestedLocale: string | null | undefined,
): UiLanguageCode {
  for (const candidate of getRequestedLocaleCandidates(requestedLocale)) {
    if (isSupportedUiLanguageCode(candidate)) {
      return candidate;
    }
  }

  return DEFAULT_UI_LANGUAGE_CODE;
}

export function resolveUiLanguageCode({
  requestedUiLanguageCode,
  storedUiLanguageCode,
  requestedLocale,
}: {
  readonly requestedUiLanguageCode: string | null | undefined;
  readonly storedUiLanguageCode: string | null | undefined;
  readonly requestedLocale: string | null | undefined;
}): UiLanguageCode {
  return (
    resolveRequestedUiLanguageCode(requestedUiLanguageCode) ??
    resolveRequestedUiLanguageCode(storedUiLanguageCode) ??
    resolveUiLanguageCodeFromRequestedLocale(requestedLocale)
  );
}

export function resolveLearningLanguageCode(
  pathname: string | null | undefined,
): LearningLanguageCode {
  const normalizedPathname = (pathname ?? "").trim();
  const [rawPathSegment] = normalizedPathname.replace(/^\/+/, "").split("/");
  const pathSegment = rawPathSegment?.trim().toLowerCase();

  if (pathSegment && isSupportedLearningLanguageCode(pathSegment)) {
    return pathSegment;
  }

  return DEFAULT_LEARNING_LANGUAGE_CODE;
}

export function getSiteConfig({
  learningLanguageCode = DEFAULT_LEARNING_LANGUAGE_CODE,
  uiLanguageCode = DEFAULT_UI_LANGUAGE_CODE,
}: {
  readonly learningLanguageCode?: LearningLanguageCode;
  readonly uiLanguageCode?: UiLanguageCode;
} = {}): SiteConfig {
  return SITE_CONFIGS[learningLanguageCode][uiLanguageCode];
}

export function getSiteConfigForRequest({
  pathname,
  requestedUiLanguageCode,
  storedUiLanguageCode,
  requestedLocale,
}: {
  readonly pathname: string | null | undefined;
  readonly requestedUiLanguageCode: string | null | undefined;
  readonly storedUiLanguageCode: string | null | undefined;
  readonly requestedLocale: string | null | undefined;
}): SiteConfig {
  return getSiteConfig({
    learningLanguageCode: resolveLearningLanguageCode(pathname),
    uiLanguageCode: resolveUiLanguageCode({
      requestedUiLanguageCode,
      storedUiLanguageCode,
      requestedLocale,
    }),
  });
}

export function getRedirectHostForHost(host: string | null | undefined): string | null {
  const normalizedHost = normalizeHost(host);

  if (PRODUCTION_REDIRECT_HOSTS.has(normalizedHost)) {
    return BASE_SITE_CONFIG.primaryHost;
  }

  if (DEVELOPMENT_REDIRECT_HOSTS.has(normalizedHost)) {
    return BASE_SITE_CONFIG.developmentHost;
  }

  return null;
}
