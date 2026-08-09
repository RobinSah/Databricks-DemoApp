"use client";

import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

import { AppHeader } from "@/components/chat/app-header";
import { RenderChartAction } from "@/components/chat/render-chart-action";
import { ASSISTANT_NAME, buildSystemPrompt } from "@/lib/chat-contract";

const INITIAL_MESSAGE = [
  `Hi, I'm ${ASSISTANT_NAME} — I chart global development data live from the World Bank.`,
  "",
  "Try asking:",
  '- "Show me GDP of India from 2000 to 2023"',
  '- "Compare life expectancy in Japan, Brazil and Kenya"',
  '- "How has internet adoption grown in Nigeria?"',
].join("\n");

/**
 * Chat surface, gated on runtime readiness. CopilotKit binds the real
 * sendMessage only after agent discovery completes; sends before that are
 * silently dropped. Exposing readiness as a data attribute lets the E2E
 * suite (and curious humans) wait for a genuinely interactive chat.
 */
function ChatSurface() {
  const { isAvailable } = useCopilotChat();

  return (
    <div
      data-copilot-ready={isAvailable}
      className="relative flex min-h-0 w-full flex-1 flex-col"
    >
      {!isAvailable && (
        <p className="absolute inset-x-0 top-1 z-10 text-center text-xs text-muted-foreground">
          Connecting…
        </p>
      )}
      <CopilotChat
        className="h-full flex-1"
        instructions={buildSystemPrompt()}
        labels={{
          title: ASSISTANT_NAME,
          initial: INITIAL_MESSAGE,
          placeholder: "Ask about GDP, population, life expectancy…",
        }}
      />
    </div>
  );
}

export default function Home() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <div className="flex h-dvh flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4">
          <RenderChartAction />
          <ChatSurface />
        </main>
      </div>
    </CopilotKit>
  );
}
