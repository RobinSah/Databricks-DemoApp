import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration.
 *
 * Default mode builds the production bundle and serves it with the
 * deterministic mock LLM (LLM_PROVIDER=mock), so the suite is fast, free,
 * and independent of a live model. World Bank responses are intercepted
 * per-test with fixtures, so no external network is required either.
 *
 * Set E2E_BASE_URL to point the same suite at an already-running server —
 * including the deployed Databricks App.
 */

const PORT = 3100;
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // CopilotKit renders messages only once the run stream opens, which on a
  // cold server under parallel load can exceed the 5s default.
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: externalBaseUrl ?? `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Databricks Apps URLs are SSO-gated; supply an OAuth token for
    // programmatic runs: E2E_BEARER_TOKEN=$(databricks auth token | jq -r .access_token)
    ...(process.env.E2E_BEARER_TOKEN
      ? { extraHTTPHeaders: { Authorization: `Bearer ${process.env.E2E_BEARER_TOKEN}` } }
      : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: `http://127.0.0.1:${PORT}/api/health`,
        env: { LLM_PROVIDER: "mock", PORT: String(PORT) },
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
