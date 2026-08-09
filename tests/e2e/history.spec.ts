import { expect, test } from "@playwright/test";

import { sendMessage, waitForChatReady } from "./helpers";

/**
 * Conversation-history management: persistence across reloads, switching,
 * and deletion. Conversations are stored client-side (localStorage), so each
 * test starts from a clean browser context (Playwright default).
 *
 * Runs against the mock LLM; see chat.spec.ts for why these skip on live.
 */

test.skip(
  !!process.env.E2E_BASE_URL,
  "history flows require the mock LLM; not applicable to live deployments",
);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForChatReady(page);
});

test("persists a conversation across a full page reload", async ({ page }) => {
  await sendMessage(page, "Hello there!");
  await expect(page.getByText(/running in mock mode/)).toBeVisible({ timeout: 15_000 });

  // The conversation appears in the sidebar, titled from the first message.
  const item = page.getByTestId("conversation-item");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("Hello there!");

  // Saves land when the run settles; reloading mid-stream would (by design)
  // drop the in-flight assistant reply. Wait for the idle input state and
  // the completed exchange to reach localStorage before reloading.
  await expect(page.getByTestId("send-button")).toBeVisible({ timeout: 10_000 });
  await page.waitForFunction(() => {
    const stored = JSON.parse(window.localStorage.getItem("atlas.conversations.v1") ?? "[]");
    return stored[0]?.messages?.length >= 2;
  });

  await page.reload();
  await waitForChatReady(page);

  // Both the transcript and the sidebar entry survive the reload.
  await expect(page.getByText(/running in mock mode/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("conversation-item")).toContainText("Hello there!");
});

test("switches between conversations from the sidebar", async ({ page }) => {
  // Transcript-scoped locators: message text also appears as sidebar titles.
  const userMessages = page.getByTestId("user-message");

  await sendMessage(page, "Hello there!");
  await expect(page.getByText(/running in mock mode/)).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("new-chat").click();
  await expect(userMessages.filter({ hasText: "Hello there!" })).toHaveCount(0);

  await sendMessage(page, "Good morning friend");
  await expect(page.getByText(/running in mock mode/)).toBeVisible({ timeout: 15_000 });

  const items = page.getByTestId("conversation-item");
  await expect(items).toHaveCount(2);

  // Open the first conversation again; its transcript replaces the current one.
  await items.filter({ hasText: "Hello there!" }).click();
  await expect(userMessages.filter({ hasText: "Hello there!" })).toBeVisible();
  await expect(userMessages.filter({ hasText: "Good morning friend" })).toHaveCount(0);
  await expect(items.filter({ hasText: "Hello there!" })).toHaveAttribute("data-active", "true");
});

test("deletes a conversation after confirmation", async ({ page }) => {
  await sendMessage(page, "Hello there!");
  await expect(page.getByText(/running in mock mode/)).toBeVisible({ timeout: 15_000 });

  const item = page.getByTestId("conversation-item");
  await expect(item).toHaveCount(1);

  await item.hover();
  await page.getByTestId("delete-conversation").click();
  // Deletion is destructive, so it must be confirmed explicitly.
  await page.getByTestId("confirm-delete").click();

  await expect(page.getByTestId("conversation-item")).toHaveCount(0);
  await expect(page.getByText("No conversations yet")).toBeVisible();
  // The active transcript clears too, since the deleted chat was open.
  await expect(page.getByTestId("user-message").filter({ hasText: "Hello there!" })).toHaveCount(0);
});
