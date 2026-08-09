"use client";

import { useCopilotAction } from "@copilotkit/react-core";

import { SEARCH_WEB_ACTION } from "@/lib/chat-contract";
import type { SearchResult } from "@/lib/search";

import { SourcesCard, SourcesError, SourcesLoading } from "./sources-card";

type ActionResult = { query: string; results: SearchResult[] } | { error: string };

/**
 * Frontend action for grounding answers in web search. Mirrors the chart
 * action's shape: handler fetches through our validated /api/search route
 * (interceptable by Playwright), render shows a citations card in-chat, and
 * failures return as values so the model can explain them.
 */
export function SearchWebAction() {
  useCopilotAction({
    name: SEARCH_WEB_ACTION,
    description:
      "Search the web for factual or contextual questions that World Bank indicators " +
      "don't cover. Returns titled sources with snippets and URLs; cite them in your answer.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "A focused search query, e.g. 'largest economies in Africa'",
        required: true,
      },
    ],
    handler: async ({ query }): Promise<ActionResult> => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const payload = await response.json();
        if (!response.ok) {
          return { error: payload.error ?? `Request failed (HTTP ${response.status})` };
        }
        return { query, results: payload.results as SearchResult[] };
      } catch {
        return { error: "Network error while searching" };
      }
    },
    render: ({ status, result }) => {
      if (status !== "complete") {
        return <SourcesLoading />;
      }
      const outcome = result as ActionResult | undefined;
      if (!outcome || "error" in outcome) {
        return <SourcesError message={outcome?.error ?? "Unknown error"} />;
      }
      if (outcome.results.length === 0) {
        return <SourcesError message="No results found" />;
      }
      return <SourcesCard query={outcome.query} results={outcome.results} />;
    },
  });

  return null;
}
