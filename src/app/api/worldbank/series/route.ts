import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { findIndicator } from "@/lib/indicators";
import { fetchMultiCountrySeries, WorldBankError } from "@/lib/worldbank";

/**
 * GET /api/worldbank/series?countries=IND,USA&indicator=SP.POP.TOTL&start=2000&end=2023
 *
 * Server-side proxy to the World Bank API. Routing the browser's data fetches
 * through here gives us response caching, a single validated API surface, and
 * a clean interception point for Playwright fixtures.
 */

const CURRENT_YEAR = new Date().getFullYear();

const querySchema = z
  .object({
    countries: z
      .string()
      .transform((v) => v.split(",").map((c) => c.trim()).filter(Boolean))
      .pipe(z.array(z.string().regex(/^[A-Za-z]{2,3}$/, "ISO alpha-2/3 code expected")).min(1).max(6)),
    indicator: z.string().refine((id) => findIndicator(id) !== undefined, {
      message: "Unknown indicator; see src/lib/indicators.ts for the supported catalog",
    }),
    start: z.coerce.number().int().min(1960).max(CURRENT_YEAR),
    end: z.coerce.number().int().min(1960).max(CURRENT_YEAR),
  })
  .refine((q) => q.start <= q.end, { message: "start must be <= end" });

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { countries, indicator, start, end } = parsed.data;
  try {
    const result = await fetchMultiCountrySeries(countries, indicator, start, end);
    if (result.series.length === 0) {
      return NextResponse.json(
        { error: "No data available", failures: result.failures },
        { status: 404 },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof WorldBankError ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
