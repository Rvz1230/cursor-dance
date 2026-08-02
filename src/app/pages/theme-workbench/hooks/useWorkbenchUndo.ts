import { useCallback, useMemo, useRef, useState } from "react";
import {
  EMPTY_UNDO_STACKS,
  canRedo as canRedoIn,
  canUndo as canUndoIn,
  dropBucket,
  peekRedoLabel,
  peekUndoLabel,
  popRedo,
  popUndo,
  pushUndo,
  type UndoStacks,
  type UndoStep,
} from "../lib/undoStack";
import type { WorkbenchThemeDraft } from "./workbenchStateTypes";

interface RecordInput {
  /** 分桶键 = themeId。⌘Z 只作用于当前主题。 */
  bucket: string;
  before: WorkbenchThemeDraft;
  after: WorkbenchThemeDraft;
  label: string;
  /** 连续同目标改动合并用（例如一次滑块拖拽）。 */
  mergeKey?: string;
}

type Take = (
  stacks: UndoStacks<WorkbenchThemeDraft>,
  bucket: string,
) => UndoStep<WorkbenchThemeDraft> | null;

/**
 * 工作台的撤销 / 重做。
 *
 * 栈的语义全在 `lib/undoStack.ts`（纯函数、有单测）；这里只负责把它接到 dispatch 上。
 *
 * 为什么记录点放在 `updateCurrentTheme` 这一个地方：所有主题草稿的改动
 * （字段、预设、光标皮肤、键盘配置、AI 补丁）都从那个 updater 走。
 * 在唯一的漏斗上记录，就不需要在几十个调用点各写一遍 push——
 * 也不会有人新加一个改动入口时忘了记录。
 */
export function useWorkbenchUndo(applyDraft: (draft: WorkbenchThemeDraft) => void) {
  const [stacks, setStacks] = useState<UndoStacks<WorkbenchThemeDraft>>(
    EMPTY_UNDO_STACKS as UndoStacks<WorkbenchThemeDraft>,
  );
  /**
   * 用 ref 跟一份最新值：撤销要「读栈 → 派发 → 写栈」，
   * 而**派发是副作用，不能放在 setState 的 updater 里**——
   * StrictMode 下 updater 会被调用两次，那样会派发两次、状态直接错掉。
   */
  const stacksRef = useRef(stacks);
  stacksRef.current = stacks;

  const record = useCallback((input: RecordInput) => {
    const next = pushUndo(stacksRef.current, {
      label: input.label,
      bucket: input.bucket,
      mergeKey: input.mergeKey,
      at: Date.now(),
      before: input.before,
      after: input.after,
    });
    stacksRef.current = next;
    setStacks(next);
  }, []);

  const step = useCallback((take: Take, bucket: string): string | null => {
    const taken = take(stacksRef.current, bucket);
    if (!taken) return null;
    stacksRef.current = taken.stacks;
    setStacks(taken.stacks);
    applyDraft(taken.restore);
    return taken.entry.label;
  }, [applyDraft]);

  const undo = useCallback((bucket: string) => step(popUndo, bucket), [step]);
  const redo = useCallback((bucket: string) => step(popRedo, bucket), [step]);
  const dropTheme = useCallback((bucket: string) => {
    const next = dropBucket(stacksRef.current, bucket);
    stacksRef.current = next;
    setStacks(next);
  }, []);

  return useMemo(() => ({
    record,
    undo,
    redo,
    dropTheme,
    canUndo: (bucket: string) => canUndoIn(stacks, bucket),
    canRedo: (bucket: string) => canRedoIn(stacks, bucket),
    undoLabel: (bucket: string) => peekUndoLabel(stacks, bucket),
    redoLabel: (bucket: string) => peekRedoLabel(stacks, bucket),
  }), [record, undo, redo, dropTheme, stacks]);
}
