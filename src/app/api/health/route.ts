import { NextResponse } from "next/server";

import { warmCopilotRuntime } from "@/lib/copilot-runtime";
import { getLlmProvider } from "@/lib/llm";

/**
 * Liveness probe used by Databricks Apps and the Playwright web server wait.
 * Also warms the CopilotKit runtime so the first real visitor never races
 * its initialization (see lib/copilot-runtime).
 */
export async function GET(): Promise<NextResponse> {
  const runtimeReady = warmCopilotRuntime();
  return NextResponse.json({
    status: "ok",
    provider: getLlmProvider(),
    runtimeReady,
    timestamp: new Date().toISOString(),
  });
}
