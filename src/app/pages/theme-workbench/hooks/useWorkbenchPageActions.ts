import type { Dispatch, SetStateAction } from "react";
import type { WorkbenchCommand } from "../components/WorkbenchCommandPalette";
import type { WorkbenchHeaderProps } from "../components/WorkbenchChrome";
import type { WorkbenchLayoutPreset } from "./useWorkbenchColumnLayout";
import { useGlobalShortcuts } from "./useGlobalShortcuts";
import { WORKSPACE_SHORTCUT_ORDER } from "../lib/shortcuts";
import type { useToast } from "@/components/ui/toast";
import type { WorkbenchActionConfig } from "./workbenchStateTypes";

type Toast = ReturnType<typeof useToast>;
type LayoutSetter = (preset: Exclude<WorkbenchLayoutPreset, "custom">) => void;
type SaveResult = { ok: true } | { ok: false; error: string };

interface UndoApi {
  undo(themeId: string): string | null;
  redo(themeId: string): string | null;
  undoLabel(themeId: string): string | null;
  redoLabel(themeId: string): string | null;
}

interface BuildWorkbenchCommandsOptions {
  workspaceItems: WorkbenchHeaderProps["workspaceItems"];
  unsaved: boolean;
  themeScoped: boolean;
  isWorkbench: boolean;
  aiPanelOpen: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  setWorkspaceId: WorkbenchHeaderProps["setWorkspaceId"];
  setAiPanelOpen: Dispatch<SetStateAction<boolean>>;
  setLayoutPreset: LayoutSetter;
  applyChanges: () => void;
  restoreAppliedChanges: () => void;
  resetCurrentTheme: () => void;
  undo: () => void;
  redo: () => void;
}

export function buildWorkbenchCommands({
  workspaceItems,
  unsaved,
  themeScoped,
  isWorkbench,
  aiPanelOpen,
  undoLabel,
  redoLabel,
  setWorkspaceId,
  setAiPanelOpen,
  setLayoutPreset,
  applyChanges,
  restoreAppliedChanges,
  resetCurrentTheme,
  undo,
  redo,
}: BuildWorkbenchCommandsOptions): WorkbenchCommand[] {
  return [
    ...workspaceItems.map((item) => ({
      id: `workspace-${item.id}`,
      group: "工作区" as const,
      label: `切到${item.label}`,
      shortcut: `⌘${WORKSPACE_SHORTCUT_ORDER.indexOf(
        item.id as typeof WORKSPACE_SHORTCUT_ORDER[number],
      ) + 1}`,
      run: () => setWorkspaceId(item.id),
    })),
    ...(unsaved ? [{
      id: "apply",
      group: "编辑" as const,
      label: themeScoped ? "应用到桌面" : "应用全局设置",
      keywords: ["保存", "发布"],
      run: applyChanges,
    }, {
      id: "restore-applied",
      group: "编辑" as const,
      label: "恢复已应用版本",
      keywords: ["撤销草稿", "回退"],
      run: restoreAppliedChanges,
    }] : []),
    ...(themeScoped ? [{
      id: "reset-theme",
      group: "编辑" as const,
      label: "恢复当前主题默认",
      run: resetCurrentTheme,
    }] : []),
    ...(undoLabel ? [{
      id: "undo",
      group: "编辑" as const,
      label: `撤销：${undoLabel}`,
      shortcut: "⌘Z",
      run: undo,
    }] : []),
    ...(redoLabel ? [{
      id: "redo",
      group: "编辑" as const,
      label: `重做：${redoLabel}`,
      shortcut: "⌘⇧Z",
      run: redo,
    }] : []),
    ...(isWorkbench ? [{
      id: "toggle-ai",
      group: "视图" as const,
      label: aiPanelOpen ? "关闭 AI 助手" : "打开 AI 助手",
      shortcut: "⌘J",
      run: () => setAiPanelOpen((open) => !open),
    }, ...(["config", "split", "preview"] as const).map((preset) => ({
      id: `layout-${preset}`,
      group: "视图" as const,
      label: ({ config: "专注配置", split: "对半布局", preview: "专注预览" })[preset],
      run: () => setLayoutPreset(preset),
    }))] : []),
  ];
}

interface UseWorkbenchPageActionsOptions {
  workspaceItems: WorkbenchHeaderProps["workspaceItems"];
  workspaceId: string;
  selectedThemeId: string;
  themeName: string;
  themeScoped: boolean;
  isWorkbench: boolean;
  enabled: boolean;
  unsaved: boolean;
  isSaving: boolean;
  saveError: string;
  undoStack: UndoApi;
  setWorkspaceId: WorkbenchHeaderProps["setWorkspaceId"];
  setEnabled: WorkbenchHeaderProps["setEnabled"];
  saveChanges: () => Promise<SaveResult>;
  restoreAppliedChanges: () => Promise<void>;
  resetCurrentTheme: () => void;
  updateActionConfig: (patch: WorkbenchActionConfig) => void;
  keyboardCaptureActive: boolean;
  aiPanelOpen: boolean;
  setAiPanelOpen: Dispatch<SetStateAction<boolean>>;
  setAiSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  layoutPreset: WorkbenchLayoutPreset;
  setLayoutPreset: LayoutSetter;
  clearPreview: () => void;
  toast: Toast;
}

export function useWorkbenchPageActions({
  workspaceItems,
  workspaceId,
  selectedThemeId,
  themeName,
  themeScoped,
  isWorkbench,
  enabled,
  unsaved,
  isSaving,
  saveError,
  undoStack,
  setWorkspaceId,
  setEnabled,
  saveChanges,
  restoreAppliedChanges,
  resetCurrentTheme,
  updateActionConfig,
  keyboardCaptureActive,
  aiPanelOpen,
  setAiPanelOpen,
  setAiSettingsOpen,
  setCommandPaletteOpen,
  layoutPreset,
  setLayoutPreset,
  clearPreview,
  toast,
}: UseWorkbenchPageActionsOptions): {
  headerProps: WorkbenchHeaderProps;
  commandPaletteCommands: WorkbenchCommand[];
  handleUpdateActionConfig: (patch: WorkbenchActionConfig) => void;
} {
  function runUndo(): void {
    const label = undoStack.undo(selectedThemeId);
    toast(label
      ? { title: `已撤销：${label}`, tone: "info", undo: { label: "重做", run: runRedo } }
      : { title: "没有可撤销的改动", tone: "info" });
  }

  function runRedo(): void {
    const label = undoStack.redo(selectedThemeId);
    toast(label
      ? { title: `已重做：${label}`, tone: "info", undo: { label: "撤销", run: runUndo } }
      : { title: "没有可重做的改动", tone: "info" });
  }

  useGlobalShortcuts({
    onUndo: runUndo,
    onRedo: runRedo,
    onToggleAi: () => setAiPanelOpen((open) => !open),
    onWorkspace: setWorkspaceId,
    onCommandPalette: () => setCommandPaletteOpen(true),
  }, !keyboardCaptureActive);

  async function applyChanges(): Promise<void> {
    const result = await saveChanges();
    toast(result.ok
      ? { tone: "success", title: "已应用到桌面" }
      : { tone: "error", title: "保存失败", description: result.error || "请稍后重试。" });
  }

  async function restoreChanges(): Promise<void> {
    try {
      await restoreAppliedChanges();
      clearPreview();
      toast({ tone: "info", title: "已恢复桌面正在使用的版本" });
    } catch (error) {
      toast({
        tone: "error",
        title: "恢复失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
      });
    }
  }

  function resetTheme(): void {
    resetCurrentTheme();
    toast({ tone: "info", title: "已恢复当前主题默认配置" });
  }

  const handleUpdateActionConfig = (patch: WorkbenchActionConfig): void => {
    clearPreview();
    updateActionConfig(patch);
    if (Object.prototype.hasOwnProperty.call(patch, "textColor")) {
      const textColor = patch.textColor;
      toast({
        tone: "info",
        title: "已更新飘字颜色",
        description: typeof textColor === "string" ? textColor : undefined,
      });
    }
  };

  const headerProps: WorkbenchHeaderProps = {
    workspaceItems,
    workspaceId,
    setWorkspaceId,
    themeName,
    themeScoped,
    enabled,
    setEnabled,
    unsaved,
    undo: { run: runUndo, label: undoStack.undoLabel(selectedThemeId) },
    redo: { run: runRedo, label: undoStack.redoLabel(selectedThemeId) },
    isSaving,
    saveError,
    saveChanges: () => { void applyChanges(); },
    restoreAppliedChanges: () => { void restoreChanges(); },
    resetCurrentTheme: resetTheme,
    aiPanelOpen,
    setAiPanelOpen,
    openAiSettings: typeof window !== "undefined" && window.cursorDanceAi
      ? () => setAiSettingsOpen(true)
      : undefined,
    layoutPreset,
    setLayoutPreset,
    openCommandPalette: () => setCommandPaletteOpen(true),
  };

  return {
    headerProps,
    commandPaletteCommands: buildWorkbenchCommands({
      workspaceItems,
      unsaved,
      themeScoped,
      isWorkbench,
      aiPanelOpen,
      undoLabel: undoStack.undoLabel(selectedThemeId),
      redoLabel: undoStack.redoLabel(selectedThemeId),
      setWorkspaceId,
      setAiPanelOpen,
      setLayoutPreset,
      applyChanges: () => { void applyChanges(); },
      restoreAppliedChanges: () => { void restoreChanges(); },
      resetCurrentTheme: resetTheme,
      undo: runUndo,
      redo: runRedo,
    }),
    handleUpdateActionConfig,
  };
}
