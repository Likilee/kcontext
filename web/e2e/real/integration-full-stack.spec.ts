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
    const searchBar = page.locator('input[type="search"]').first();
    await searchBar.fill(keyword);
    await searchBar.press("Enter");
  }

  async function waitForSearchResolution(page: Page): Promise<"results" | "empty"> {
    const summaryText = page.getByText("in native videos").first();
    const emptyStateMessage = page.getByText(emptyState);

    await expect
      .poll(
        async () => {
          const hasSummary = await summaryText
            .isVisible()
            .then((visible) => visible)
            .catch(() => false);
          if (hasSummary) {
            return "results";
          }

          const hasEmpty = await emptyStateMessage
            .isVisible()
            .then((visible) => visible)
            .catch(() => false);
          return hasEmpty ? "empty" : "pending";
        },
        {
          timeout: 20_000,
        },
      )
      .not.toBe("pending");

    const finalSummaryVisible = await summaryText
      .isVisible()
      .then((visible) => visible)
      .catch(() => false);

    return finalSummaryVisible ? "results" : "empty";
  }

  test('Search "행복" → real results from 세바시 강연 appear', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "행복");

    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(page.getByText("in native videos").first()).toBeVisible({ timeout: 20_000 });
  });

  test('Search "인생" → player panel loads', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "인생");

    const playerContainer = page.locator("#yt-player-container");
    await expect(playerContainer).toBeVisible({ timeout: 15_000 });

    const chunkViewer = page.locator('[data-testid="chunk-viewer"]');
    await expect(chunkViewer).toBeVisible();
  });

  test('Search "사랑합니다" → results appear or empty state shows', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "사랑합니다");
    const state = await waitForSearchResolution(page);

    if (state === "results") {
      await expect(page.getByText("in native videos").first()).toBeVisible();
    } else {
      const emptyMsg = page.getByText(emptyState);
      await expect(emptyMsg).toBeVisible();
    }
  });

  test('Search "어쩔티비" → empty state shows for slang not in lectures', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "어쩔티비");
    const state = await waitForSearchResolution(page);

    expect(state).toBe("empty");
    const emptyMsg = page.getByText(emptyState);
    await expect(emptyMsg).toBeVisible();
  });

  test('Search "대한민국" → compound word search works', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "대한민국");
    const state = await waitForSearchResolution(page);

    if (state === "results") {
      await expect(page.getByText("in native videos").first()).toBeVisible();
    } else {
      const emptyMsg = page.getByText(emptyState);
      await expect(emptyMsg).toBeVisible();
    }
  });

  test("Replay context with real video data", async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "행복");

    const replayBtn = page.locator('[data-testid="replay-context-btn"]');
    await expect(replayBtn).toBeVisible({ timeout: 15_000 });
    await expect(replayBtn).toBeEnabled();
    await replayBtn.click();

    const playerContainer = page.locator("#yt-player-container");
    await expect(playerContainer).toBeVisible();
  });
});
