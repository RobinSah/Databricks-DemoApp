/**
 * Client-side conversation persistence.
 *
 * Conversations live in localStorage — deliberately: this demo has no user
 * accounts, and a database adds operational surface without changing the
 * architectural story (swap this module for a Lakebase/Postgres-backed
 * implementation and nothing above it changes).
 *
 * Messages are stored as plain AG-UI JSON, exactly as CopilotKit's agent
 * store holds them ({id, role, content, toolCalls?, ...}), so save/restore
 * is a lossless round-trip: charts and source cards re-render on restore
 * from the stored tool-call/result pairs.
 */

export interface AgentMessage {
  id: string;
  role: string;
  content?: unknown;
  [key: string]: unknown;
}

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AgentMessage[];
}

const STORE_KEY = "atlas.conversations.v1";
const ACTIVE_KEY = "atlas.active-conversation.v1";
const MAX_CONVERSATIONS = 50;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function listConversations(): StoredConversation[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredConversation[]) : [];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : [];
  } catch {
    // Corrupt store — start fresh rather than wedging the app.
    return [];
  }
}

function writeConversations(conversations: StoredConversation[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)));
}

export function saveConversation(
  id: string,
  messages: AgentMessage[],
  existingCreatedAt?: string,
): StoredConversation {
  const now = new Date().toISOString();
  const conversation: StoredConversation = {
    id,
    title: deriveTitle(messages),
    createdAt: existingCreatedAt ?? now,
    updatedAt: now,
    messages: JSON.parse(JSON.stringify(messages)) as AgentMessage[],
  };
  const others = listConversations().filter((c) => c.id !== id);
  writeConversations([conversation, ...others]);
  return conversation;
}

export function deleteConversation(id: string): void {
  writeConversations(listConversations().filter((c) => c.id !== id));
  if (getActiveConversationId() === id && isBrowser()) {
    window.localStorage.removeItem(ACTIVE_KEY);
  }
}

export function getActiveConversationId(): string | null {
  return isBrowser() ? window.localStorage.getItem(ACTIVE_KEY) : null;
}

export function setActiveConversationId(id: string | null): void {
  if (!isBrowser()) return;
  if (id === null) {
    window.localStorage.removeItem(ACTIVE_KEY);
  } else {
    window.localStorage.setItem(ACTIVE_KEY, id);
  }
}

function deriveTitle(messages: AgentMessage[]): string {
  const firstUserText = messages.find(
    (m) => m.role === "user" && typeof m.content === "string" && m.content.trim().length > 0,
  );
  const title = ((firstUserText?.content as string) ?? "New conversation").trim();
  return title.length > 48 ? `${title.slice(0, 48)}…` : title;
}

export function newConversationId(): string {
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
