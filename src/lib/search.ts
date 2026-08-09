/**
 * Web search for grounding general-knowledge answers, behind a small
 * provider interface so the backend can be swapped via configuration:
 *
 *  - Wikipedia (default): keyless, reliable, good for factual questions.
 *    One API call returns titles, intro extracts, and canonical URLs.
 *  - Tavily (optional): a purpose-built LLM search API, enabled when
 *    TAVILY_API_KEY is set. Broader coverage, including current events.
 *
 * The assistant cites results in-chat via the sources card, so every
 * provider must return real, linkable URLs.
 */

const REQUEST_TIMEOUT_MS = 10_000;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export class SearchError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SearchError";
  }
}

interface SearchProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<SearchResult[]>;
}

const wikipediaProvider: SearchProvider = {
  name: "wikipedia",
  async search(query, limit) {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: query,
      gsrlimit: String(limit),
      prop: "extracts|info",
      exintro: "1",
      explaintext: "1",
      exchars: "400",
      inprop: "url",
      format: "json",
    });
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "User-Agent": "atlas-insights-demo (development-data chatbot)" },
    });
    if (!response.ok) {
      throw new SearchError(`Wikipedia API returned HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      query?: { pages?: Record<string, { title: string; extract?: string; fullurl?: string; index?: number }> };
    };
    const pages = Object.values(payload.query?.pages ?? {});
    return pages
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .filter((p) => p.fullurl)
      .map((p) => ({
        title: p.title,
        url: p.fullurl as string,
        snippet: (p.extract ?? "").trim(),
        source: "wikipedia",
      }));
  },
};

const tavilyProvider: SearchProvider = {
  name: "tavily",
  async search(query, limit) {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({ query, max_results: limit, include_answer: false }),
    });
    if (!response.ok) {
      throw new SearchError(`Tavily API returned HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      results?: { title: string; url: string; content: string }[];
    };
    return (payload.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      source: "tavily",
    }));
  },
};

export function getSearchProvider(): SearchProvider {
  return process.env.TAVILY_API_KEY ? tavilyProvider : wikipediaProvider;
}

export async function searchWeb(query: string, limit = 4): Promise<SearchResult[]> {
  const provider = getSearchProvider();
  try {
    return await provider.search(query, limit);
  } catch (cause) {
    if (cause instanceof SearchError) {
      throw cause;
    }
    throw new SearchError(`Search via ${provider.name} failed`, cause);
  }
}
