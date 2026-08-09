"use client";

import type { AssistantMessageProps, UserMessageProps } from "@copilotkit/react-ui";
import { Markdown } from "@copilotkit/react-ui";
import { Check, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Right-aligned user bubble, matching modern chat conventions. */
export function UserBubble({ message }: UserMessageProps) {
  const content = typeof message?.content === "string" ? message.content : "";
  if (!content) return null;
  return (
    <div className="flex justify-end py-1.5" data-testid="user-message">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {content}
      </div>
    </div>
  );
}

/**
 * Assistant message: markdown body, generative UI (charts / source cards),
 * a typing indicator while the model thinks, and copy/regenerate affordances
 * on the completed message.
 */
export function AssistantBubble({
  message,
  isLoading,
  isGenerating,
  isCurrentMessage,
  onRegenerate,
  subComponent,
}: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);
  const content = typeof message?.content === "string" ? message.content : "";
  const generativeUI = message?.generativeUI?.() ?? subComponent;

  const thinking = isCurrentMessage && isLoading && !content && !generativeUI;
  const busy = isLoading || isGenerating;

  if (!content && !generativeUI && !thinking) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="py-1.5" data-testid="assistant-message">
      {generativeUI}
      {thinking && <TypingIndicator />}
      {content && (
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_p]:my-1.5">
          <Markdown content={content} />
        </div>
      )}
      {content && isCurrentMessage && !busy && (
        <div className="mt-1 flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label="Copy response"
            onClick={copy}
          >
            {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          </Button>
          {onRegenerate && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label="Regenerate response"
              onClick={onRegenerate}
            >
              <RefreshCw className="size-3.5" aria-hidden />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-2" data-testid="typing-indicator" aria-label="Assistant is thinking">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className={cn("size-1.5 animate-bounce rounded-full bg-muted-foreground/60")}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}
