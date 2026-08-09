import { expect, test, type Page } from "@playwright/test";

import { gdpIndiaFixture, lifeExpectancyComparisonFixture } from "./fixtures/gdp-india";

/**
 * Conversation flows against the deterministic mock LLM (LLM_PROVIDER=mock on
 * the server). World Bank data calls are intercepted per-test, so these tests
 * exercise the full stack — CopilotKit runtime, tool-call loop, chart
 * rendering — with zero external dependencies.
 */

const SERIES_ROUTE = "**/api/worldbank/series*";

async function sendMessage(page: Page, text: string) {
  const input = page.getByRole("textbox");
  await input.click();
  // CopilotKit's chat input tracks composition state internally and ignores
  // programmatic value injection, so type like a user instead of fill().
  await input.pressSequentially(text);
  // The Send button enables once the input state commits; waiting on it
  // avoids racing Enter against React's state update.
  const send = page.getByRole("button", { name: "Send" });
  await expect(send).toBeEnabled();
  await send.click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Sends issued before CopilotKit finishes agent discovery are dropped;
  // the app exposes readiness via this attribute (see ChatSurface).
  await page.locator('[data-copilot-ready="true"]').waitFor({ timeout: 15_000 });
});

test("streams a text reply for a general question", async ({ page }) => {
  await sendMessage(page, "Hello there!");

  await expect(page.getByText("Hello there!")).toBeVisible();
  await expect(page.getByText(/running in mock mode/)).toBeVisible({ timeout: 15_000 });
});

test("fetches data and renders a chart for an indicator question", async ({ page }) => {
  await page.route(SERIES_ROUTE, (route) =>
    route.fulfill({ json: gdpIndiaFixture }),
  );

  await sendMessage(page, "Show me GDP of India from 2000 to 2023");

  const chart = page.getByTestId("indicator-chart");
  await expect(chart).toBeVisible({ timeout: 20_000 });
  await expect(chart.getByText("GDP (current US$)")).toBeVisible();
  await expect(chart.getByText(/India/)).toBeVisible();
  await expect(chart.getByText(/World Bank Open Data/)).toBeVisible();
  // The model's post-chart summary closes the tool-call loop.
  await expect(page.getByText(/mock summary/)).toBeVisible({ timeout: 15_000 });
});

test("notes countries that returned no data", async ({ page }) => {
  await page.route(SERIES_ROUTE, (route) =>
    route.fulfill({ json: lifeExpectancyComparisonFixture }),
  );

  await sendMessage(page, "Compare life expectancy in Japan, Brazil and Kenya");

  const chart = page.getByTestId("indicator-chart");
  await expect(chart).toBeVisible({ timeout: 20_000 });
  await expect(chart.getByText(/Japan, Brazil/)).toBeVisible();
  await expect(page.getByTestId("chart-failures")).toContainText("KEN");
});

test("shows an error card when the data API fails", async ({ page }) => {
  await page.route(SERIES_ROUTE, (route) =>
    route.fulfill({ status: 502, json: { error: "World Bank API is unreachable" } }),
  );

  await sendMessage(page, "Show me GDP of India");

  const error = page.getByTestId("chart-error");
  await expect(error).toBeVisible({ timeout: 20_000 });
  await expect(error).toContainText(/World Bank API is unreachable/);
});
