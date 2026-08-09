"use client";

import { ArrowUp, Square } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  inProgress: boolean;
  onSend: (text: string) => void | Promise<unknown>;
  onStop?: () => void;
  chatReady?: boolean;
}

/**
 * Custom input for CopilotChat: Enter sends, Shift+Enter adds a newline,
 * and the send button flips to a stop button while a response streams.
 */
export function ChatInput({ inProgress, onSend, onStop, chatReady = true }: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = chatReady && !inProgress && text.trim().length > 0;

  const send = () => {
    const trimmed = text.trim();
    if (!canSend || trimmed.length === 0) return;
    setText("");
    void onSend(trimmed);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t bg-background px-4 pb-4 pt-3">
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-xl border bg-card p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <Textarea
          ref={textareaRef}
          value={text}
          data-testid="chat-input"
          placeholder={chatReady ? "Ask about GDP, population, life expectancy…" : "Connecting…"}
          disabled={!chatReady}
          rows={1}
          className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
        />
        {inProgress ? (
          <Button
            size="icon"
            variant="destructive"
            aria-label="Stop generating"
            data-testid="stop-button"
            className="shrink-0 rounded-lg"
            onClick={() => onStop?.()}
          >
            <Square className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button
            size="icon"
            aria-label="Send message"
            data-testid="send-button"
            className="shrink-0 rounded-lg"
            disabled={!canSend}
            onClick={send}
          >
            <ArrowUp className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      <p className="mx-auto mt-2 w-full max-w-3xl text-center text-[11px] text-muted-foreground">
        Atlas can chart World Bank data and search the web. Responses may contain mistakes.
      </p>
    </div>
  );
}
