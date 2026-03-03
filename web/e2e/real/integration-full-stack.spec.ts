import { expect, test, type Page } from "@playwright/test";

/**
 * Full Stack Integration Test
 *
 * Prerequisites:
 * - Local Supabase running with real data from 세바시 강연 channel
 * - CLI pipeline has loaded at least 1 video with manual Korean CC
 * - web/.env.local configured with local Supabase URLs
 */
test.describe("Full Stack Integration — 세바시 강연 Real Data", () => {
  const emptyState = "even native speakers rarely use";

  async function searchKeyword(page: Page, keyword: string) {
    const searchBar = page.locator('input[type="search"]');
    await searchBar.fill(keyword);
    await searchBar.press("Enter");
  }

  async function waitForSearchResolution(page: Page): Promise<"results" | "empty"> {
    const resultCards = page.locator('[data-testid="search-result-card"]');
    const emptyStateMessage = page.getByText(emptyState);

    await expect
      .poll(
        async () => {
          const count = await resultCards.count();
          if (count > 0) {
            return "results";
          }
          const isEmptyVisible = await emptyStateMessage
            .isVisible()
            .then((visible) => visible)
            .catch(() => false);
          return isEmptyVisible ? "empty" : "pending";
        },
        {
          timeout: 15_000,
        },
      )
      .not.toBe("pending");

    const finalCount = await resultCards.count();
    return finalCount > 0 ? "results" : "empty";
  }

  test('Search "행복" → real results from 세바시 강연 appear', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "행복");

    const resultCards = page.locator('[data-testid="search-result-card"]');
    await expect(resultCards.first()).toBeVisible({ timeout: 15_000 });

    const count = await resultCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const firstText = await resultCards.first().textContent();
    expect(firstText).toContain("행복");

    const mark = resultCards.first().locator("mark");
    await expect(mark).toBeVisible();
  });

  test('Search "인생" → results appear and player panel loads', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "인생");

    const firstResult = page.locator('[data-testid="search-result-card"]').first();
    await expect(firstResult).toBeVisible({ timeout: 15_000 });
    await firstResult.click();

    const playerContainer = page.locator("#yt-player-container");
    await expect(playerContainer).toBeVisible({ timeout: 5_000 });

    const chunkViewer = page.locator('[data-testid="chunk-viewer"]');
    await expect(chunkViewer).toBeVisible();
  });

  test('Search "사랑합니다" → results appear or empty state shows', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "사랑합니다");
    const state = await waitForSearchResolution(page);

    const resultCards = page.locator('[data-testid="search-result-card"]');
    if (state === "results") {
      const firstText = await resultCards.first().textContent();
      expect(firstText).toContain("사랑");
    } else {
      const emptyMsg = page.getByText(emptyState);
      await expect(emptyMsg).toBeVisible();
    }
  });

  test('Search "어쩔티비" → empty state shows for slang not in lectures', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "어쩔티비");
    const state = await waitForSearchResolution(page);

    const resultCards = page.locator('[data-testid="search-result-card"]');
    expect(state).toBe("empty");
    await expect(resultCards).toHaveCount(0);

    const emptyMsg = page.getByText(emptyState);
    await expect(emptyMsg).toBeVisible();
  });

  test('Search "대한민국" → compound word search works', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "대한민국");
    const state = await waitForSearchResolution(page);

    const resultCards = page.locator('[data-testid="search-result-card"]');
    if (state === "results") {
      const firstText = await resultCards.first().textContent();
      expect(firstText).toContain("대한민국");
    } else {
      const emptyMsg = page.getByText(emptyState);
      await expect(emptyMsg).toBeVisible();
    }
  });

  test("Replay context with real video data", async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "행복");

    const firstResult = page.locator('[data-testid="search-result-card"]').first();
    await expect(firstResult).toBeVisible({ timeout: 15_000 });
    await firstResult.click();

    const playerContainer = page.locator("#yt-player-container");
    await expect(playerContainer).toBeVisible({ timeout: 5_000 });

    const replayBtn = page.locator('[data-testid="replay-context-btn"]');
    await expect(replayBtn).toBeVisible();
    await expect(replayBtn).toBeEnabled();
    await replayBtn.click();
    await expect(replayBtn).toBeVisible();
    await expect(playerContainer).toBeVisible();
  });
});
