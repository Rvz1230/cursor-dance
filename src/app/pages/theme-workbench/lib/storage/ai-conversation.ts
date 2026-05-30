import { getChromeApi } from "./chrome-api";

const STORAGE_KEY_PREFIX = "cursordance.aiConversation.";
const AI_CONVERSATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_MESSAGES_PER_CONVERSATION = 100;

export interface ConversationData {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  pendingResult: unknown | null;
  lastPrompt: string;
  agentSteps: unknown[];
  useAgent: boolean;
  updatedAt: number;
}

function buildKey(actionId: string): string {
  return `${STORAGE_KEY_PREFIX}${actionId}`;
}

/** Check whether a key matches our prefix and extract actionId. */
function isOwnKey(key: string): string | null {
  if (!key.startsWith(STORAGE_KEY_PREFIX)) return null;
  return key.slice(STORAGE_KEY_PREFIX.length) || null;
}

function trimMessages(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  if (messages.length <= MAX_MESSAGES_PER_CONVERSATION) return messages;
  // Keep the first (greeting) + last N-1 messages
  return [messages[0], ...messages.slice(-(MAX_MESSAGES_PER_CONVERSATION - 1))];
}

function getStorageArea() {
  const chromeApi = getChromeApi();
  if (chromeApi?.storage?.local) return chromeApi.storage.local;
  return null;
}

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function saveConversation(
  actionId: string,
  data: Omit<ConversationData, "updatedAt">,
): Promise<void> {
  const payload: ConversationData = {
    ...data,
    messages: trimMessages(data.messages),
    updatedAt: Date.now(),
  };

  const storage = getStorageArea();
  if (storage) {
    try {
      await storage.set({ [buildKey(actionId)]: payload });
      return;
    } catch {
      // Storage quota exceeded — silently degrade
    }
  }

  // Fallback to localStorage
  const ls = getLocalStorage();
  if (ls) {
    try {
      ls.setItem(buildKey(actionId), JSON.stringify(payload));
    } catch {
      // Silent fail
    }
  }
}

export async function loadConversation(
  actionId: string,
): Promise<ConversationData | null> {
  const storage = getStorageArea();
  if (storage) {
    try {
      const result = await storage.get([buildKey(actionId)]);
      const raw = result[buildKey(actionId)];
      if (!raw) return null;
      // Validate basic shape
      if (!Array.isArray(raw.messages)) return null;
      return raw as ConversationData;
    } catch {
      return null;
    }
  }

  // Fallback to localStorage
  const ls = getLocalStorage();
  if (ls) {
    try {
      const raw = ls.getItem(buildKey(actionId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.messages)) return null;
      return parsed as ConversationData;
    } catch {
      return null;
    }
  }

  return null;
}

export async function deleteConversation(actionId: string): Promise<void> {
  const key = buildKey(actionId);
  const storage = getStorageArea();
  if (storage) {
    try {
      await storage.remove(key);
      return;
    } catch {
      // Silent fail
    }
  }

  const ls = getLocalStorage();
  if (ls) {
    try {
      ls.removeItem(key);
    } catch {
      // Silent fail
    }
  }
}

/** Remove all expired conversation entries to avoid unbounded storage growth. */
export async function sweepExpiredConversations(): Promise<void> {
  const cutoff = Date.now() - AI_CONVERSATION_TTL_MS;
  const storage = getStorageArea();

  if (storage) {
    try {
      const all = await storage.get(null);
      const toDelete: string[] = [];
      for (const key of Object.keys(all)) {
        const actionId = isOwnKey(key);
        if (!actionId) continue;
        const raw = all[key];
        if (raw && typeof raw.updatedAt === "number" && raw.updatedAt < cutoff) {
          toDelete.push(key);
        }
      }
      if (toDelete.length > 0) {
        await storage.remove(toDelete);
      }
      return;
    } catch {
      // Silent fail
    }
  }

  // Fallback localStorage sweep
  const ls = getLocalStorage();
  if (!ls) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (!key || !isOwnKey(key)) continue;
      try {
        const raw = ls.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed?.updatedAt && parsed.updatedAt < cutoff) {
          keysToRemove.push(key);
        }
      } catch {
        // Corrupted entry — delete it
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      ls.removeItem(key);
    }
  } catch {
    // Silent fail
  }
}
