import { expect, test } from "@playwright/test";

test.describe("app shell", () => {
  test("health endpoint reports ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("renders the chat shell", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Atlas/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Atlas" })).toBeVisible();
    await expect(page.getByRole("textbox")).toBeVisible();
    // Welcome message with example prompts.
    await expect(page.getByText(/chart global development data/i)).toBeVisible();
  });
});
