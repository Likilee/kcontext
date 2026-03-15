import { describe, expect, it } from "vitest";
import {
  DEFAULT_INTERFACE_LANGUAGE_CODE,
  DEFAULT_SITE_CONFIG,
  getRedirectHostForHost,
  getSiteConfigForHost,
  isDevelopmentHost,
  normalizeHost,
  resolveInterfaceLanguageCode,
} from "./site-config";

describe("site-config", () => {
  it("normalizes hostnames by lowercasing and removing ports", () => {
    expect(normalizeHost("KO.LOCALHOST:3000")).toBe("ko.localhost");
  });

  it("resolves the first supported interface language from the request locale", () => {
    expect(resolveInterfaceLanguageCode("ko-KR,ko;q=0.9,en-US;q=0.8")).toBe("ko");
    expect(resolveInterfaceLanguageCode("en-GB,en;q=0.8,ko;q=0.6")).toBe("en");
  });

  it("respects q-values and skips explicitly rejected locales", () => {
    expect(resolveInterfaceLanguageCode("ko;q=0,en;q=1")).toBe("en");
    expect(resolveInterfaceLanguageCode("ko-KR;q=0.2,en-US;q=0.9")).toBe("en");
    expect(resolveInterfaceLanguageCode("ko-KR;q=0,en-US;q=0.8")).toBe("en");
  });

  it("falls back to the default interface language when the locale is unsupported", () => {
    expect(resolveInterfaceLanguageCode("ja-JP,fr;q=0.8")).toBe(DEFAULT_INTERFACE_LANGUAGE_CODE);
    expect(resolveInterfaceLanguageCode(null)).toBe(DEFAULT_INTERFACE_LANGUAGE_CODE);
  });

  it("returns locale-specific copy and metadata for the canonical hosts", () => {
    const englishSiteConfig = getSiteConfigForHost("tubelang.com", "en-US,en;q=0.9");
    const koreanSiteConfig = getSiteConfigForHost("localhost:3000", "ko-KR,ko;q=0.9");

    expect(englishSiteConfig.interfaceLanguageCode).toBe("en");
    expect(englishSiteConfig.metadataTitle).toBe("Tubelang Korean");
    expect(englishSiteConfig.copy.searchPlaceholder).toBe("Search real Korean");

    expect(koreanSiteConfig.interfaceLanguageCode).toBe("ko");
    expect(koreanSiteConfig.metadataTitle).toBe("튜브랭 한국어");
    expect(koreanSiteConfig.copy.searchPlaceholder).toBe("진짜 한국어 검색");
  });

  it("falls back to the default locale config for unknown hosts and unsupported locales", () => {
    expect(getSiteConfigForHost("preview.tubelang.dev", "ja-JP")).toBe(DEFAULT_SITE_CONFIG);
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
