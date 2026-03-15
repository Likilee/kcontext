import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchPage from "./page";

const { mockRedirect, mockGetRequestUrl } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGetRequestUrl: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("../request-site-config", () => ({
  getRequestUrl: mockGetRequestUrl,
}));

describe("root search redirect", () => {
  beforeEach(() => {
    mockRedirect.mockReset();
    mockGetRequestUrl.mockReset();
  });

  it("redirects search traffic to the default live learning route", async () => {
    mockGetRequestUrl.mockResolvedValue(
      new URL("https://tubelang.com/search?q=%ED%96%89%EB%B3%B5"),
    );

    await SearchPage();

    expect(mockRedirect).toHaveBeenCalledWith("/ko/search?q=%ED%96%89%EB%B3%B5");
  });

  it("preserves supported UI language and query params", async () => {
    mockGetRequestUrl.mockResolvedValue(
      new URL("https://tubelang.com/search?q=%ED%96%89%EB%B3%B5&hl=ko"),
    );

    await SearchPage();

    expect(mockRedirect).toHaveBeenCalledWith("/ko/search?q=%ED%96%89%EB%B3%B5&hl=ko");
  });
});
