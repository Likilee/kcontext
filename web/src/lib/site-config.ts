export interface SiteConfig {
  readonly appName: string;
  readonly interfaceLanguageCode: string;
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
  readonly copy: {
    readonly homeHeadline: readonly [string, string];
    readonly homeAriaLabel: string;
    readonly heroSearchAriaLabel: string;
    readonly globalSearchAriaLabel: string;
    readonly searchPlaceholder: string;
  };
}

export const KOREAN_SITE_CONFIG: SiteConfig = {
  appName: "Tubelang",
  interfaceLanguageCode: "en",
  learningLanguageCode: "ko",
  learningLanguageName: "Korean",
  learningLanguageNativeName: "한국어",
  metadataTitle: "Tubelang Korean",
  metadataDescription: "Real Korean, Right in Context.",
  openGraphLocale: "ko_KR",
  primaryHost: "ko.tubelang.com",
  developmentHost: "ko.localhost",
  baseUrl: "https://ko.tubelang.com",
  brandAssets: {
    horizontalLogoPath: "/brand/tubelang-ko-horizontal.png",
    verticalLogoPath: "/brand/tubelang-ko-vertical.png",
  },
  copy: {
    homeHeadline: ["Learn real Korean beyond textbooks.", "See it in native context."],
    homeAriaLabel: "Go to Tubelang Korean home",
    heroSearchAriaLabel: "Hero search for Korean context",
    globalSearchAriaLabel: "Global search for real Korean",
    searchPlaceholder: "Search real Korean",
  },
};

export const DEFAULT_SITE_CONFIG = KOREAN_SITE_CONFIG;

const PRODUCTION_REDIRECT_HOSTS = new Set(["tubelang.com", "www.tubelang.com"]);
const DEVELOPMENT_REDIRECT_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
}

export function isDevelopmentHost(host: string | null | undefined): boolean {
  const normalizedHost = normalizeHost(host);
  return (
    normalizedHost === KOREAN_SITE_CONFIG.developmentHost ||
    DEVELOPMENT_REDIRECT_HOSTS.has(normalizedHost)
  );
}

export function getSiteConfigForHost(host: string | null | undefined): SiteConfig {
  const normalizedHost = normalizeHost(host);
  if (
    normalizedHost === KOREAN_SITE_CONFIG.primaryHost ||
    normalizedHost === KOREAN_SITE_CONFIG.developmentHost
  ) {
    return KOREAN_SITE_CONFIG;
  }

  return DEFAULT_SITE_CONFIG;
}

export function getRedirectHostForHost(host: string | null | undefined): string | null {
  const normalizedHost = normalizeHost(host);

  if (PRODUCTION_REDIRECT_HOSTS.has(normalizedHost)) {
    return KOREAN_SITE_CONFIG.primaryHost;
  }

  if (DEVELOPMENT_REDIRECT_HOSTS.has(normalizedHost)) {
    return KOREAN_SITE_CONFIG.developmentHost;
  }

  return null;
}
