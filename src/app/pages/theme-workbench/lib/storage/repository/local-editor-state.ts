import { EDITOR_STATE_STORAGE_KEY, canUseLocalStorage } from "../chrome-api";
import type { WorkbenchColumnWeightsState, WorkbenchEditorState } from "./types";

const NAVIGATION_KEYS = ["workspaceId", "themeId", "actionId", "cursorStateId"] as const;

/**
 * 列宽只校验**形状**（三个有限数），精确夹取交给 `useWorkbenchColumnLayout`——
 * 它才是布局区间的真值源，存储层不该复制那些边界常量。
 */
function normalizeColumnWeights(value: unknown): WorkbenchColumnWeightsState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const weights = ["config", "preview", "ai"].map((key) => record[key]);
  if (!weights.every((weight) => typeof weight === "number" && Number.isFinite(weight))) return null;
  const [config, preview, ai] = weights as number[];
  return { config, preview, ai };
}

export function normalizeEditorState(value: unknown): WorkbenchEditorState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const state: WorkbenchEditorState = {};
  for (const key of NAVIGATION_KEYS) {
    if (typeof record[key] === "string") state[key] = record[key];
  }
  const columnWeights = normalizeColumnWeights(record.columnWeights);
  if (columnWeights) state.columnWeights = columnWeights;
  if (typeof record.libraryCollapsed === "boolean") state.libraryCollapsed = record.libraryCollapsed;
  return state;
}

/**
 * 合并写入（patch 语义，不是替换）。
 *
 * 编辑器状态有多个互不相关的写入方：导航选择、工作台列宽、主题库折叠态。
 * 如果按替换写，后写的那个会把前面的字段抹掉——把语义定成 patch，
 * 各写入方就无需知道彼此，将来加字段也天然安全。
 */
export function mergeEditorState(
  current: WorkbenchEditorState | null,
  patch: WorkbenchEditorState,
): WorkbenchEditorState {
  return { ...(current ?? {}), ...patch };
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

export async function writeLocalEditorState(patch: WorkbenchEditorState): Promise<void> {
  if (!canUseLocalStorage()) return;
  try {
    const merged = mergeEditorState(await readLocalEditorState(), patch);
    window.localStorage.setItem(EDITOR_STATE_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Editor navigation state is best-effort and must not block config saves.
  }
}
