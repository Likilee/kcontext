import { expect, test, type Page, type Response } from "@playwright/test";

const EMPTY_STATE_TEXT = "even native speakers rarely use";

interface SearchResponseRow {
  videoId: string;
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

function waitForTranscriptResponse(page: Page, videoId?: string): Promise<Response> {
  return page.waitForResponse((response) => {
    if (response.request().method() !== "GET") {
      return false;
    }

    const url = new URL(response.url());
    if (!url.pathname.includes("/storage/v1/object/public/subtitles/")) {
      return false;
    }

    return !videoId || url.pathname.endsWith(`/storage/v1/object/public/subtitles/${videoId}.json`);
  });
}

async function expectJsonResponse<T>(response: Response, expectedStatus = 200): Promise<T> {
  expect(response.status()).toBe(expectedStatus);
  return (await response.json()) as T;
}

test.describe("Full stack integration", () => {
  test('Search "떡볶이" hydrates the player UI from live API data', async ({ page }) => {
    await page.goto("/");

    const searchResponsePromise = waitForSearchResponse(page, "떡볶이");
    await searchKeyword(page, "떡볶이");

    const searchResponse = await searchResponsePromise;
    const results = await expectJsonResponse<SearchResponseRow[]>(searchResponse);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.matchedText.includes("떡볶이"))).toBe(true);

    await expect(page).toHaveURL("/ko/search?q=%EB%96%A1%EB%B3%B6%EC%9D%B4");
    await expect(page.getByTestId("search-result-navigation")).toBeVisible();
    await expect(page.getByTestId("search-result-navigation")).toContainText(`(1/${results.length})`);
    await expect(page.locator("#yt-player-container")).toBeVisible();
    await expect(page.getByTestId("replay-context-btn")).toBeEnabled();
    await expect(page.getByTestId("search-empty-state")).toBeHidden();
  });

  test('Search "전분당" loads transcript data for the selected result', async ({ page }) => {
    await page.goto("/");

    const searchResponsePromise = waitForSearchResponse(page, "전분당");
    const transcriptResponsePromise = waitForTranscriptResponse(page);
    await searchKeyword(page, "전분당");

    const searchResponse = await searchResponsePromise;
    const results = await expectJsonResponse<SearchResponseRow[]>(searchResponse);
    expect(results.length).toBeGreaterThan(0);

    const firstResult = results[0];
    if (!firstResult) {
      throw new Error("Expected at least one fixture-backed result for 전분당.");
    }

    expect(firstResult.matchedText).toContain("전분당");

    const transcriptResponse = await transcriptResponsePromise;
    expect(transcriptResponse.url()).toContain(`${firstResult.videoId}.json`);
    const transcriptChunks = await expectJsonResponse<TranscriptResponseChunk[]>(transcriptResponse);
    expect(transcriptChunks.length).toBeGreaterThan(0);
    expect(transcriptChunks.some((chunk) => chunk.text.includes("전분당"))).toBe(true);

    await expect(page.getByTestId("chunk-viewer")).toBeVisible();
    await expect(page.getByTestId("replay-context-btn")).toBeEnabled();
    await expect(page.getByTestId("search-empty-state")).toBeHidden();
  });

  test('Search "죽마고우" exposes multi-result navigation from live data', async ({ page }) => {
    await page.goto("/");

    const searchResponsePromise = waitForSearchResponse(page, "죽마고우");
    await searchKeyword(page, "죽마고우");

    const searchResponse = await searchResponsePromise;
    const results = await expectJsonResponse<SearchResponseRow[]>(searchResponse);
    expect(results.length).toBeGreaterThan(1);
    expect(results.some((result) => result.matchedText.includes("죽마고우"))).toBe(true);

    await expect(page.getByTestId("search-result-navigation")).toBeVisible();
    await expect(page.getByTestId("search-result-navigation")).toContainText(`(1/${results.length})`);
    await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  test("a nonce keyword stays empty when the dataset does not contain it", async ({ page }) => {
    const keyword = `zz-codex-e2e-${Date.now()}-nohit`;

    await page.goto("/");

    const searchResponsePromise = waitForSearchResponse(page, keyword);
    await searchKeyword(page, keyword);

    const searchResponse = await searchResponsePromise;
    const results = await expectJsonResponse<SearchResponseRow[]>(searchResponse);
    expect(results).toEqual([]);

    await expect(page.getByTestId("search-empty-state")).toBeVisible();
    await expect(page.getByText(EMPTY_STATE_TEXT).first()).toBeVisible();
    await expect(page.getByTestId("search-result-navigation")).toBeHidden();
    await expect(page.getByTestId("replay-context-btn")).toBeHidden();
  });

  test('Search "과징금" keeps replay enabled for a live result', async ({ page }) => {
    await page.goto("/");

    const searchResponsePromise = waitForSearchResponse(page, "과징금");
    await searchKeyword(page, "과징금");

    const searchResponse = await searchResponsePromise;
    const results = await expectJsonResponse<SearchResponseRow[]>(searchResponse);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.matchedText.includes("과징금"))).toBe(true);

    const replayButton = page.getByTestId("replay-context-btn");
    await expect(replayButton).toBeVisible();
    await expect(replayButton).toBeEnabled();
    await replayButton.click();
    await expect(page.locator("#yt-player-container")).toBeVisible();
  });
});
