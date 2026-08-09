/** Deterministic World Bank response fixtures used to stub /api/worldbank/series. */

function series(startYear: number, values: number[]) {
  return values.map((value, i) => ({ year: startYear + i, value }));
}

export const gdpIndiaFixture = {
  series: [
    {
      countryCode: "IND",
      countryName: "India",
      indicatorId: "NY.GDP.MKTP.CD",
      indicatorLabel: "GDP (current US$)",
      points: series(2000, [
        468e9, 485e9, 515e9, 618e9, 721e9, 834e9, 949e9, 1240e9, 1220e9, 1340e9,
        1680e9, 1820e9, 1830e9, 1860e9, 2040e9, 2100e9, 2290e9, 2650e9, 2700e9, 2840e9,
        2670e9, 3150e9, 3390e9, 3550e9,
      ]),
    },
  ],
  failures: [] as { countryCode: string; reason: string }[],
};

export const lifeExpectancyComparisonFixture = {
  series: [
    {
      countryCode: "JPN",
      countryName: "Japan",
      indicatorId: "SP.DYN.LE00.IN",
      indicatorLabel: "Life expectancy at birth (years)",
      points: series(2010, [82.8, 82.6, 83.1, 83.3, 83.6, 83.8, 84.0, 84.1, 84.2, 84.4]),
    },
    {
      countryCode: "BRA",
      countryName: "Brazil",
      indicatorId: "SP.DYN.LE00.IN",
      indicatorLabel: "Life expectancy at birth (years)",
      points: series(2010, [73.1, 73.4, 73.6, 73.9, 74.2, 74.5, 74.8, 75.1, 75.3, 75.5]),
    },
  ],
  failures: [{ countryCode: "KEN", reason: "No data found for KEN" }],
};
