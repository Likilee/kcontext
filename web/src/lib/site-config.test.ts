import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_CONFIG,
  getRedirectHostForHost,
  getSiteConfigForHost,
  isDevelopmentHost,
  KOREAN_SITE_CONFIG,
  normalizeHost,
} from "./site-config";

describe("site-config", () => {
  it("normalizes hostnames by lowercasing and removing ports", () => {
    expect(normalizeHost("KO.LOCALHOST:3000")).toBe("ko.localhost");
  });

  it("returns the Korean site config for production and local Korean hosts", () => {
    expect(getSiteConfigForHost("ko.tubelang.com")).toBe(KOREAN_SITE_CONFIG);
    expect(getSiteConfigForHost("ko.localhost:3000")).toBe(KOREAN_SITE_CONFIG);
  });

  it("falls back to the default site config for unknown hosts", () => {
    expect(getSiteConfigForHost("preview.tubelang.dev")).toBe(DEFAULT_SITE_CONFIG);
  });

  it("redirects apex and bare local hosts to the localized Korean host", () => {
    expect(getRedirectHostForHost("tubelang.com")).toBe("ko.tubelang.com");
    expect(getRedirectHostForHost("www.tubelang.com")).toBe("ko.tubelang.com");
    expect(getRedirectHostForHost("localhost:3000")).toBe("ko.localhost");
    expect(getRedirectHostForHost("127.0.0.1:3000")).toBe("ko.localhost");
  });

  it("detects local development hosts", () => {
    expect(isDevelopmentHost("ko.localhost")).toBe(true);
    expect(isDevelopmentHost("localhost:3000")).toBe(true);
    expect(isDevelopmentHost("ko.tubelang.com")).toBe(false);
  });
});
