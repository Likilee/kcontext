export const SUPPORTED_INTERFACE_LANGUAGE_CODES = ["en", "ko"] as const;

export type InterfaceLanguageCode = (typeof SUPPORTED_INTERFACE_LANGUAGE_CODES)[number];

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
}

export interface SiteConfig {
  readonly appName: string;
  readonly interfaceLanguageCode: InterfaceLanguageCode;
  readonly learningLanguageCode: string;
  readonly learningLanguageName: string;
  readonly learningLanguageNativeName: string;
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
    "interfaceLanguageCode" | "metadataTitle" | "metadataDescription" | "openGraphLocale" | "copy"
  > {}

interface SiteLocaleDefinition {
  readonly interfaceLanguageCode: InterfaceLanguageCode;
  readonly metadataTitle: string;
  readonly metadataDescription: string;
  readonly openGraphLocale: string;
  readonly copy: SiteCopy;
}

export const DEFAULT_INTERFACE_LANGUAGE_CODE: InterfaceLanguageCode = "en";

const BASE_SITE_CONFIG: SiteConfigBase = {
  appName: "Tubelang",
  learningLanguageCode: "ko",
  learningLanguageName: "Korean",
  learningLanguageNativeName: "한국어",
  primaryHost: "tubelang.com",
  developmentHost: "localhost",
  baseUrl: "https://tubelang.com",
  brandAssets: {
    horizontalLogoPath: "/brand/tubelang-ko-horizontal.png",
    verticalLogoPath: "/brand/tubelang-ko-vertical.png",
  },
};

const SITE_LOCALE_DEFINITIONS: Record<InterfaceLanguageCode, SiteLocaleDefinition> = {
  en: {
    interfaceLanguageCode: "en",
    metadataTitle: "Tubelang Korean",
    metadataDescription: "Real Korean, Right in Context.",
    openGraphLocale: "en_US",
    copy: {
      homeHeadline: ["Learn real Korean beyond textbooks.", "See it in native context."],
      homeAriaLabel: "Go to Tubelang Korean home",
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
    },
  },
  ko: {
    interfaceLanguageCode: "ko",
    metadataTitle: "튜브랭 한국어",
    metadataDescription: "진짜 한국어를 맥락 속에서 익히세요.",
    openGraphLocale: "ko_KR",
    copy: {
      homeHeadline: ["교과서 밖 진짜 한국어를", "맥락 속에서 익히세요."],
      homeAriaLabel: "튜브랭 한국어 홈으로 이동",
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
    },
  },
};

function createSiteConfig(interfaceLanguageCode: InterfaceLanguageCode): SiteConfig {
  return {
    ...BASE_SITE_CONFIG,
    ...SITE_LOCALE_DEFINITIONS[interfaceLanguageCode],
  };
}

const SITE_CONFIGS: Record<InterfaceLanguageCode, SiteConfig> = {
  en: createSiteConfig("en"),
  ko: createSiteConfig("ko"),
};

export const DEFAULT_SITE_CONFIG = SITE_CONFIGS[DEFAULT_INTERFACE_LANGUAGE_CODE];

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

function isSupportedInterfaceLanguageCode(value: string): value is InterfaceLanguageCode {
  return SUPPORTED_INTERFACE_LANGUAGE_CODES.some((languageCode) => languageCode === value);
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

export function resolveInterfaceLanguageCode(
  requestedLocale: string | null | undefined,
): InterfaceLanguageCode {
  for (const candidate of getRequestedLocaleCandidates(requestedLocale)) {
    if (isSupportedInterfaceLanguageCode(candidate)) {
      return candidate;
    }
  }

  return DEFAULT_INTERFACE_LANGUAGE_CODE;
}

export function getSiteConfigForInterfaceLanguage(
  requestedLocale: string | null | undefined,
): SiteConfig {
  return SITE_CONFIGS[resolveInterfaceLanguageCode(requestedLocale)];
}

export function getSiteConfigForHost(
  host: string | null | undefined,
  requestedLocale: string | null | undefined = DEFAULT_INTERFACE_LANGUAGE_CODE,
): SiteConfig {
  const normalizedHost = normalizeHost(host);
  const siteConfig = getSiteConfigForInterfaceLanguage(requestedLocale);

  if (
    normalizedHost === BASE_SITE_CONFIG.primaryHost ||
    normalizedHost === BASE_SITE_CONFIG.developmentHost
  ) {
    return siteConfig;
  }

  return siteConfig;
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
