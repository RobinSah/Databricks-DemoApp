import { findIndicator } from "./indicators";

/**
 * Thin, typed client for the World Bank Open Data API (v2).
 * Docs: https://datahelpdesk.worldbank.org/knowledgebase/topics/125589
 *
 * The API is public and unauthenticated. Responses are JSON tuples of
 * [pagination metadata, rows]. Values may be null for years without data.
 */

const API_BASE = "https://api.worldbank.org/v2";
const REQUEST_TIMEOUT_MS = 10_000;

export class WorldBankError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WorldBankError";
  }
}

export interface SeriesPoint {
  year: number;
  value: number;
}

export interface IndicatorSeries {
  countryCode: string;
  countryName: string;
  indicatorId: string;
  indicatorLabel: string;
  points: SeriesPoint[];
}

interface RawIndicatorRow {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
}

async function fetchJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // Indicator data updates at most a few times a year; cache generously.
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch (cause) {
    throw new WorldBankError("World Bank API is unreachable", cause);
  }
  if (!response.ok) {
    throw new WorldBankError(`World Bank API returned HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch a yearly time series for one indicator in one country.
 *
 * @param countryCode ISO alpha-2 or alpha-3 country code (e.g. "IN", "IND").
 * @param indicatorId World Bank indicator code (e.g. "SP.POP.TOTL").
 * @param startYear   First year of the range, inclusive.
 * @param endYear     Last year of the range, inclusive.
 */
export async function fetchIndicatorSeries(
  countryCode: string,
  indicatorId: string,
  startYear: number,
  endYear: number,
): Promise<IndicatorSeries> {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(code)) {
    throw new WorldBankError(`"${countryCode}" is not an ISO country code`);
  }

  const url =
    `${API_BASE}/country/${code}/indicator/${encodeURIComponent(indicatorId)}` +
    `?format=json&per_page=200&date=${startYear}:${endYear}`;
  const payload = await fetchJson(url);

  if (!Array.isArray(payload)) {
    throw new WorldBankError("Unexpected response shape from World Bank API");
  }
  // Errors (e.g. unknown country) come back as [ { message: [...] } ].
  if (payload.length < 2 || payload[1] === null) {
    const message = extractApiErrorMessage(payload[0]);
    throw new WorldBankError(message ?? `No data found for ${code} / ${indicatorId}`);
  }

  const rows = payload[1] as RawIndicatorRow[];
  const points: SeriesPoint[] = rows
    .filter((row): row is RawIndicatorRow & { value: number } => row.value !== null)
    .map((row) => ({ year: Number(row.date), value: row.value }))
    .filter((p) => Number.isFinite(p.year))
    .sort((a, b) => a.year - b.year);

  const first = rows[0];
  return {
    countryCode: first?.countryiso3code || code,
    countryName: first?.country?.value ?? code,
    indicatorId,
    indicatorLabel: findIndicator(indicatorId)?.label ?? first?.indicator?.value ?? indicatorId,
    points,
  };
}

/**
 * Fetch the same indicator for several countries in parallel. Countries that
 * fail (unknown code, no data) are reported by name rather than failing the
 * whole request, so the assistant can explain partial results.
 */
export async function fetchMultiCountrySeries(
  countryCodes: string[],
  indicatorId: string,
  startYear: number,
  endYear: number,
): Promise<{ series: IndicatorSeries[]; failures: { countryCode: string; reason: string }[] }> {
  const results = await Promise.allSettled(
    countryCodes.map((c) => fetchIndicatorSeries(c, indicatorId, startYear, endYear)),
  );
  const series: IndicatorSeries[] = [];
  const failures: { countryCode: string; reason: string }[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      series.push(result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : "unknown error";
      failures.push({ countryCode: countryCodes[i], reason });
    }
  });
  return { series, failures };
}

function extractApiErrorMessage(meta: unknown): string | undefined {
  if (
    typeof meta === "object" &&
    meta !== null &&
    "message" in meta &&
    Array.isArray((meta as { message: unknown }).message)
  ) {
    const first = (meta as { message: { value?: string }[] }).message[0];
    return first?.value;
  }
  return undefined;
}
