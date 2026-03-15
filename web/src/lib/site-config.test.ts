import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_CONFIG,
  DEFAULT_UI_LANGUAGE_CODE,
  getRedirectHostForHost,
  getSiteConfig,
  getSiteConfigForRequest,
  isDevelopmentHost,
  normalizeHost,
  resolveLearningLanguageCode,
  resolveRequestedUiLanguageCode,
  resolveUiLanguageCode,
  resolveUiLanguageCodeFromRequestedLocale,
} from "./site-config";

describe("site-config", () => {
  it("normalizes hostnames by lowercasing and removing ports", () => {
    expect(normalizeHost("KO.LOCALHOST:3000")).toBe("ko.localhost");
  });

  it("resolves the first supported UI language from the request locale", () => {
    expect(resolveUiLanguageCodeFromRequestedLocale("ko-KR,ko;q=0.9,en-US;q=0.8")).toBe("ko");
    expect(resolveUiLanguageCodeFromRequestedLocale("en-GB,en;q=0.8,ko;q=0.6")).toBe("en");
  });

  it("respects q-values and skips explicitly rejected locales", () => {
    expect(resolveUiLanguageCodeFromRequestedLocale("ko;q=0,en;q=1")).toBe("en");
    expect(resolveUiLanguageCodeFromRequestedLocale("ko-KR;q=0.2,en-US;q=0.9")).toBe("en");
    expect(resolveUiLanguageCodeFromRequestedLocale("ko-KR;q=0,en-US;q=0.8")).toBe("en");
  });

  it("falls back to the default UI language when the locale is unsupported", () => {
    expect(resolveUiLanguageCodeFromRequestedLocale("ja-JP,fr;q=0.8")).toBe(
      DEFAULT_UI_LANGUAGE_CODE,
    );
    expect(resolveUiLanguageCodeFromRequestedLocale(null)).toBe(DEFAULT_UI_LANGUAGE_CODE);
  });

  it("prioritizes query, then cookie, then Accept-Language for UI resolution", () => {
    expect(
      resolveUiLanguageCode({
        requestedUiLanguageCode: "ko",
        storedUiLanguageCode: "en",
        requestedLocale: "en-US,en;q=0.9",
      }),
    ).toBe("ko");
    expect(
      resolveUiLanguageCode({
        requestedUiLanguageCode: null,
        storedUiLanguageCode: "ko",
        requestedLocale: "en-US,en;q=0.9",
      }),
    ).toBe("ko");
    expect(
      resolveUiLanguageCode({
        requestedUiLanguageCode: null,
        storedUiLanguageCode: null,
        requestedLocale: "ko-KR,ko;q=0.9",
      }),
    ).toBe("ko");
  });

  it("ignores unsupported query and cookie UI values", () => {
    expect(resolveRequestedUiLanguageCode("ja")).toBeNull();
    expect(
      resolveUiLanguageCode({
        requestedUiLanguageCode: "ja",
        storedUiLanguageCode: "fr",
        requestedLocale: "en-US,en;q=0.9",
      }),
    ).toBe("en");
  });

  it("resolves the learning-language route from the pathname", () => {
    expect(resolveLearningLanguageCode("/ko/search")).toBe("ko");
    expect(resolveLearningLanguageCode("/en")).toBe("en");
    expect(resolveLearningLanguageCode("/")).toBe("ko");
    expect(resolveLearningLanguageCode("/unknown")).toBe("ko");
  });

  it("returns combined learning-language and UI-language config for live routes", () => {
    const englishUiConfig = getSiteConfig({ learningLanguageCode: "ko", uiLanguageCode: "en" });
    const koreanUiConfig = getSiteConfig({ learningLanguageCode: "ko", uiLanguageCode: "ko" });

    expect(englishUiConfig.uiLanguageCode).toBe("en");
    expect(englishUiConfig.learningLanguageCode).toBe("ko");
    expect(englishUiConfig.learningLanguageName).toBe("Korean");
    expect(englishUiConfig.metadataTitle).toBe("Tubelang Korean");

    expect(koreanUiConfig.uiLanguageCode).toBe("ko");
    expect(koreanUiConfig.learningLanguageCode).toBe("ko");
    expect(koreanUiConfig.learningLanguageName).toBe("한국어");
    expect(koreanUiConfig.metadataTitle).toBe("튜브랭 한국어");
  });

  it("returns reserved route config for unsupported live learning experiences", () => {
    const reservedConfig = getSiteConfig({ learningLanguageCode: "en", uiLanguageCode: "ko" });

    expect(reservedConfig.isLearningLanguageLive).toBe(false);
    expect(reservedConfig.learningLanguageName).toBe("영어");
    expect(reservedConfig.metadataTitle).toBe("튜브랭 영어");
    expect(reservedConfig.metadataDescription).toBe("영어 학습 경험은 준비 중입니다.");
  });

  it("builds request-aware config from pathname, query, cookie, and locale", () => {
    const siteConfig = getSiteConfigForRequest({
      pathname: "/en/search",
      requestedUiLanguageCode: "ko",
      storedUiLanguageCode: "en",
      requestedLocale: "en-US,en;q=0.9",
    });

    expect(siteConfig.learningLanguageCode).toBe("en");
    expect(siteConfig.uiLanguageCode).toBe("ko");
    expect(siteConfig.isLearningLanguageLive).toBe(false);
  });

  it("falls back to the default config for root requests without overrides", () => {
    expect(
      getSiteConfigForRequest({
        pathname: "/",
        requestedUiLanguageCode: null,
        storedUiLanguageCode: null,
        requestedLocale: null,
      }),
    ).toBe(DEFAULT_SITE_CONFIG);
  });

  it("redirects legacy and alternate hosts to the canonical hosts", () => {
    expect(getRedirectHostForHost("kcontext.vercel.app")).toBe("tubelang.com");
    expect(getRedirectHostForHost("ko.tubelang.com")).toBe("tubelang.com");
    expect(getRedirectHostForHost("www.tubelang.com")).toBe("tubelang.com");
    expect(getRedirectHostForHost("127.0.0.1:3000")).toBe("localhost");
    expect(getRedirectHostForHost("ko.localhost:3000")).toBe("localhost");
  });

  it("detects local development hosts", () => {
    expect(isDevelopmentHost("localhost")).toBe(true);
    expect(isDevelopmentHost("localhost:3000")).toBe(true);
    expect(isDevelopmentHost("ko.localhost")).toBe(true);
    expect(isDevelopmentHost("tubelang.com")).toBe(false);
  });
});
