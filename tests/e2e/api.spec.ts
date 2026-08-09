import { expect, test } from "@playwright/test";

/**
 * Contract tests for /api/worldbank/series input validation. These never
 * reach the external World Bank API — invalid input is rejected first.
 */

test.describe("/api/worldbank/series validation", () => {
  test("rejects missing parameters", async ({ request }) => {
    const response = await request.get("/api/worldbank/series");
    expect(response.status()).toBe(400);
  });

  test("rejects unknown indicators", async ({ request }) => {
    const response = await request.get(
      "/api/worldbank/series?countries=IND&indicator=NOT.A.REAL.ONE&start=2000&end=2020",
    );
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(JSON.stringify(body.details)).toContain("Unknown indicator");
  });

  test("rejects malformed country codes", async ({ request }) => {
    const response = await request.get(
      "/api/worldbank/series?countries=IN;DROP&indicator=SP.POP.TOTL&start=2000&end=2020",
    );
    expect(response.status()).toBe(400);
  });

  test("rejects inverted year ranges", async ({ request }) => {
    const response = await request.get(
      "/api/worldbank/series?countries=IND&indicator=SP.POP.TOTL&start=2020&end=2000",
    );
    expect(response.status()).toBe(400);
  });

  test("rejects more than 6 countries", async ({ request }) => {
    const response = await request.get(
      "/api/worldbank/series?countries=IND,USA,JPN,CHN,BRA,DEU,KEN&indicator=SP.POP.TOTL&start=2000&end=2020",
    );
    expect(response.status()).toBe(400);
  });
});

/**
 * Live smoke test against the real World Bank API. Off by default so the
 * suite stays hermetic; enable with E2E_LIVE_DATA=1 (used before releases
 * and against the deployed app).
 */
test.describe("live World Bank integration", () => {
  test.skip(!process.env.E2E_LIVE_DATA, "set E2E_LIVE_DATA=1 to run");

  test("returns real population data for India", async ({ request }) => {
    const response = await request.get(
      "/api/worldbank/series?countries=IND&indicator=SP.POP.TOTL&start=2015&end=2023",
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.series).toHaveLength(1);
    expect(body.series[0].countryName).toBe("India");
    expect(body.series[0].points.length).toBeGreaterThan(5);
    // India's population is in the billions; sanity-check magnitude.
    const latest = body.series[0].points.at(-1);
    expect(latest.value).toBeGreaterThan(1_000_000_000);
  });
});
