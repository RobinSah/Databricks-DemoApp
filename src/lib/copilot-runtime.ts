import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";

import { ChatCompletionsAdapter } from "./chat-adapter";
import { getChatClient } from "./llm";

/**
 * Process-wide CopilotKit runtime endpoint.
 *
 * Two hard-won constraints, both discovered via the E2E suite:
 *
 * 1. Singleton, not per-request: the client's agent/connect and agent/run
 *    arrive as separate HTTP requests and share runtime state; per-request
 *    runtimes drop that state and sends are silently swallowed.
 *
 * 2. Warmed before first contact: on a cold server the page fires several
 *    simultaneous agent/connect calls that can race the runtime's first
 *    construction; if they lose, the CopilotKit client marks the agent
 *    unavailable and never retries. /api/health calls warmCopilotRuntime()
 *    so load balancer probes (Playwright's web server wait, Databricks Apps
 *    health checks) initialize the runtime before any user reaches it.
 *
 * Construction stays lazy so importing this module at build time works
 * without Databricks env vars. Token rotation is handled by the chat
 * client's fetch wrapper (see lib/llm), so a long-lived adapter is safe.
 */
export type CopilotEndpoint = ReturnType<typeof copilotRuntimeNextJSAppRouterEndpoint>;

let endpoint: CopilotEndpoint | null = null;

export function getCopilotEndpoint(): CopilotEndpoint {
  if (!endpoint) {
    const { openai, model } = getChatClient();
    const serviceAdapter = new ChatCompletionsAdapter({
      openai,
      model,
      // Databricks/Llama endpoints expect the standard "system" role, not
      // OpenAI's newer "developer" role.
      keepSystemRole: true,
      // Sequential tool calls keep the render-then-summarize flow predictable.
      disableParallelToolCalls: true,
    });

    endpoint = copilotRuntimeNextJSAppRouterEndpoint({
      runtime: new CopilotRuntime(),
      serviceAdapter,
      endpoint: "/api/copilotkit",
    });
  }
  return endpoint;
}

/** Best-effort warm-up; returns whether the runtime is initialized. */
export function warmCopilotRuntime(): boolean {
  try {
    getCopilotEndpoint();
    return true;
  } catch {
    // Typically missing Databricks env vars; the chat route will surface
    // the real error when actually used.
    return false;
  }
}
