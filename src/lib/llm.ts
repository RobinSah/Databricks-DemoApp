import OpenAI from "openai";

import { getDatabricksHost, getDatabricksToken } from "./databricks-auth";

/**
 * LLM provider selection.
 *
 * - "databricks" (default): Databricks Foundation Model APIs via their
 *   OpenAI-compatible endpoint (`<workspace>/serving-endpoints`).
 * - "mock": a deterministic, scripted model served by this app itself at
 *   /api/mock-llm. Used by the Playwright suite so E2E tests never depend
 *   on a live model being available or non-deterministic output.
 */
export type LlmProvider = "databricks" | "mock";

export const DEFAULT_SERVING_ENDPOINT = "databricks-meta-llama-3-3-70b-instruct";

export function getLlmProvider(): LlmProvider {
  return process.env.LLM_PROVIDER === "mock" ? "mock" : "databricks";
}

export interface ChatClient {
  openai: OpenAI;
  model: string;
}

let cachedClient: ChatClient | null = null;

/**
 * Returns a process-wide chat client. The client is long-lived (the CopilotKit
 * runtime that wraps it must be a singleton — see the /api/copilotkit route),
 * so Databricks auth is injected per request via a fetch wrapper rather than
 * baked into the client: OAuth M2M tokens rotate, and lib/databricks-auth
 * caches and refreshes them.
 */
export function getChatClient(): ChatClient {
  if (cachedClient) {
    return cachedClient;
  }

  if (getLlmProvider() === "mock") {
    const port = process.env.PORT ?? "3000";
    cachedClient = {
      openai: new OpenAI({
        apiKey: "mock-key",
        baseURL: `http://127.0.0.1:${port}/api/mock-llm/v1`,
      }),
      model: "mock-model",
    };
  } else {
    cachedClient = {
      openai: new OpenAI({
        // Placeholder — every request is re-signed by fetchWithDatabricksAuth.
        apiKey: "databricks-token-injected-per-request",
        baseURL: `${getDatabricksHost()}/serving-endpoints`,
        fetch: fetchWithDatabricksAuth,
      }),
      model: process.env.DATABRICKS_SERVING_ENDPOINT ?? DEFAULT_SERVING_ENDPOINT,
    };
  }
  return cachedClient;
}

async function fetchWithDatabricksAuth(
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = await getDatabricksToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
