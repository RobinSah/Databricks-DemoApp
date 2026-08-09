import type { NextRequest } from "next/server";

import { getCopilotEndpoint } from "@/lib/copilot-runtime";

/**
 * CopilotKit runtime endpoint. The service adapter speaks the OpenAI
 * chat-completions protocol, which Databricks Foundation Model serving
 * endpoints implement natively — so the same adapter drives either the real
 * model or the in-app mock, chosen by LLM_PROVIDER. See lib/copilot-runtime
 * for the singleton/warm-up constraints.
 */
export async function POST(request: NextRequest): Promise<Response> {
  return getCopilotEndpoint().handleRequest(request);
}
