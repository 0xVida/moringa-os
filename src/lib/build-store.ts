import type { Conversation, DbMessage } from "./chat-store";

// Re-use the types from chat-store, but use a separate local storage key
export type { Conversation, DbMessage };

export interface RawBuildStore {
  v: 1;
  conversations: Conversation[];
  messages: Record<string, DbMessage[]>;
}

const LS_KEY = "moringa:builds";

function read(): RawBuildStore {
  if (typeof window === "undefined")
    return { v: 1, conversations: [], messages: {} };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.v === 1
        ? parsed
        : { v: 1, conversations: parsed.conversations ?? [], messages: parsed.messages ?? {} };
    }
  } catch { /* ignore */ }
  return { v: 1, conversations: [], messages: {} };
}

function write(store: RawBuildStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

export async function listBuildConversations(): Promise<Conversation[]> {
  const { conversations } = read();
  return [...conversations].sort((a, b) => b.updated_at - a.updated_at).slice(0, 100);
}

export async function createBuildConversation(title: string): Promise<Conversation> {
  const store = read();
  const conv: Conversation = {
    id: crypto.randomUUID(),
    title: title.slice(0, 80),
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
  };
  store.conversations.unshift(conv);
  write(store);
  return conv;
}

export async function getBuildMessages(conversationId: string): Promise<DbMessage[]> {
  if (!conversationId) return [];
  const { messages } = read();
  return messages[conversationId] ?? [];
}

export async function saveBuildMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const store = read();
  const now = Math.floor(Date.now() / 1000);
  const msg: DbMessage = {
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    role,
    content,
    created_at: now,
  };
  if (!store.messages[conversationId]) store.messages[conversationId] = [];
  store.messages[conversationId].push(msg);
  const conv = store.conversations.find((c) => c.id === conversationId);
  if (conv) conv.updated_at = now;
  write(store);
}

export async function deleteBuildConversation(id: string): Promise<void> {
  const store = read();
  store.conversations = store.conversations.filter((c) => c.id !== id);
  delete store.messages[id];
  write(store);
}

export async function renameBuildConversation(id: string, title: string): Promise<void> {
  const store = read();
  const conv = store.conversations.find((c) => c.id === id);
  if (conv) { conv.title = title.slice(0, 80); write(store); }
}

export function getRawBuildStore(): RawBuildStore {
  return read();
}

export function mergeRemoteBuildStore(remote: RawBuildStore): boolean {
  const local = read();
  const localNewest = Math.max(0, ...local.conversations.map((c) => c.updated_at));
  const remoteNewest = Math.max(0, ...remote.conversations.map((c) => c.updated_at));
  if (remoteNewest <= localNewest) return false;
  write(remote);
  return true;
}
