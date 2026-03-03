import { expect, test, type Page } from "@playwright/test";

const EMPTY_STATE_TEXT = "even native speakers rarely use";

async function searchKeyword(page: Page, keyword: string) {
  const searchBar = page.locator('input[type="search"]');
  await expect(searchBar).toBeVisible();
  await searchBar.fill(keyword);
  await searchBar.press("Enter");
}

test.describe("kcontext User Scenarios", () => {
  test("Scenario 1: Seed-based keyword search returns deterministic card", async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "김치찌개");

    const firstResult = page.locator('[data-testid="search-result-card"]').first();
    await expect(firstResult).toBeVisible({ timeout: 10_000 });
    await expect(firstResult.locator('[data-testid="video-title"]')).toHaveText(
      "테스트 영상 3: 요리 방송",
    );
    await expect(firstResult.locator('[data-testid="channel-name"]')).toHaveText("요리 채널");
    await expect(firstResult.locator("mark").first()).toContainText("김치찌개");
  });

  test("Scenario 2: Click result -> player panel shows chunk-viewer and controls", async ({
    page,
  }) => {
    await page.goto("/");
    await searchKeyword(page, "행복해요");

    const firstResult = page.locator('[data-testid="search-result-card"]').first();
    await expect(firstResult).toBeVisible({ timeout: 10_000 });
    await expect(firstResult.locator('[data-testid="video-title"]')).toHaveText(
      "테스트 영상 1: 일상 대화",
    );
    await expect(firstResult.locator('[data-testid="channel-name"]')).toHaveText("테스트 채널");
    await firstResult.click();

    const playerContainer = page.locator("#yt-player-container");
    await expect(playerContainer).toBeVisible({ timeout: 5_000 });

    const chunkViewer = page.locator('[data-testid="chunk-viewer"]');
    await expect(chunkViewer).toBeVisible();
  });

  test("Scenario 3: Click Replay context -> button is clickable and app does not crash", async ({
    page,
  }) => {
    await page.goto("/");
    await searchKeyword(page, "행복해요");

    const firstResult = page.locator('[data-testid="search-result-card"]').first();
    await expect(firstResult).toBeVisible({ timeout: 10_000 });
    await firstResult.click();

    const replayButton = page.locator('[data-testid="replay-context-btn"]');
    await expect(replayButton).toBeVisible({ timeout: 5_000 });
    await expect(replayButton).toBeEnabled();
    await replayButton.click();
    await expect(replayButton).toBeVisible();
  });

  test("Scenario 4: Empty search results shows helpful message", async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "zxcvbnmasdfghjkl1234567890");
    const emptyMessage = page.getByText(EMPTY_STATE_TEXT);
    await expect(emptyMessage).toBeVisible({ timeout: 10_000 });
  });

  test("Scenario 5: Keyword highlight appears for multi-result seed query", async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "안녕하세요");
    const resultCards = page.locator('[data-testid="search-result-card"]');
    await expect(resultCards).toHaveCount(2);
    const highlight = page.locator('[data-testid="search-result-card"] mark');
    await expect(highlight.first()).toBeVisible({ timeout: 10_000 });
  });
});
