import { expect, test } from "@playwright/test";

import { worldBankSearchFixture } from "./fixtures/search-results";
import { sendMessage, waitForChatReady } from "./helpers";

/**
 * Web-search tool flow: model calls searchWeb → /api/search (intercepted
 * here) → sources card renders in-chat → model cites the results.
 */

const SEARCH_ROUTE = "**/api/search*";

test.skip(
  !!process.env.E2E_BASE_URL,
  "search flows require the mock LLM; not applicable to live deployments",
);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForChatReady(page);
});

test("renders cited sources for a web search question", async ({ page }) => {
  await page.route(SEARCH_ROUTE, (route) => route.fulfill({ json: worldBankSearchFixture }));

  await sendMessage(page, "Search the web for the World Bank");

  const card = page.getByTestId("sources-card");
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText("Searched the web");
  await expect(card.getByRole("link", { name: /World Bank Group/ })).toHaveAttribute(
    "href",
    "https://en.wikipedia.org/wiki/World_Bank_Group",
  );
  // The model's follow-up cites the sources, closing the tool-call loop.
  await expect(page.getByText(/According to the sources/)).toBeVisible({ timeout: 15_000 });
});

test("shows an error card when search fails", async ({ page }) => {
  await page.route(SEARCH_ROUTE, (route) =>
    route.fulfill({ status: 502, json: { error: "Search via wikipedia failed" } }),
  );

  await sendMessage(page, "Search the web for anything at all");

  const error = page.getByTestId("sources-error");
  await expect(error).toBeVisible({ timeout: 20_000 });
  await expect(error).toContainText(/Search via wikipedia failed/);
});

test("shows stop button while streaming, send button when idle", async ({ page }) => {
  await sendMessage(page, "Hello there!");

  // While the mock streams (throttled via MOCK_STREAM_DELAY_MS), the input
  // swaps its send button for a stop button.
  await expect(page.getByTestId("stop-button")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("send-button")).toHaveCount(0);

  await expect(page.getByText(/running in mock mode/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("send-button")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("stop-button")).toHaveCount(0);
});
