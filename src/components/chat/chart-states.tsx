"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shown while the renderIndicatorChart action is fetching data. */
export function ChartLoading() {
  return (
    <Card data-testid="chart-loading" className="my-2">
      <CardHeader>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-56 w-full" />
      </CardContent>
    </Card>
  );
}

/** Shown when the data fetch failed; the model also receives the error text. */
export function ChartError({ message }: { message: string }) {
  return (
    <Card data-testid="chart-error" className="my-2 border-destructive/50">
      <CardContent className="py-4 text-sm text-destructive">
        Couldn&apos;t load World Bank data: {message}
      </CardContent>
    </Card>
  );
}
