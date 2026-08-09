import type { IndicatorDefinition } from "./indicators";

/** Axis/tooltip value formatting per indicator unit. */
export function formatIndicatorValue(unit: IndicatorDefinition["unit"], value: number): string {
  switch (unit) {
    case "usd":
    case "usd-per-capita":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    case "people":
      return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "years":
      return `${value.toFixed(1)} yrs`;
    case "tonnes-per-capita":
      return `${value.toFixed(2)} t`;
  }
}
