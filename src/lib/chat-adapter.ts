import { createOpenAI } from "@ai-sdk/openai";
import { OpenAIAdapter, getSdkClientOptions } from "@copilotkit/runtime";
import type { LanguageModel } from "ai";

/**
 * OpenAIAdapter variant that pins model calls to the Chat Completions API.
 *
 * CopilotKit's agent runtime resolves the model through the AI SDK's OpenAI
 * provider, which defaults to OpenAI's newer Responses API (`POST /responses`).
 * Databricks Foundation Model serving endpoints (and our deterministic mock)
 * implement the widely-adopted Chat Completions protocol instead, so we
 * override the model factory to use the `.chat()` variant explicitly.
 *
 * `getSdkClientOptions` carries the underlying client's custom fetch through
 * to the AI SDK — that fetch is what signs each request with a fresh
 * Databricks token (see lib/llm).
 */
export class ChatCompletionsAdapter extends OpenAIAdapter {
  getLanguageModel(): LanguageModel {
    const { baseURL, apiKey } = this.openai;
    const options = getSdkClientOptions(this.openai);
    return createOpenAI({
      baseURL,
      apiKey,
      headers: options.defaultHeaders,
      fetch: options.fetch,
    }).chat(this.model);
  }
}
