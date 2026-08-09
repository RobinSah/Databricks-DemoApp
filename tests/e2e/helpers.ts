import { expect, type Page } from "@playwright/test";

/** Wait until CopilotKit finishes agent discovery; earlier sends are dropped. */
export async function waitForChatReady(page: Page): Promise<void> {
  await page.locator('[data-copilot-ready="true"]').waitFor({ timeout: 15_000 });
}

export async function sendMessage(page: Page, text: string): Promise<void> {
  const input = page.getByTestId("chat-input");
  await input.click();
  // Type like a user rather than fill(): the input commits through React
  // state, and Enter-to-send checks composition state.
  await input.pressSequentially(text);
  const send = page.getByTestId("send-button");
  await expect(send).toBeEnabled();
  await send.click();
}
