/**
 * Curated catalog of World Bank development indicators exposed to the
 * assistant. Keeping this list explicit (rather than letting the model
 * invent indicator codes) makes tool calls predictable and testable.
 */

export interface IndicatorDefinition {
  /** World Bank indicator code, e.g. "NY.GDP.MKTP.CD". */
  id: string;
  /** Human-readable label shown in chart titles and cards. */
  label: string;
  /** Unit hint used for axis formatting. */
  unit: "usd" | "usd-per-capita" | "people" | "years" | "percent" | "tonnes-per-capita";
  description: string;
}

export const INDICATORS: readonly IndicatorDefinition[] = [
  {
    id: "NY.GDP.MKTP.CD",
    label: "GDP (current US$)",
    unit: "usd",
    description: "Gross domestic product at purchaser's prices, in current US dollars.",
  },
  {
    id: "NY.GDP.PCAP.CD",
    label: "GDP per capita (current US$)",
    unit: "usd-per-capita",
    description: "Gross domestic product divided by midyear population.",
  },
  {
    id: "SP.POP.TOTL",
    label: "Population, total",
    unit: "people",
    description: "Total population based on the de facto definition.",
  },
  {
    id: "SP.DYN.LE00.IN",
    label: "Life expectancy at birth (years)",
    unit: "years",
    description: "Years a newborn would live if current mortality patterns persist.",
  },
  {
    id: "FP.CPI.TOTL.ZG",
    label: "Inflation, consumer prices (annual %)",
    unit: "percent",
    description: "Annual percentage change in the consumer price index.",
  },
  {
    id: "SL.UEM.TOTL.ZS",
    label: "Unemployment (% of labor force)",
    unit: "percent",
    description: "Share of the labor force without work but available and seeking employment.",
  },
  {
    id: "IT.NET.USER.ZS",
    label: "Internet users (% of population)",
    unit: "percent",
    description: "Individuals who have used the Internet in the last 3 months.",
  },
  {
    id: "SP.URB.TOTL.IN.ZS",
    label: "Urban population (% of total)",
    unit: "percent",
    description: "People living in urban areas as defined by national statistical offices.",
  },
  {
    id: "EN.GHG.CO2.PC.CE.AR5",
    label: "CO₂ emissions per capita (tonnes)",
    unit: "tonnes-per-capita",
    description: "Carbon dioxide emissions excluding LULUCF, per capita.",
  },
] as const;

export function findIndicator(id: string): IndicatorDefinition | undefined {
  return INDICATORS.find((i) => i.id.toUpperCase() === id.toUpperCase());
}

/** Compact one-line-per-indicator summary injected into the system prompt. */
export function indicatorCatalogForPrompt(): string {
  return INDICATORS.map((i) => `- ${i.id}: ${i.label}`).join("\n");
}
