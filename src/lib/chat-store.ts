/**
 * Client-side chat store backed by localStorage.
 *
 * Replaces the previous "use server" / better-sqlite3 implementation.
 * All operations are synchronous localStorage reads/writes wrapped in
 * Promises so existing call-sites that use `await` continue to work.
 *
 * The raw store object is also exported so the 0G Storage sync layer can
 * snapshot and restore the full dataset.
 */

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: number;
}

export interface RawChatStore {
  v: 1;
  conversations: Conversation[];
  messages: Record<string, DbMessage[]>;
}

const LS_KEY = "moringa:chats";

function read(): RawChatStore {
  if (typeof window === "undefined")
    return { v: 1, conversations: [], messages: {} };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old format that lacked the version field
      return parsed.v === 1
        ? parsed
        : { v: 1, conversations: parsed.conversations ?? [], messages: parsed.messages ?? {} };
    }
  } catch { /* ignore */ }
  return { v: 1, conversations: [], messages: {} };
}

function write(store: RawChatStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

// ─── Public API (mirrors the old server-action signatures) ────────────────────

export async function listConversations(): Promise<Conversation[]> {
  const { conversations } = read();
  return [...conversations].sort((a, b) => b.updated_at - a.updated_at).slice(0, 100);
}

export async function createConversation(title: string): Promise<Conversation> {
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

export async function getMessages(conversationId: string): Promise<DbMessage[]> {
  if (!conversationId) return [];
  const { messages } = read();
  return messages[conversationId] ?? [];
}

export async function saveMessage(
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

export async function deleteConversation(id: string): Promise<void> {
  const store = read();
  store.conversations = store.conversations.filter((c) => c.id !== id);
  delete store.messages[id];
  write(store);
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const store = read();
  const conv = store.conversations.find((c) => c.id === id);
  if (conv) { conv.title = title.slice(0, 80); write(store); }
}

// ─── Raw access for 0G Storage sync ──────────────────────────────────────────

/** Returns the full store snapshot for uploading to 0G Storage. */
export function getRawStore(): RawChatStore {
  return read();
}

/**
 * Replaces the local store with a snapshot downloaded from 0G Storage.
 * Only applied if the remote snapshot has a strictly newer updated_at than
 * the current local newest conversation, preventing accidental rollbacks.
 */
export function mergeRemoteStore(remote: RawChatStore): boolean {
  const local = read();
  const localNewest = Math.max(0, ...local.conversations.map((c) => c.updated_at));
  const remoteNewest = Math.max(0, ...remote.conversations.map((c) => c.updated_at));
  if (remoteNewest <= localNewest) return false; // local is already up-to-date
  write(remote);
  return true;
}
