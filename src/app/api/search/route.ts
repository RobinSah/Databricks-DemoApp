import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSearchProvider, searchWeb, SearchError } from "@/lib/search";

/**
 * GET /api/search?q=largest+economies+in+africa
 *
 * Server-side web search proxy. Same pattern as /api/worldbank/series: a
 * single validated surface the browser calls, interceptable by Playwright
 * fixtures, with the provider choice hidden behind configuration.
 */

const querySchema = z.object({
  q: z.string().trim().min(2, "query too short").max(200, "query too long"),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  try {
    const results = await searchWeb(parsed.data.q);
    return NextResponse.json({ provider: getSearchProvider().name, results });
  } catch (error) {
    const message = error instanceof SearchError ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
