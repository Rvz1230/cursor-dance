import { EDITOR_STATE_STORAGE_KEY, canUseLocalStorage } from "../chrome-api";
import type { WorkbenchEditorState } from "./types";

export function normalizeEditorState(value: unknown): WorkbenchEditorState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const state: WorkbenchEditorState = {};
  for (const key of ["workspaceId", "themeId", "actionId", "cursorStateId"] as const) {
    if (typeof record[key] === "string") state[key] = record[key];
  }
  return state;
}

export async function readLocalEditorState(): Promise<WorkbenchEditorState | null> {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(EDITOR_STATE_STORAGE_KEY);
    if (!raw) return null;
    return normalizeEditorState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeLocalEditorState(state: WorkbenchEditorState): Promise<void> {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(EDITOR_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Editor navigation state is best-effort and must not block config saves.
  }
}
