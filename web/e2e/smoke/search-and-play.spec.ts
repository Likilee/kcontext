import { expect, test, type Page, type Response } from "@playwright/test";

const EMPTY_STATE_TEXT = "even native speakers rarely use";

interface SearchResponseRow {
  videoId: string;
  title: string;
  channelName: string;
  startTime: number;
  matchedText: string;
}

interface TranscriptResponseChunk {
  start_time: number;
  duration: number;
  text: string;
}

async function searchKeyword(page: Page, keyword: string) {
  const searchBar = page.locator('[data-tubelang-search-input="true"]').first();
  await expect(searchBar).toBeVisible();
  await searchBar.fill(keyword);
  await searchBar.press("Enter");
}

function waitForSearchResponse(page: Page, keyword: string): Promise<Response> {
  return page.waitForResponse((response) => {
    if (response.request().method() !== "GET") {
      return false;
    }

    const url = new URL(response.url());
    return url.pathname === "/api/search" && url.searchParams.get("q") === keyword;
  });
}

function waitForTranscriptResponse(page: Page, videoId: string): Promise<Response> {
  return page.waitForResponse((response) => {
    if (response.request().method() !== "GET") {
      return false;
    }

    const url = new URL(response.url());
    return url.pathname.endsWith(`/storage/v1/object/public/subtitles/${videoId}.json`);
  });
}

async function expectJsonResponse<T>(response: Response, expectedStatus = 200): Promise<T> {
  expect(response.status()).toBe(expectedStatus);
  return (await response.json()) as T;
}

test.describe("Tubelang smoke E2E", () => {
  test("search focuses the results region without trapping playback shortcuts in the search input", async ({
    page,
  }) => {
    await page.goto("/");

    const searchResponsePromise = waitForSearchResponse(page, "김치찌개");
    await searchKeyword(page, "김치찌개");
    await expectJsonResponse<SearchResponseRow[]>(await searchResponsePromise);

    const globalSearchInput = page.locator("#global-search-input");
    const resultsFocusTarget = page.getByTestId("search-results-focus-target");
    await expect(page).toHaveURL("/ko/search?q=%EA%B9%80%EC%B9%98%EC%B0%8C%EA%B0%9C");
    await expect(resultsFocusTarget).toBeFocused();
    await expect(globalSearchInput).not.toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Submit search" })).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Clear search input" })).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(globalSearchInput).toBeFocused();

    const followUpSearchResponsePromise = waitForSearchResponse(page, "행복해요");
    await globalSearchInput.fill("행복해요");
    await globalSearchInput.press("Enter");
    await expectJsonResponse<SearchResponseRow[]>(await followUpSearchResponsePromise);

    await expect(page).toHaveURL("/ko/search?q=%ED%96%89%EB%B3%B5%ED%95%B4%EC%9A%94");
    await expect(resultsFocusTarget).toBeFocused();
    await expect(page.getByTestId("search-result-navigation")).toContainText("(1/1)");
  });

  test("seeded search returns deterministic results and enables the player controls", async ({
    page,
  }) => {
    await page.goto("/");

    const searchResponsePromise = waitForSearchResponse(page, "김치찌개");
    await searchKeyword(page, "김치찌개");

    const searchResponse = await searchResponsePromise;
    const results = await expectJsonResponse<SearchResponseRow[]>(searchResponse);
    expect(results).toHaveLength(1);

    const firstResult = results[0];
    if (!firstResult) {
      throw new Error("Expected a seeded search result for 김치찌개.");
    }

    expect(firstResult.videoId).toBe("test_video_03");
    expect(firstResult.matchedText).toContain("김치찌개");

    await expect(page).toHaveURL("/ko/search?q=%EA%B9%80%EC%B9%98%EC%B0%8C%EA%B0%9C");
    await expect(page.getByTestId("search-result-navigation")).toBeVisible();
    await expect(page.getByTestId("search-result-navigation")).toContainText("(1/1)");
    await expect(page.locator("#yt-player-container")).toBeVisible();
    await expect(page.getByTestId("replay-context-btn")).toBeVisible();
    await expect(page.getByTestId("replay-context-btn")).toBeEnabled();
    await expect(page.getByTestId("search-empty-state")).toBeHidden();
  });

  test("seeded search loads the transcript object for the selected result", async ({ page }) => {
    await page.goto("/");

    const searchResponsePromise = waitForSearchResponse(page, "행복해요");
    const transcriptResponsePromise = waitForTranscriptResponse(page, "test_video_01");

    await searchKeyword(page, "행복해요");

    const searchResponse = await searchResponsePromise;
    const results = await expectJsonResponse<SearchResponseRow[]>(searchResponse);
    const firstResult = results[0];
    if (!firstResult) {
      throw new Error("Expected a seeded search result for 행복해요.");
    }

    expect(firstResult.videoId).toBe("test_video_01");
    expect(firstResult.matchedText).toContain("행복해요");

    const transcriptResponse = await transcriptResponsePromise;
    const transcriptChunks = await expectJsonResponse<TranscriptResponseChunk[]>(transcriptResponse);
    expect(transcriptChunks).toHaveLength(4);

    const highlightedChunk = transcriptChunks.find((chunk) => chunk.text.includes("행복해요"));
    expect(highlightedChunk?.text).toContain("행복해요");

    await expect(page.getByTestId("search-result-navigation")).toBeVisible();
    await expect(page.getByTestId("search-result-navigation")).toContainText("(1/1)");
    await expect(page.getByTestId("chunk-viewer")).toBeVisible();
    await expect(page.getByTestId("replay-context-btn")).toBeEnabled();
    await expect(page.getByTestId("search-empty-state")).toBeHidden();
  });

  test("unknown search stays in empty state and does not expose player controls", async ({ page }) => {
    await page.goto("/");

    const searchResponsePromise = waitForSearchResponse(page, "zxcvbnmasdfghjkl1234567890");
    await searchKeyword(page, "zxcvbnmasdfghjkl1234567890");

    const searchResponse = await searchResponsePromise;
    const results = await expectJsonResponse<SearchResponseRow[]>(searchResponse);
    expect(results).toEqual([]);

    await expect(page.getByTestId("search-empty-state")).toBeVisible();
    await expect(page.getByText(EMPTY_STATE_TEXT).first()).toBeVisible();
    await expect(page.getByTestId("search-result-navigation")).toBeHidden();
    await expect(page.getByTestId("replay-context-btn")).toBeHidden();
  });
});
