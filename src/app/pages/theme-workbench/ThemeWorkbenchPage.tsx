import { formatActionLabel } from "./model/workbenchSchema";
import { lazy, Suspense, useState } from "react";
import { useThemeWorkbenchState } from "./hooks/useThemeWorkbenchState";
import { WorkbenchHeader } from "./components/WorkbenchHeader";
import { ColumnResizeHandle } from "@/components/ui/column-resize-handle";
import { WorkbenchActionTab } from "./components/WorkbenchActionTab";
import { WorkbenchPanel } from "./components/WorkbenchPanel";
import { WorkbenchPreviewRail } from "./components/WorkbenchPreviewRail";
import { PreviewTimeline } from "./components/preview-rail/PreviewTimeline";
import { usePreviewPlayback } from "./components/preview-rail/usePreviewPlayback";
import { getRuntimeConfig } from "./lib/runtimeConfig";
import { WORKSPACE_SHORTCUT_ORDER } from "./lib/shortcuts";
import { ThemeLibrarySidebar } from "./components/ThemeLibrarySidebar";
import { WelcomeDialog } from "./components/WelcomeDialog";
import { cn } from "@/components/ui/utils";
import { PanelSkeleton } from "@/components/ui/skeleton";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isDesktop, isExtension } from "@/shared/runtime";
import {
  activeAppInfoFromSnapshot,
  resolveAppRule,
} from "@/shared/app-rules";
import { useWorkbenchAiPreview } from "./hooks/useWorkbenchAiPreview";
import { getEnabledEffectCount } from "./lib/effectCardModel";
import { buildTimelineModel } from "./lib/timelineModel";
import { getActionTextConfig } from "./model/workbenchSchema";
import { useWorkbenchColumnLayout } from "./hooks/useWorkbenchColumnLayout";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useDesktopWorkbenchRuntime } from "./hooks/useDesktopWorkbenchRuntime";
import {
  WorkbenchToolbar,
  type WorkbenchHeaderProps,
  type WorkbenchHeaderRenderer,
} from "./components/WorkbenchChrome";
import {
  WorkbenchCommandPalette,
  type WorkbenchCommand,
} from "./components/WorkbenchCommandPalette";

const AiAssistantPanel = lazy(() => import("./components/AiAssistantPanel").then((module) => ({
  default: module.AiAssistantPanel,
})));
const AiSettingsDialog = lazy(() => import("./components/AiSettingsDialog").then((module) => ({
  default: module.AiSettingsDialog,
})));
const DiagnosticsPanel = lazy(() => import("./components/DiagnosticsPanel").then((module) => ({
  default: module.DiagnosticsPanel,
})));
const StatesPanel = lazy(() => import("./components/StatesPanel").then((module) => ({
  default: module.StatesPanel,
})));
const SiteRulesPanel = lazy(() => import("./components/SiteRulesPanel").then((module) => ({
  default: module.SiteRulesPanel,
})));
const AppRulesPanel = lazy(() => import("./components/AppRulesPanel").then((module) => ({
  default: module.AppRulesPanel,
})));
const KeyboardPanel = lazy(() => import("./components/KeyboardPanel").then((module) => ({
  default: module.KeyboardPanel,
})));

/**
 * 懒加载占位。原先是一个居中 spinner —— 那让整块面板在加载期间看起来像「空了」，
 * 而且面板出现时会跳版。骨架屏保留了「马上会出现什么形状」的信息。
 * 见 docs/ui-spec/library/components.html 的 Skeleton 一节。
 */
function DeferredPanelFallback({ label }: { label: string }) {
  return (
    <div className="h-full min-h-32" role="status" aria-label={label}>
      <PanelSkeleton rows={3} />
    </div>
  );
}
export default function ThemeWorkbenchPage({ renderHeader }: ThemeWorkbenchPageProps = {}) {
  return (
    <ToastProvider>
      <TooltipProvider>
        <ThemeWorkbenchPageContent renderHeader={renderHeader} />
      </TooltipProvider>
    </ToastProvider>
  );
}

interface ThemeWorkbenchPageProps {
  /** 桌面端注入自绘标题栏；扩展端不传，使用默认 WorkbenchHeader。 */
  renderHeader?: WorkbenchHeaderRenderer;
}

function ThemeWorkbenchPageContent({ renderHeader }: ThemeWorkbenchPageProps) {
  const toast = useToast();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [keyboardCaptureActive, setKeyboardCaptureActive] = useState(false);
  const {
    gridTemplateColumns,
    isResizing,
    layoutPreset,
    setLayoutPreset,
    startResizeColumns,
  } = useWorkbenchColumnLayout(aiPanelOpen);
  const {
    welcomeState,
    accessibilityAuthorized,
    activeWindowSnapshot,
    closeWelcome,
    openAccessibilitySettings,
    refreshActiveWindow,
  } = useDesktopWorkbenchRuntime();
  const {
    state,
    selected,
    themes,
    themeRecords,
    activeTheme,
    draft,
    currentActionConfig,
    currentConflicts,
    isWorkbench,
    undoStack,
    workspaceItems,
    actionItems,
    setWorkspaceId,
    setThemeId,
    setActionId,
    setCursorStateId,
    setEnabled,
    saveChanges,
    restoreAppliedChanges,
    createTheme,
    duplicateTheme,
    deleteTheme,
    exportTheme,
    importThemeFromText,
    renameTheme,
    updateThemeIcon,
    resetCurrentTheme,
    discardThemeChanges,
    addSiteRule,
    updateSiteRule,
    deleteSiteRule,
    reorderSiteRules,
    toggleSiteRule,
    clearAllSiteRules,
    addAppRule,
    updateAppRule,
    deleteAppRule,
    reorderAppRules,
    toggleAppRule,
    updateActionConfig,
    updateActionConfigs,
    updateAtmosphere,
    recentCursorAssets,
    rememberRecentCursorAsset,
    setCursorSkinEnabled,
    updateCursorSkinState,
    clearCursorSkinState,
    clearCursorSkinAssets,
    copyDefaultCursorSkinState,
    deriveCursorSkinStates,
    resetCursorSkin,
    keyFeedbackConfig,
    updateKeyFeedbackConfig,
  } = useThemeWorkbenchState();
  const {
    previewProposal,
    aiSnapshot,
    previewActionConfigsMap,
    setPreviewProposal,
    clearPreview,
    clearAiSnapshot,
    isPreviewingAction,
    applyProposal,
    revertAiChanges,
  } = useWorkbenchAiPreview({
    themeId: selected.themeId,
    actionConfigs: draft?.actionConfigs,
    updateActionConfigs,
    notify: toast,
  });
  const activeAppInfo = activeAppInfoFromSnapshot(activeWindowSnapshot);
  const contextAction = isDesktop()
    ? (activeAppInfo ? resolveAppRule(state.domain.appRules, activeAppInfo) : null)
    : getRuntimeConfig().resolveSiteRule(state.domain.siteRules, state.runtime.site.host);
  const previewActionConfig = previewActionConfigsMap?.[selected.actionId] || currentActionConfig;
  const previewTimeline = buildTimelineModel(previewActionConfig);
  const previewTextConfig = getActionTextConfig(previewActionConfig);
  const previewPlayback = usePreviewPlayback({
    actionId: selected.actionId,
    config: previewActionConfig,
    comboEnabled: previewTextConfig.comboEnabled === true,
    comboWindowMs: typeof previewTextConfig.comboWindowMs === "number" ? previewTextConfig.comboWindowMs : 900,
    disabled: contextAction === "disable",
    totalMs: previewTimeline.totalMs,
  });
  const isPreviewingAiProposal = isPreviewingAction(selected.actionId);
  const workbenchAtmosphere = isExtension() ? draft?.atmosphere : undefined;
  const activeWorkspace = workspaceItems.find((item) => item.id === state.editor.workspaceId);
  const themeScoped = activeWorkspace?.group === "personalization";

  // 撤销 / 重做：快捷键与工具栏按钮走同一条路径，不写两遍
  function runUndo() {
    const label = undoStack.undo(selected.themeId);
    // 没有可撤销的就如实说，而不是静默无反应
    toast(label
      ? { title: `已撤销：${label}`, tone: "info", undo: { label: "重做", run: runRedo } }
      : { title: "没有可撤销的改动", tone: "info" });
  }
  function runRedo() {
    const label = undoStack.redo(selected.themeId);
    toast(label
      ? { title: `已重做：${label}`, tone: "info", undo: { label: "撤销", run: runUndo } }
      : { title: "没有可重做的改动", tone: "info" });
  }

  // 快捷键（决策 #6）。必须挂在 hydration 早退**之前** —— hook 不能出现在条件返回之后。
  useGlobalShortcuts({
    onUndo: runUndo,
    onRedo: runRedo,
    onToggleAi: () => setAiPanelOpen((open) => !open),
    onWorkspace: setWorkspaceId,
    onCommandPalette: () => setCommandPaletteOpen(true),
    // ⌘N 仍不注册：新建主题的 composer 状态还封装在 ThemeLibrarySidebar 内部。
    // 这一批只接入已经有真实落点的命令，避免吞掉系统快捷键却没有结果。
  }, !keyboardCaptureActive);

  if (!state.status.isHydrated) {
    return <div className="h-dvh bg-slate-100" />;
  }

  async function handleSaveChanges() {
    const result = await saveChanges();
    if (result.ok) {
      toast({ tone: "success", title: "已应用到桌面" });
    } else {
      toast({ tone: "error", title: "保存失败", description: result.error || "请稍后重试。" });
    }
  }

  async function handleRestoreAppliedChanges() {
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

  function handleResetCurrentTheme() {
    resetCurrentTheme();
    toast({ tone: "info", title: "已恢复当前主题默认配置" });
  }

  function handleUpdateActionConfig(patch) {
    clearPreview();
    updateActionConfig(patch);
    if (patch && Object.prototype.hasOwnProperty.call(patch, "textColor")) {
      toast({ tone: "info", title: "已更新飘字颜色", description: patch.textColor });
    }
  }

  const headerProps: WorkbenchHeaderProps = {
    workspaceItems,
    workspaceId: state.editor.workspaceId,
    setWorkspaceId,
    themeName: activeTheme?.name || "当前主题",
    themeScoped,
    enabled: state.domain.enabled,
    setEnabled,
    unsaved: state.status.unsaved,
    undo: { run: runUndo, label: undoStack.undoLabel(selected.themeId) },
    redo: { run: runRedo, label: undoStack.redoLabel(selected.themeId) },
    isSaving: state.status.isSaving,
    saveError: state.status.saveError,
    saveChanges: () => { void handleSaveChanges(); },
    restoreAppliedChanges: () => { void handleRestoreAppliedChanges(); },
    resetCurrentTheme: handleResetCurrentTheme,
    aiPanelOpen,
    setAiPanelOpen,
    openAiSettings:
      typeof window !== "undefined" && window.cursorDanceAi
        ? () => setAiSettingsOpen(true)
        : undefined,
    layoutPreset,
    setLayoutPreset,
    openCommandPalette: () => setCommandPaletteOpen(true),
  };

  const commandPaletteCommands: WorkbenchCommand[] = [
    ...workspaceItems.map((item) => ({
      id: `workspace-${item.id}`,
      group: "工作区" as const,
      label: `切到${item.label}`,
      shortcut: `⌘${WORKSPACE_SHORTCUT_ORDER.indexOf(item.id as typeof WORKSPACE_SHORTCUT_ORDER[number]) + 1}`,
      run: () => setWorkspaceId(item.id),
    })),
    ...(state.status.unsaved ? [{
      id: "apply",
      group: "编辑" as const,
      label: themeScoped ? "应用到桌面" : "应用全局设置",
      keywords: ["保存", "发布"],
      run: () => { void handleSaveChanges(); },
    }, {
      id: "restore-applied",
      group: "编辑" as const,
      label: "恢复已应用版本",
      keywords: ["撤销草稿", "回退"],
      run: () => { void handleRestoreAppliedChanges(); },
    }] : []),
    ...(themeScoped ? [{
      id: "reset-theme",
      group: "编辑" as const,
      label: "恢复当前主题默认",
      run: handleResetCurrentTheme,
    }] : []),
    ...(undoStack.undoLabel(selected.themeId) ? [{
      id: "undo",
      group: "编辑" as const,
      label: `撤销：${undoStack.undoLabel(selected.themeId)}`,
      shortcut: "⌘Z",
      run: runUndo,
    }] : []),
    ...(undoStack.redoLabel(selected.themeId) ? [{
      id: "redo",
      group: "编辑" as const,
      label: `重做：${undoStack.redoLabel(selected.themeId)}`,
      shortcut: "⌘⇧Z",
      run: runRedo,
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

  return (
    <div
      className="h-dvh bg-slate-100 text-slate-900"
      style={{ fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif' }}
    >
      <div className="flex h-dvh overflow-hidden border border-slate-200 bg-white text-sm shadow-sm">
        <div className="flex min-w-0 flex-1 flex-col">
          {renderHeader ? renderHeader(headerProps) : <WorkbenchHeader {...headerProps} />}
          <WorkbenchToolbar {...headerProps} />
          <div className="flex min-h-0 flex-1">
            {themeScoped ? (
              <ThemeLibrarySidebar
                themes={themes}
                themeRecords={themeRecords}
                themeId={selected.themeId}
                setThemeId={setThemeId}
                createTheme={createTheme}
                duplicateTheme={duplicateTheme}
                deleteTheme={deleteTheme}
                exportTheme={exportTheme}
                importThemeFromText={importThemeFromText}
                renameTheme={renameTheme}
                updateThemeIcon={updateThemeIcon}
                notify={toast}
                dirtyThemes={state.status.dirtyThemes}
                saveChanges={saveChanges}
                discardThemeChanges={discardThemeChanges}
              />
            ) : null}

            <main className={cn("min-w-0 flex-1 overflow-hidden bg-slate-50", isWorkbench && "overflow-hidden")}>
              {isWorkbench ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="shrink-0 px-3 pt-3">
                    <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-sm">
                      <div role="tablist" aria-label="动作" className="-mx-1 flex gap-2 overflow-x-auto px-1">
                        {actionItems.map((action) => (
                          <WorkbenchActionTab
                            key={action.id}
                            item={action}
                            active={action.id === selected.actionId}
                            effectCount={getEnabledEffectCount(draft?.actionConfigs?.[action.id])}
                            onClick={() => setActionId(action.id)}
                          />
                        ))}
                      </div>

                      {currentConflicts.length ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          {currentConflicts[0]}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div
                    role="tabpanel"
                    aria-label={formatActionLabel(selected.actionId)}
                    className={cn(
                      "theme-workbench-columns grid min-h-0 flex-1 gap-1.5 px-3 pt-2.5",
                      !isResizing && "transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none",
                    )}
                    style={{ gridTemplateColumns }}
                  >
                    <div className="theme-effect-cards field-row-container min-h-0 min-w-0 overflow-y-auto pr-1">
                      <WorkbenchPanel
                        actionId={selected.actionId}
                        config={currentActionConfig}
                        resetConfig={draft?.resetActionConfigs?.[selected.actionId]}
                        updateActionConfig={handleUpdateActionConfig}
                        conflicts={currentConflicts}
                        atmosphere={workbenchAtmosphere}
                        updateAtmosphere={updateAtmosphere}
                      />
                    </div>

                    <div className="theme-workbench-column-separator">
                      <ColumnResizeHandle
                        label="调整配置列宽度"
                        onResize={(event) => startResizeColumns(event, "config")}
                      />
                    </div>

                    <div className="flex min-h-0 min-w-0">
                      <WorkbenchPreviewRail
                        actionId={selected.actionId}
                        config={previewActionConfig}
                        comparisonConfig={draft?.resetActionConfigs?.[selected.actionId]}
                        actionConfigsMap={previewActionConfigsMap}
                        disabled={contextAction === "disable"}
                        previewMode={isPreviewingAiProposal}
                        atmosphere={workbenchAtmosphere}
                        playback={previewPlayback}
                        totalMs={previewTimeline.totalMs}
                      />
                    </div>

                    {aiPanelOpen ? (
                      <>
                        <ColumnResizeHandle
                          label="调整实时预览和 AI 助手宽度"
                          onResize={(event) => startResizeColumns(event, "ai")}
                        />

                        <div className="relative flex min-h-0 min-w-0">
                          <Suspense fallback={<DeferredPanelFallback label="正在加载 AI 助手…" />}>
                            <AiAssistantPanel
                              actionId={selected.actionId}
                              actionLabel={formatActionLabel(selected.actionId)}
                              currentConfig={currentActionConfig}
                              actionConfigs={draft.actionConfigs}
                              applyActionConfig={handleUpdateActionConfig}
                              applyProposal={applyProposal}
                              previewProposal={previewProposal}
                              onPreviewProposal={setPreviewProposal}
                              onClearPreview={clearPreview}
                              notify={toast}
                              aiSnapshot={aiSnapshot}
                              onRevertAiChanges={revertAiChanges}
                              onClearAiSnapshot={clearAiSnapshot}
                              onOpenAiSettings={headerProps.openAiSettings}
                              variant="full"
                            />
                          </Suspense>
                        </div>
                      </>
                    ) : null}
                  </div>
                  <PreviewTimeline
                    tracks={previewTimeline.tracks}
                    totalMs={previewTimeline.totalMs}
                    disabled={contextAction === "disable"}
                    canEditEmptyState={!isPreviewingAiProposal && contextAction !== "disable"}
                    updateActionConfig={handleUpdateActionConfig}
                    currentTimeMs={previewPlayback.currentTimeMs}
                    onSeek={previewPlayback.seek}
                  />
                </div>
              ) : null}

              {state.editor.workspaceId === "states" ? (
                <div className="h-full overflow-y-auto pr-1">
                  <Suspense fallback={<DeferredPanelFallback label="正在加载光标皮肤…" />}>
                    <StatesPanel
                      stateId={selected.cursorStateId}
                      setStateId={setCursorStateId}
                      cursorSkin={draft.cursorSkin}
                      setCursorSkinEnabled={setCursorSkinEnabled}
                      notify={toast}
                      recentCursorAssets={recentCursorAssets}
                      updateCursorSkinState={updateCursorSkinState}
                      clearCursorSkinState={clearCursorSkinState}
                      clearCursorSkinAssets={clearCursorSkinAssets}
                      copyDefaultCursorSkinState={copyDefaultCursorSkinState}
                      deriveCursorSkinStates={deriveCursorSkinStates}
                      resetCursorSkin={resetCursorSkin}
                      atmosphere={draft.atmosphere}
                      updateAtmosphere={updateAtmosphere}
                      rememberRecentCursorAsset={rememberRecentCursorAsset}
                    />
                  </Suspense>
                </div>
              ) : null}

              {state.editor.workspaceId === "sites" ? (
                <div className={isDesktop() ? "h-full" : "h-full overflow-y-auto pr-1"}>
                  <Suspense fallback={<DeferredPanelFallback label="正在加载应用规则…" />}>
                    {isDesktop() ? (
                      <AppRulesPanel
                        appRules={state.domain.appRules}
                        themes={themes}
                        activeThemeId={state.domain.activeThemeId}
                        globalEnabled={state.domain.enabled}
                        activeApp={activeWindowSnapshot}
                        openAccessibilitySettings={openAccessibilitySettings}
                        refreshActiveApp={refreshActiveWindow}
                        openDiagnostics={() => setWorkspaceId("diagnostics")}
                        notify={toast}
                        setGlobalEnabled={setEnabled}
                        addAppRule={addAppRule}
                        updateAppRule={updateAppRule}
                        deleteAppRule={deleteAppRule}
                        reorderAppRules={reorderAppRules}
                        toggleAppRule={toggleAppRule}
                      />
                    ) : (
                      <SiteRulesPanel
                        siteRules={state.domain.siteRules}
                        themes={themes}
                        activeHost={state.runtime.site.host}
                        addSiteRule={addSiteRule}
                        updateSiteRule={updateSiteRule}
                        deleteSiteRule={deleteSiteRule}
                        reorderSiteRules={reorderSiteRules}
                        toggleSiteRule={toggleSiteRule}
                        clearAllSiteRules={clearAllSiteRules}
                      />
                    )}
                  </Suspense>
                </div>
              ) : null}

              {state.editor.workspaceId === "diagnostics" ? (
                <div className="h-full overflow-y-auto">
                  <Suspense fallback={<DeferredPanelFallback label="正在加载诊断面板…" />}>
                    <DiagnosticsPanel
                      selectedThemeId={selected.themeId}
                      themeName={activeTheme?.name}
                      accessibilityAuthorized={accessibilityAuthorized}
                      activeApp={activeWindowSnapshot}
                    />
                  </Suspense>
                </div>
              ) : null}

              {state.editor.workspaceId === "keyboard" ? (
                <Suspense fallback={<DeferredPanelFallback label="正在加载键盘动效…" />}>
                  <KeyboardPanel
                    config={keyFeedbackConfig}
                    accessibilityAuthorized={accessibilityAuthorized}
                    onOpenAccessibilitySettings={openAccessibilitySettings}
                    onCaptureChange={setKeyboardCaptureActive}
                    onUpdate={(patch) => updateKeyFeedbackConfig(patch)}
                  />
                </Suspense>
              ) : null}
            </main>
          </div>
        </div>
      </div>
      {welcomeState === "open" && isDesktop() ? (
        <WelcomeDialog
          open
          onClose={closeWelcome}
          platform={(window.electronAPI?.platform || "darwin") as NodeJS.Platform}
          needsAccessibility={accessibilityAuthorized === false}
          onOpenAccessibilitySettings={openAccessibilitySettings}
        />
      ) : null}
      {aiSettingsOpen && typeof window !== "undefined" && window.cursorDanceAi ? (
        <Suspense fallback={null}>
          <AiSettingsDialog open onClose={() => setAiSettingsOpen(false)} />
        </Suspense>
      ) : null}
      <WorkbenchCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        commands={commandPaletteCommands}
      />
    </div>
  );
}
