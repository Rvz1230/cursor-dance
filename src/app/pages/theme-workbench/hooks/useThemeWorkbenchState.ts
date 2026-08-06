import { useCallback, useMemo, useReducer, useRef } from "react";
import {
  PLATFORM_ACTIONS,
  CURSOR_STATES,
  WORKSPACES,
  formatActionLabel,
  getConflictsForAction,
} from "../model/workbenchSchema";
import {
  buildStoredConfigFromWorkbench,
  clearLivePreviewConfig,
  readExtensionConfig,
  writeExtensionConfig,
} from "../lib/workbenchConfig";
import {
  INITIAL_THEME_STATE,
  initialState,
  reducer,
} from "./themeWorkbenchStateStore";
import { useThemeWorkbenchPersistence } from "./useThemeWorkbenchPersistence";
import { isDesktop } from "@/shared/runtime";
import { normalizeKeyFeedbackConfig } from "@/shared/config/key-feedback";
import { createWorkbenchThemeCommands } from "./workbenchThemeCommands";
import { createWorkbenchCursorCommands } from "./workbenchCursorCommands";
import { useWorkbenchUndo } from "./useWorkbenchUndo";
import type { AppRule } from "@/shared/app-rules";
import type { KeyFeedbackConfig } from "@/shared/config/key-feedback";
import type {
  NewAppRule,
  NewSiteRule,
  SiteRule,
  WorkbenchActionConfig,
  WorkbenchConfigRef,
  WorkbenchThemeDraft,
} from "./workbenchStateTypes";
import { findWorkbenchTheme } from "./workbenchThemeSelectors";

export function useThemeWorkbenchState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const configRef: WorkbenchConfigRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  useThemeWorkbenchPersistence({ state, dispatch, configRef });

  const selected = useMemo(() => ({
    themeId: state.domain.activeThemeId,
    actionId: state.editor.actionId,
    cursorStateId: state.editor.cursorStateId,
  }), [state.domain.activeThemeId, state.editor.actionId, state.editor.cursorStateId]);
  const selectedTheme = useMemo(
    () => findWorkbenchTheme(state.domain.themes, selected.themeId) ?? state.domain.themes[0] ?? INITIAL_THEME_STATE.themes[0],
    [selected.themeId, state.domain.themes]
  );
  const activeTheme = selectedTheme.meta;
  const draft = selectedTheme.draft;
  const themeMetadata = useMemo(() => state.domain.themes.map((theme) => theme.meta), [state.domain.themes]);
  const currentActionConfig = draft.actionConfigs[selected.actionId];
  const currentConflicts = getConflictsForAction(selected.actionId, draft.actionConfigs);
  const isWorkbench = state.editor.workspaceId === "workbench";

  /**
   * 撤销：把当前主题草稿恢复成快照。刻意**不**经过 updateCurrentTheme，
   * 否则恢复动作本身又会被记一笔，形成自我循环。
   */
  const applyDraftSnapshot = useCallback((snapshot: WorkbenchThemeDraft) => {
    dispatch({ type: "theme/update-current", payload: () => snapshot });
  }, []);
  const undoStack = useWorkbenchUndo(applyDraftSnapshot);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  /**
   * 所有主题草稿的改动都从这里走 —— 所以撤销也只在这里记录一次。
   *
   * `after` 用 updater 自己算，而不是等 reducer 跑完再从 state 里读：
   * updater 都是纯函数（`(current) => ({...current, ...})`），
   * 这样就不需要靠 effect 去观测「新状态」，记录与派发在同一个同步流里完成。
   */
  function updateCurrentTheme(
    updater: (current: WorkbenchThemeDraft) => WorkbenchThemeDraft,
    meta?: { label?: string; mergeKey?: string },
  ): void {
    const before = draftRef.current;
    dispatch({ type: "theme/update-current", payload: updater });
    undoStack.record({
      bucket: selected.themeId,
      before,
      after: updater(before),
      label: meta?.label ?? formatActionLabel(selected.actionId),
      mergeKey: meta?.mergeKey,
    });
  }

  async function saveChanges() {
    dispatch({ type: "save/start" });
    try {
      const nextConfig = buildStoredConfigFromWorkbench(configRef.current ?? (await readExtensionConfig()), state);
      const savedConfig = await writeExtensionConfig(nextConfig);
      configRef.current = savedConfig;
      const latestState = stateRef.current;
      const hasStaleSelection = latestState.domain.activeThemeId !== nextConfig.activeThemeId;
      if (!latestState.status.unsaved || !hasStaleSelection) {
        await clearLivePreviewConfig();
      }
      dispatch({ type: "save/success", payload: { preserveUnsaved: hasStaleSelection } });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败，请重试";
      dispatch({ type: "save/error", payload: message });
      return { ok: false, error: message };
    }
  }

  const themeCommands = createWorkbenchThemeCommands({
    state,
    selected,
    configRef,
    dispatch,
  });
  const cursorCommands = createWorkbenchCursorCommands({
    selected,
    draft,
    updateCurrentTheme,
  });

  return {
    state,
    selected,
    undoStack,
    themes: themeMetadata,
    activeTheme,
    draft,
    currentActionConfig,
    currentConflicts,
    isWorkbench,
    workspaceItems: WORKSPACES.map((item) =>
      item.id === "sites" && isDesktop()
        ? { ...item, label: "应用规则" }
        : item,
    ).filter((item) => item.id !== "keyboard" || isDesktop()),
    actionItems: PLATFORM_ACTIONS,
    cursorStates: CURSOR_STATES,
    recentCursorAssets: state.runtime.recentCursorAssets,
    setWorkspaceId: (value: string) => dispatch({ type: "workspace/set", payload: value }),
    setThemeId: (value: string) => dispatch({ type: "theme/select", payload: value }),
    setActionId: (value: string) => dispatch({ type: "action/select", payload: value }),
    setCursorStateId: (value: string) => dispatch({ type: "cursor-state/select", payload: value }),
    setEnabled: (value: boolean) => dispatch({ type: "global-enabled/set", payload: value }),
    saveChanges,
    ...themeCommands,
    resetCurrentTheme: () => dispatch({ type: "theme/reset-current" }),
    updateActionConfig: (patch: WorkbenchActionConfig) =>
      updateCurrentTheme((current) => ({
        ...current,
        actionConfigs: {
          ...current.actionConfigs,
          [selected.actionId]: {
            ...current.actionConfigs[selected.actionId],
            ...patch,
          },
        },
      }), {
        // mergeKey 按「动作 + 被改的字段」自动生成：ControlSlider 用的是
        // Radix onValueChange，拖动时每帧都提交一次，不合并的话一次拖拽会塞进
        // 几十条撤销记录，按一次 ⌘Z 只退回一帧。
        mergeKey: `${selected.actionId}:${Object.keys(patch ?? {}).sort().join(",")}`,
      }),
    updateActionConfigs: (patchesByActionId: Record<string, WorkbenchActionConfig>) =>
      updateCurrentTheme((current) => ({
        ...current,
        actionConfigs: Object.entries(patchesByActionId || {}).reduce(
          (nextActionConfigs, [actionId, patch]) => ({
            ...nextActionConfigs,
            [actionId]: {
              ...nextActionConfigs[actionId],
              ...(patch as Record<string, unknown>),
            },
          }),
          current.actionConfigs
        ),
      })),
    updateAtmosphere: (patch: Record<string, unknown>) =>
      updateCurrentTheme((current) => ({
        ...current,
        atmosphere: {
          ...current.atmosphere,
          ...patch,
        },
      })),
    ...cursorCommands,
    addSiteRule: (rule: NewSiteRule) => dispatch({ type: "rules/add", payload: { collection: "siteRules", rule } }),
    updateSiteRule: (id: string, updates: Partial<SiteRule>) => dispatch({ type: "rules/update", payload: { collection: "siteRules", id, updates } }),
    deleteSiteRule: (id: string) => dispatch({ type: "rules/delete", payload: { collection: "siteRules", id } }),
    reorderSiteRules: (from: number, to: number) => dispatch({ type: "rules/reorder", payload: { collection: "siteRules", from, to } }),
    toggleSiteRule: (id: string) => dispatch({ type: "rules/toggle", payload: { collection: "siteRules", id } }),
    clearAllSiteRules: () => dispatch({ type: "rules/clear-all", payload: { collection: "siteRules" } }),
    addAppRule: (rule: NewAppRule) => dispatch({ type: "rules/add", payload: { collection: "appRules", rule } }),
    updateAppRule: (id: string, updates: Partial<AppRule>) => dispatch({ type: "rules/update", payload: { collection: "appRules", id, updates } }),
    deleteAppRule: (id: string) => dispatch({ type: "rules/delete", payload: { collection: "appRules", id } }),
    reorderAppRules: (from: number, to: number) => dispatch({ type: "rules/reorder", payload: { collection: "appRules", from, to } }),
    toggleAppRule: (id: string) => dispatch({ type: "rules/toggle", payload: { collection: "appRules", id } }),
    clearAllAppRules: () => dispatch({ type: "rules/clear-all", payload: { collection: "appRules" } }),
    keyFeedbackConfig: normalizeKeyFeedbackConfig(draft?.keyFeedbackConfig),
    updateKeyFeedbackConfig: (patch: Partial<KeyFeedbackConfig>) => dispatch({ type: "key-feedback/update", payload: patch }),
  };
}
