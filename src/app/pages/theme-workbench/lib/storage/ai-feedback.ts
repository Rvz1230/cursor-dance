import { getChromeApi } from "./chrome-api";

const FEEDBACK_STORAGE_KEY = "cursordance.aiFeedback";
const MAX_FEEDBACK_RECORDS = 500;

export interface FeedbackRecord {
  id: string;
  actionId: string;
  messageContent: string;
  rating: "up" | "down";
  comment?: string;
  proposalId?: string;
  timestamp: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function saveFeedback(
  record: Omit<FeedbackRecord, "id" | "timestamp">,
): Promise<void> {
  const chromeApi = getChromeApi();
  if (chromeApi?.storage?.local) {
    try {
      const result = await chromeApi.storage.local.get([FEEDBACK_STORAGE_KEY]);
      const current: FeedbackRecord[] = Array.isArray(result[FEEDBACK_STORAGE_KEY])
        ? result[FEEDBACK_STORAGE_KEY]
        : [];
      const next: FeedbackRecord = {
        ...record,
        id: generateId(),
        timestamp: Date.now(),
      };
      const updated = [next, ...current].slice(0, MAX_FEEDBACK_RECORDS);
      await chromeApi.storage.local.set({ [FEEDBACK_STORAGE_KEY]: updated });
      return;
    } catch {
      // Silent fail — feedback is non-critical
    }
  }

  // Fallback: localStorage
  try {
    const ls = window.localStorage;
    const raw = ls.getItem(FEEDBACK_STORAGE_KEY);
    const current: FeedbackRecord[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(current)) return;
    const next: FeedbackRecord = {
      ...record,
      id: generateId(),
      timestamp: Date.now(),
    };
    const updated = [next, ...current].slice(0, MAX_FEEDBACK_RECORDS);
    ls.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silent fail
  }
}
