import { expect, test, type Page, type Response } from "@playwright/test";

const EMPTY_STATE_TEXT = "even native speakers rarely use";
const UI_READY_TIMEOUT_MS = 10_000;
const PLAYER_FALLBACK_TEXT = "Video playback is temporarily unavailable.";

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

type YouTubeIframeApiMode = "ready" | "throw-on-init";

async function mockYouTubeIframeApi(page: Page, mode: YouTubeIframeApiMode) {
  const scriptBody =
    mode === "ready"
      ? `
          window.YT = {
            Player: function Player(_elementId, options) {
              const player = {
                currentTime: options?.playerVars?.start ?? 0,
                destroy() {},
                getCurrentTime() {
                  return this.currentTime;
                },
                loadVideoById(_videoId, startTime) {
                  this.currentTime = typeof startTime === "number" ? startTime : this.currentTime;
                },
                playVideo() {},
                seekTo(seconds) {
                  this.currentTime = seconds;
                },
                setPlaybackRate() {},
              };

              queueMicrotask(() => {
                options?.events?.onReady?.();
              });

              return player;
            },
          };
          window.onYouTubeIframeAPIReady?.();
        `
      : `
          window.YT = {
            Player: function Player() {
              throw new Error("mocked YouTube init failure");
            },
          };
          window.onYouTubeIframeAPIReady?.();
        `;
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: scriptBody,
    });
  });
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

test.describe("Tubelang smoke E2E", () => {
  test("seeded search returns deterministic results and enables the player controls", async ({
    page,
  }) => {
    await mockYouTubeIframeApi(page, "ready");
    await page.goto("/");

    const searchResponsePromise = waitForSearchResponse(page, "김치찌개");
    await searchKeyword(page, "김치찌개");

    const searchResponse = await searchResponsePromise;
    const results = await expectJsonResponse<SearchResponseRow[]>(searchResponse);
    expect(results.length).toBeGreaterThan(0);

    const firstResult = results[0];
    if (!firstResult) {
      throw new Error("Expected at least one live search result for 김치찌개.");
    }

    expect(firstResult.matchedText).toContain("김치찌개");

    await expect(page).toHaveURL("/ko/search?q=%EA%B9%80%EC%B9%98%EC%B0%8C%EA%B0%9C", {
      timeout: UI_READY_TIMEOUT_MS,
    });
    await expect(page.getByTestId("search-result-navigation")).toBeVisible({
      timeout: UI_READY_TIMEOUT_MS,
    });
    await expect(page.getByTestId("search-result-navigation")).toContainText("(1/1)", {
      timeout: UI_READY_TIMEOUT_MS,
    });
    await expect(page.locator("#yt-player-container")).toBeVisible({
      timeout: UI_READY_TIMEOUT_MS,
    });
    await expect(page.getByTestId("replay-context-btn")).toBeVisible({
      timeout: UI_READY_TIMEOUT_MS,
    });
    await expect(page.getByTestId("replay-context-btn")).toBeEnabled({
      timeout: UI_READY_TIMEOUT_MS,
    });
    await expect(page.getByTestId("search-empty-state")).toBeHidden();
  });

  test("seeded search loads the transcript object for the selected result", async ({ page }) => {
    await mockYouTubeIframeApi(page, "ready");
    await page.goto("/");

    const searchResponsePromise = waitForSearchResponse(page, "행복해요");
    const transcriptResponsePromise = waitForTranscriptResponse(page);

    await searchKeyword(page, "행복해요");

    const searchResponse = await searchResponsePromise;
    const results = await expectJsonResponse<SearchResponseRow[]>(searchResponse);
    const firstResult = results[0];
    if (!firstResult) {
      throw new Error("Expected a live search result for 행복해요.");
    }

    expect(firstResult.matchedText).toContain("행복해요");

    const transcriptResponse = await transcriptResponsePromise;
    expect(transcriptResponse.url()).toContain(`${firstResult.videoId}.json`);
    const transcriptChunks = await expectJsonResponse<TranscriptResponseChunk[]>(transcriptResponse);
    expect(transcriptChunks.length).toBeGreaterThan(0);

    const highlightedChunk = transcriptChunks.find((chunk) => chunk.text.includes("행복해요"));
    expect(highlightedChunk?.text).toContain("행복해요");

    await expect(page.getByTestId("search-result-navigation")).toBeVisible({
      timeout: UI_READY_TIMEOUT_MS,
    });
    await expect(page.getByTestId("search-result-navigation")).toContainText("(1/1)", {
      timeout: UI_READY_TIMEOUT_MS,
    });
    await expect(page.getByTestId("chunk-viewer")).toBeVisible({
      timeout: UI_READY_TIMEOUT_MS,
    });
    await expect(page.getByTestId("replay-context-btn")).toBeEnabled({
      timeout: UI_READY_TIMEOUT_MS,
    });
    await expect(page.getByTestId("search-empty-state")).toBeHidden();
  });

  test("search stays usable when YouTube player initialization fails", async ({ page }) => {
    await mockYouTubeIframeApi(page, "throw-on-init");
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

    const transcriptResponse = await transcriptResponsePromise;
    await expectJsonResponse<TranscriptResponseChunk[]>(transcriptResponse);

    await expect(page).toHaveURL("/ko/search?q=%ED%96%89%EB%B3%B5%ED%95%B4%EC%9A%94");
    await expect(page.getByTestId("search-result-navigation")).toBeVisible();
    await expect(page.getByTestId("chunk-viewer")).toBeVisible();
    await expect(page.getByTestId("youtube-player-fallback")).toBeVisible();
    await expect(page.getByTestId("youtube-player-fallback")).toContainText(PLAYER_FALLBACK_TEXT);
    await expect(page.getByTestId("youtube-player-retry")).toBeEnabled();
    await expect(page.getByTestId("replay-context-btn")).toBeDisabled();
    await expect(page.locator("body")).not.toContainText("Application error:");
  });

  test("unknown search stays in empty state and does not expose player controls", async ({ page }) => {
    const keyword = `zz-codex-e2e-${Date.now()}-nohit`;
    await mockYouTubeIframeApi(page, "ready");
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
});
