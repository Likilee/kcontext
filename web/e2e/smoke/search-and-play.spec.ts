import { expect, test, type Page } from "@playwright/test";

const EMPTY_STATE_TEXT = "even native speakers rarely use";

async function searchKeyword(page: Page, keyword: string) {
  const searchBar = page.locator('input[type="search"]').first();
  await expect(searchBar).toBeVisible();
  await searchBar.fill(keyword);
  await searchBar.press("Enter");
}

async function waitForSearchState(page: Page): Promise<"results" | "empty"> {
  const chunkViewer = page.locator('[data-testid="chunk-viewer"]');
  const empty = page.getByText(EMPTY_STATE_TEXT).first();

  await expect
    .poll(
      async () => {
        const hasChunkViewer = await chunkViewer
          .isVisible()
          .then((visible) => visible)
          .catch(() => false);
        if (hasChunkViewer) {
          return "results";
        }

        const hasEmpty = await empty
          .isVisible()
          .then((visible) => visible)
          .catch(() => false);
        return hasEmpty ? "empty" : "pending";
      },
      { timeout: 20_000 },
    )
    .not.toBe("pending");

  const hasChunkViewer = await chunkViewer
    .isVisible()
    .then((visible) => visible)
    .catch(() => false);

  return hasChunkViewer ? "results" : "empty";
}

test.describe("kcontext User Scenarios", () => {
  test("Scenario 1: Home search routes to /search?q=", async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "김치찌개");

    await expect(page).toHaveURL(/\/search\?q=/);
  });

  test("Scenario 2: Search page resolves into player or empty state", async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "행복해요");

    const state = await waitForSearchState(page);

    if (state === "results") {
      const playerContainer = page.locator("#yt-player-container");
      await expect(playerContainer).toBeVisible({ timeout: 15_000 });

      const chunkViewer = page.locator('[data-testid="chunk-viewer"]');
      await expect(chunkViewer).toBeVisible();
    } else {
      await expect(page.getByText(EMPTY_STATE_TEXT).first()).toBeVisible();
    }
  });

  test("Scenario 3: Replay button works when results exist", async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "행복해요");

    const state = await waitForSearchState(page);

    if (state === "results") {
      const replayButton = page.locator('[data-testid="replay-context-btn"]');
      await expect(replayButton).toBeVisible({ timeout: 15_000 });
      await expect(replayButton).toBeEnabled();
      await replayButton.click();
      await expect(replayButton).toBeVisible();
    } else {
      await expect(page.getByText(EMPTY_STATE_TEXT).first()).toBeVisible();
    }
  });

  test("Scenario 4: Empty search results shows helpful message", async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "zxcvbnmasdfghjkl1234567890");
    const emptyMessage = page.getByText(EMPTY_STATE_TEXT);
    await expect(emptyMessage).toBeVisible({ timeout: 20_000 });
  });

  test("Scenario 5: Search shows navigation summary or empty state", async ({ page }) => {
    await page.goto("/");
    await searchKeyword(page, "안녕하세요");

    const state = await waitForSearchState(page);
    if (state === "results") {
      await expect(page.locator('[data-testid="chunk-viewer"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('"안녕하세요"').first()).toBeVisible();
    } else {
      await expect(page.getByText(EMPTY_STATE_TEXT).first()).toBeVisible();
    }
  });
});
