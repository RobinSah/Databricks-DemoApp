"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { useConversations } from "./conversations-provider";

/**
 * Conversation list: new chat, switch, delete (two-step confirm).
 * Rendered permanently on desktop and inside a sheet on mobile; the
 * onNavigate callback lets the mobile sheet close itself after a tap.
 */
export function ConversationList({ onNavigate }: { onNavigate?: () => void }) {
  const { conversations, activeId, busy, newChat, openConversation, removeConversation } =
    useConversations();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const pendingConversation = conversations.find((c) => c.id === pendingDelete);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="conversation-list">
      <div className="p-3">
        <Button
          className="w-full justify-start gap-2"
          variant="outline"
          disabled={busy}
          data-testid="new-chat"
          onClick={() => {
            newChat();
            onNavigate?.();
          }}
        >
          <Plus className="size-4" aria-hidden />
          New chat
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-3 pb-3">
        <nav aria-label="Conversation history" className="space-y-1">
          {conversations.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No conversations yet
            </p>
          )}
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-center gap-1 rounded-md",
                conversation.id === activeId ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              <button
                type="button"
                disabled={busy}
                data-testid="conversation-item"
                data-active={conversation.id === activeId}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm disabled:opacity-50"
                onClick={() => {
                  openConversation(conversation.id);
                  onNavigate?.();
                }}
              >
                <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{conversation.title}</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={`Delete conversation: ${conversation.title}`}
                data-testid="delete-conversation"
                className="mr-1 size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => setPendingDelete(conversation.id)}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingConversation?.title}” will be permanently removed from this browser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete"
              onClick={() => {
                if (pendingDelete) removeConversation(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
