import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const { mockRedirect, mockGetRequestUrl } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGetRequestUrl: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("./request-site-config", () => ({
  getRequestUrl: mockGetRequestUrl,
}));

describe("root home redirect", () => {
  beforeEach(() => {
    mockRedirect.mockReset();
    mockGetRequestUrl.mockReset();
  });

  it("redirects to the default learning route", async () => {
    mockGetRequestUrl.mockResolvedValue(new URL("https://tubelang.com/"));

    await HomePage();

    expect(mockRedirect).toHaveBeenCalledWith("/ko");
  });

  it("preserves a supported UI language query parameter", async () => {
    mockGetRequestUrl.mockResolvedValue(new URL("https://tubelang.com/?hl=ko"));

    await HomePage();

    expect(mockRedirect).toHaveBeenCalledWith("/ko?hl=ko");
  });
});
