"use client";

import { ExternalLink, Globe } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResult } from "@/lib/search";

/** In-chat citation card rendered by the searchWeb action. */
export function SourcesCard({ query, results }: { query: string; results: SearchResult[] }) {
  return (
    <Card data-testid="sources-card" className="my-2 w-full max-w-2xl gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Globe className="size-4" aria-hidden />
          Searched the web · “{query}”
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <ol className="space-y-3">
          {results.map((result, i) => (
            <li key={result.url} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  <span className="truncate">{result.title}</span>
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                </a>
                {result.snippet && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {result.snippet}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="ml-auto hidden shrink-0 self-start text-[10px] uppercase sm:inline-flex">
                {result.source}
              </Badge>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function SourcesLoading() {
  return (
    <Card data-testid="sources-loading" className="my-2 w-full max-w-2xl gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Globe className="size-4 animate-pulse" aria-hidden />
          Searching the web…
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-5/6" />
      </CardContent>
    </Card>
  );
}

export function SourcesError({ message }: { message: string }) {
  return (
    <Card data-testid="sources-error" className="my-2 w-full max-w-2xl border-destructive/50 py-4">
      <CardContent className="px-4 text-sm text-muted-foreground">
        Web search failed: {message}
      </CardContent>
    </Card>
  );
}
