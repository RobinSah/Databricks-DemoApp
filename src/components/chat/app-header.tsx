import { Badge } from "@/components/ui/badge";
import { ASSISTANT_NAME } from "@/lib/chat-contract";

export function AppHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
            {ASSISTANT_NAME[0]}
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">{ASSISTANT_NAME}</h1>
            <p className="text-xs text-muted-foreground">Global development insights, charted from live data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">World Bank Open Data</Badge>
          <Badge variant="outline">Databricks Apps</Badge>
        </div>
      </div>
    </header>
  );
}
