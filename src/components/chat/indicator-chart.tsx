"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatIndicatorValue } from "@/lib/format";
import { findIndicator } from "@/lib/indicators";
import type { IndicatorSeries } from "@/lib/worldbank";

interface IndicatorChartProps {
  series: IndicatorSeries[];
  indicatorId: string;
  failures?: { countryCode: string; reason: string }[];
}

/**
 * Multi-country time-series chart rendered inline in the chat by the
 * renderIndicatorChart CopilotKit action.
 */
export function IndicatorChart({ series, indicatorId, failures = [] }: IndicatorChartProps) {
  const indicator = findIndicator(indicatorId);
  const unit = indicator?.unit ?? "percent";
  const label = indicator?.label ?? series[0]?.indicatorLabel ?? indicatorId;

  // Pivot [{year, value} per country] into recharts rows: {year, IND: v, USA: v}.
  const rowsByYear = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const point of s.points) {
      const row = rowsByYear.get(point.year) ?? {};
      row[s.countryCode] = point.value;
      rowsByYear.set(point.year, row);
    }
  }
  const data = [...rowsByYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, values]) => ({ year, ...values }));

  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [
      s.countryCode,
      { label: s.countryName, color: `var(--chart-${(i % 5) + 1})` },
    ]),
  );

  const years = data.map((d) => d.year);
  const range = years.length > 0 ? `${years[0]}–${years[years.length - 1]}` : "no data";

  return (
    <Card data-testid="indicator-chart" className="my-2">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>
          {series.map((s) => s.countryName).join(", ")} · {range}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v: number) => formatIndicatorValue(unit, v)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">{config[name as string]?.label ?? name}</span>
                      <span className="font-mono font-medium">
                        {formatIndicatorValue(unit, Number(value))}
                      </span>
                    </span>
                  )}
                />
              }
            />
            {series.map((s) => (
              <Line
                key={s.countryCode}
                dataKey={s.countryCode}
                type="monotone"
                stroke={`var(--color-${s.countryCode})`}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
        <span>Source: World Bank Open Data API</span>
        {failures.length > 0 && (
          <span data-testid="chart-failures" className="text-destructive">
            No data for: {failures.map((f) => f.countryCode).join(", ")}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
