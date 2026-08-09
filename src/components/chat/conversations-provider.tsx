"use client";

import { useCopilotChat } from "@copilotkit/react-core";
import { useAgent } from "@copilotkit/react-core/v2";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  deleteConversation,
  getActiveConversationId,
  listConversations,
  newConversationId,
  saveConversation,
  setActiveConversationId,
  type AgentMessage,
  type StoredConversation,
} from "@/lib/conversations";

interface ConversationsContextValue {
  conversations: StoredConversation[];
  activeId: string | null;
  /** True while a response is streaming; switching is disabled then. */
  busy: boolean;
  newChat: () => void;
  openConversation: (id: string) => void;
  removeConversation: (id: string) => void;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

export function useConversations(): ConversationsContextValue {
  const value = useContext(ConversationsContext);
  if (!value) {
    throw new Error("useConversations must be used inside <ConversationsProvider>");
  }
  return value;
}

/**
 * Bridges CopilotKit's chat state to localStorage-backed conversations.
 *
 * Message state in CopilotKit 1.66 lives on the shared "default" agent in
 * the v2 core registry (plain AG-UI JSON) — the legacy CopilotMessagesContext
 * is a stub. useAgent() hands us that same live agent instance the chat UI
 * drives, giving us reactive reads (agent.messages), restore
 * (agent.setMessages) and busy state (agent.isRunning).
 *
 * Mount inside <CopilotKit>. Saving happens whenever a run settles, so a
 * mid-stream refresh loses at most the in-flight exchange.
 */
export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const { agent, isReady } = useAgent();
  const { isLoading, isAvailable } = useCopilotChat();
  const busy = Boolean(agent.isRunning || isLoading);

  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Lazily-created id for a chat that hasn't been saved yet.
  const pendingIdRef = useRef<string | null>(null);
  const restoreAttemptsRef = useRef(0);
  const lastSavedRef = useRef<string>("");

  // Load the sidebar list and remembered active id immediately on mount —
  // this is pure UI state with no dependency on the agent connection.
  useEffect(() => {
    setConversations(listConversations());
    setActiveId(getActiveConversationId());
  }, []);

  const messages = agent.messages as unknown as AgentMessage[];

  // Restore the active conversation's transcript into the agent.
  //
  // This is deliberately self-healing rather than run-once: before isReady,
  // useAgent returns a provisional stand-in that is swapped out (empty) when
  // the runtime /info sync completes, and the agent/connect handshake
  // (isAvailable) can also reset message state after we've written ours. So
  // whenever the transcript is empty but the active conversation has saved
  // messages, we re-apply — capped, and never while a run is in flight or
  // the user has started typing into a fresh thread.
  useEffect(() => {
    if (!isReady || !isAvailable || busy || !activeId) return;
    if (messages.length > 0 || restoreAttemptsRef.current >= 3) return;
    const conversation = listConversations().find((c) => c.id === activeId);
    if (!conversation || conversation.messages.length === 0) return;
    restoreAttemptsRef.current += 1;
    lastSavedRef.current = JSON.stringify(conversation.messages);
    agent.setMessages(conversation.messages as Parameters<typeof agent.setMessages>[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, isAvailable, busy, activeId, messages.length]);

  // Persist whenever the conversation settles.
  useEffect(() => {
    if (busy || messages.length === 0) return;
    const snapshot = JSON.stringify(messages);
    if (snapshot === lastSavedRef.current) return;
    lastSavedRef.current = snapshot;

    let id = activeId;
    if (!id) {
      id = pendingIdRef.current ?? newConversationId();
      pendingIdRef.current = id;
      setActiveId(id);
      setActiveConversationId(id);
    }
    const existing = listConversations().find((c) => c.id === id);
    saveConversation(id, messages, existing?.createdAt);
    setConversations(listConversations());
  }, [busy, messages, messages.length, activeId]);

  const newChat = useCallback(() => {
    pendingIdRef.current = null;
    lastSavedRef.current = "";
    restoreAttemptsRef.current = 0;
    setActiveId(null);
    setActiveConversationId(null);
    agent.setMessages([]);
    agent.setState(null);
  }, [agent]);

  const openConversation = useCallback(
    (id: string) => {
      const conversation = listConversations().find((c) => c.id === id);
      if (!conversation) return;
      pendingIdRef.current = null;
      restoreAttemptsRef.current = 0;
      lastSavedRef.current = JSON.stringify(conversation.messages);
      setActiveId(id);
      setActiveConversationId(id);
      agent.setMessages(conversation.messages as Parameters<typeof agent.setMessages>[0]);
    },
    [agent],
  );

  const removeConversation = useCallback(
    (id: string) => {
      deleteConversation(id);
      setConversations(listConversations());
      if (id === activeId) {
        pendingIdRef.current = null;
        lastSavedRef.current = "";
        restoreAttemptsRef.current = 0;
        setActiveId(null);
        agent.setMessages([]);
        agent.setState(null);
      }
    },
    [activeId, agent],
  );

  const value = useMemo(
    () => ({
      conversations,
      activeId,
      busy,
      newChat,
      openConversation,
      removeConversation,
    }),
    [conversations, activeId, busy, newChat, openConversation, removeConversation],
  );

  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}
