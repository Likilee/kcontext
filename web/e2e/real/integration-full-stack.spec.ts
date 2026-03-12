import { expect, test, type Page } from "@playwright/test";

/**
 * Full Stack Integration Test
 *
 * Prerequisites:
 * - Isolated E2E Supabase stack is running
 * - CLI integration script has loaded fixture raw JSON via build -> push
 * - web/.env.local configured with local Supabase URLs
 */
test.describe("Full Stack Integration — fixture-backed CLI data", () => {
  const emptyState = "even native speakers rarely use";
  const resultReadySelector = '[data-testid="replay-context-btn"]';

  async function searchKeyword(page: Page, keyword: string) {
    const searchBar = page.locator('input[type="search"]').first();
    await searchBar.fill(keyword);
    await searchBar.press("Enter");
  }

  async function waitForSearchResolution(page: Page): Promise<"results" | "empty"> {
    const resultReady = page.locator(resultReadySelector);
    const emptyStateMessage = page.getByText(emptyState);

    await expect
      .poll(
        async () => {
          const hasResult = await resultReady
            .isVisible()
            .then((visible) => visible)
            .catch(() => false);
          if (hasResult) {
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

    const finalResultVisible = await resultReady
      .isVisible()
      .then((visible) => visible)
      .catch(() => false);

    return finalResultVisible ? "results" : "empty";
  }

  test('Search "떡볶이" → fixture-backed results appear', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "떡볶이");

    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(page.locator(resultReadySelector)).toBeVisible({ timeout: 20_000 });
  });

  test('Search "전분당" → player panel loads', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "전분당");

    const playerContainer = page.locator("#yt-player-container");
    await expect(playerContainer).toBeVisible({ timeout: 15_000 });

    const chunkViewer = page.locator('[data-testid="chunk-viewer"]');
    await expect(chunkViewer).toBeVisible();
  });

  test('Search "죽마고우" → results appear', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "죽마고우");
    await expect(page.locator(resultReadySelector)).toBeVisible({ timeout: 20_000 });
  });

  test('Search "어쩔티비" → empty state shows for keyword missing from fixtures', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "어쩔티비");
    const state = await waitForSearchResolution(page);

    expect(state).toBe("empty");
    const emptyMsg = page.getByText(emptyState);
    await expect(emptyMsg).toBeVisible();
  });

  test('Search "과징금" → news keyword search works', async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "과징금");
    await expect(page.locator(resultReadySelector)).toBeVisible({ timeout: 20_000 });
  });

  test("Replay context with real video data", async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "떡볶이");

    const replayBtn = page.locator('[data-testid="replay-context-btn"]');
    await expect(replayBtn).toBeVisible({ timeout: 15_000 });
    await expect(replayBtn).toBeEnabled();
    await replayBtn.click();

    const playerContainer = page.locator("#yt-player-container");
    await expect(playerContainer).toBeVisible();
  });
});
