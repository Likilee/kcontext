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

  it("returns the Korean site config for the canonical production and development hosts", () => {
    expect(getSiteConfigForHost("tubelang.com")).toBe(KOREAN_SITE_CONFIG);
    expect(getSiteConfigForHost("localhost:3000")).toBe(KOREAN_SITE_CONFIG);
  });

  it("falls back to the default site config for unknown hosts", () => {
    expect(getSiteConfigForHost("preview.tubelang.dev")).toBe(DEFAULT_SITE_CONFIG);
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
