"use client";

import { useCopilotAction } from "@copilotkit/react-core";

import { RENDER_CHART_ACTION } from "@/lib/chat-contract";
import { INDICATORS } from "@/lib/indicators";
import type { IndicatorSeries } from "@/lib/worldbank";

import { ChartError, ChartLoading } from "./chart-states";
import { IndicatorChart } from "./indicator-chart";

interface SeriesResponse {
  series: IndicatorSeries[];
  failures: { countryCode: string; reason: string }[];
}

type ActionResult = (SeriesResponse & { indicatorId: string }) | { error: string };

/**
 * Registers the frontend CopilotKit action the model calls to chart data.
 * The handler fetches from our own /api/worldbank/series route (cacheable,
 * validated, and interceptable by Playwright); the render callback draws the
 * chart inline in the conversation.
 *
 * Errors are returned as a value rather than thrown so the model receives
 * them as a tool result and can explain the failure conversationally.
 */
export function RenderChartAction() {
  useCopilotAction({
    name: RENDER_CHART_ACTION,
    description:
      "Fetch World Bank indicator data for up to 6 countries and render a line chart " +
      "in the chat. Countries are ISO alpha-3 codes. Returns the underlying data " +
      "points so you can summarize the trend afterwards.",
    parameters: [
      {
        name: "countries",
        type: "string[]",
        description: 'ISO alpha-3 country codes, e.g. ["IND", "USA"]. Max 6.',
        required: true,
      },
      {
        name: "indicatorId",
        type: "string",
        description: `World Bank indicator code. One of: ${INDICATORS.map((i) => i.id).join(", ")}`,
        required: true,
      },
      {
        name: "startYear",
        type: "number",
        description: "First year of the range, e.g. 2000",
        required: true,
      },
      {
        name: "endYear",
        type: "number",
        description: "Last year of the range, e.g. 2023",
        required: true,
      },
    ],
    handler: async ({ countries, indicatorId, startYear, endYear }): Promise<ActionResult> => {
      const params = new URLSearchParams({
        countries: countries.join(","),
        indicator: indicatorId,
        start: String(startYear),
        end: String(endYear),
      });
      try {
        const response = await fetch(`/api/worldbank/series?${params}`);
        const payload = await response.json();
        if (!response.ok) {
          return { error: payload.error ?? `Request failed (HTTP ${response.status})` };
        }
        return { ...(payload as SeriesResponse), indicatorId };
      } catch {
        return { error: "Network error while fetching World Bank data" };
      }
    },
    render: ({ status, result }) => {
      if (status !== "complete") {
        return <ChartLoading />;
      }
      const outcome = result as ActionResult | undefined;
      if (!outcome || "error" in outcome) {
        return <ChartError message={outcome?.error ?? "Unknown error"} />;
      }
      return (
        <IndicatorChart
          series={outcome.series}
          indicatorId={outcome.indicatorId}
          failures={outcome.failures}
        />
      );
    },
  });

  return null;
}
