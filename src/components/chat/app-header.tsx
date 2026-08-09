"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { ASSISTANT_NAME } from "@/lib/chat-contract";

import { ConversationList } from "./app-sidebar";

export function AppHeader() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <header className="flex items-center justify-between gap-2 border-b bg-background/80 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2">
        {/* Mobile: conversation history lives in a sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open conversation history">
                <Menu className="size-4" aria-hidden />
              </Button>
            }
          />
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle className="text-sm">Conversations</SheetTitle>
            </SheetHeader>
            <ConversationList onNavigate={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">
          {ASSISTANT_NAME[0]}
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight">{ASSISTANT_NAME}</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Global development insights, charted from live data
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="hidden sm:inline-flex">
          World Bank Open Data
        </Badge>
        <Badge variant="outline" className="hidden sm:inline-flex">
          Databricks Apps
        </Badge>
        <ThemeToggle />
      </div>
    </header>
  );
}
