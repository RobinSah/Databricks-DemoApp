"use client";

import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

import { AppHeader } from "@/components/chat/app-header";
import { ConversationList } from "@/components/chat/app-sidebar";
import { ChatInput } from "@/components/chat/chat-input";
import {
  ConversationsProvider,
} from "@/components/chat/conversations-provider";
import { AssistantBubble, UserBubble } from "@/components/chat/message-bubbles";
import { RenderChartAction } from "@/components/chat/render-chart-action";
import { SearchWebAction } from "@/components/chat/search-web-action";
import { ASSISTANT_NAME, buildSystemPrompt } from "@/lib/chat-contract";

const INITIAL_MESSAGE = [
  `Hi, I'm ${ASSISTANT_NAME} — I chart global development data live from the World Bank,`,
  "and I can search the web for context.",
  "",
  "Try asking:",
  '- "Show me GDP of India from 2000 to 2023"',
  '- "Compare life expectancy in Japan, Brazil and Kenya"',
  '- "Search the web for the largest economies in Africa"',
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
    <div data-copilot-ready={isAvailable} className="relative flex min-h-0 w-full flex-1 flex-col">
      <CopilotChat
        className="h-full flex-1 [&_.copilotKitMessages]:px-4"
        instructions={buildSystemPrompt()}
        labels={{ title: ASSISTANT_NAME, initial: INITIAL_MESSAGE }}
        UserMessage={UserBubble}
        AssistantMessage={AssistantBubble}
        Input={(props) => <ChatInput {...props} chatReady={isAvailable} />}
      />
    </div>
  );
}

export default function Home() {
  // showDevConsole={false} suppresses CopilotKit's dev banner, which otherwise
  // overlays product announcements on top of our header.
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" showDevConsole={false}>
      <ConversationsProvider>
        <div className="flex h-dvh flex-col">
          <AppHeader />
          <div className="flex min-h-0 flex-1">
            {/* Desktop sidebar; on mobile the header's sheet hosts the same list */}
            <aside className="hidden w-64 shrink-0 border-r bg-muted/30 md:block">
              <ConversationList />
            </aside>
            <main className="mx-auto flex w-full min-w-0 flex-1 flex-col overflow-hidden">
              <RenderChartAction />
              <SearchWebAction />
              <ChatSurface />
            </main>
          </div>
        </div>
      </ConversationsProvider>
    </CopilotKit>
  );
}
