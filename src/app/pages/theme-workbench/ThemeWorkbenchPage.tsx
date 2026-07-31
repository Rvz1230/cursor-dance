import { formatActionLabel } from "./model/workbenchSchema";
import { lazy, Suspense, useState } from "react";
import { useThemeWorkbenchState } from "./hooks/useThemeWorkbenchState";
import { WorkbenchHeader } from "./components/WorkbenchHeader";
import { ActionTab, ColumnResizeHandle } from "./components/WorkbenchControls";
import { WorkbenchPanel } from "./components/WorkbenchPanel";
import { WorkbenchPreviewRail } from "./components/WorkbenchPreviewRail";
import { getRuntimeConfig } from "./lib/runtimeConfig";
import { ThemeLibrarySidebar } from "./components/ThemeLibrarySidebar";
import { WelcomeDialog } from "./components/WelcomeDialog";
import { cn } from "@/components/ui/utils";
import { Loader2 } from "lucide-react";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isDesktop, isExtension } from "@/shared/runtime";
import {
  activeAppInfoFromSnapshot,
  resolveAppRule,
} from "@/shared/app-rules";
import { useWorkbenchAiPreview } from "./hooks/useWorkbenchAiPreview";
import { useWorkbenchColumnLayout } from "./hooks/useWorkbenchColumnLayout";
import { useDesktopWorkbenchRuntime } from "./hooks/useDesktopWorkbenchRuntime";
import {
  DesktopWorkbenchToolbar,
  type WorkbenchHeaderProps,
  type WorkbenchHeaderRenderer,
} from "./components/WorkbenchChrome";

const AiSchemePanel = lazy(() => import("./components/AiSchemePanel").then((module) => ({
  default: module.AiSchemePanel,
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

function DeferredPanelFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center text-xs text-slate-500" role="status">
      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
      {label}
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
  const { gridTemplateColumns, startResizeColumns } = useWorkbenchColumnLayout(aiPanelOpen);
  const {
    welcomeState,
    accessibilityAuthorized,
    activeWindowSnapshot,
    closeWelcome,
    openAccessibilitySettings,
  } = useDesktopWorkbenchRuntime();
  const {
    state,
    selected,
    themes,
    activeTheme,
    draft,
    currentActionConfig,
    currentConflicts,
    isWorkbench,
    workspaceItems,
    actionItems,
    setWorkspaceId,
    setThemeId,
    setActionId,
    setCursorStateId,
    setEnabled,
    saveChanges,
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
    clearAllAppRules,
    updateActionConfig,
    updateActionConfigs,
    updateAtmosphere,
    updateCursorStateAsset,
    updateCursorStateAssetForState,
    recentCursorAssets,
    rememberRecentCursorAsset,
    updateCursorSkinState,
    clearCursorSkinState,
    copyDefaultCursorSkinState,
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
  const previewActionConfig = previewActionConfigsMap?.[selected.actionId] || currentActionConfig;
  const isPreviewingAiProposal = isPreviewingAction(selected.actionId);
  const activeAppInfo = activeAppInfoFromSnapshot(activeWindowSnapshot);
  const workbenchAtmosphere = isExtension() ? draft?.atmosphere : undefined;
  const contextAction = isDesktop()
    ? (activeAppInfo ? resolveAppRule(state.appRules, activeAppInfo) : null)
    : getRuntimeConfig().resolveSiteRule(state.siteRules, state.site.host);

  if (!state.ui.isHydrated) {
    return <div className="h-dvh bg-slate-100" />;
  }

  async function handleSaveChanges() {
    const result = await saveChanges();
    if (result.ok) {
      toast({ tone: "success", title: "已保存到扩展配置" });
    } else {
      toast({ tone: "error", title: "保存失败", description: result.error || "请稍后重试。" });
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
    workspaceId: state.workspaceId,
    setWorkspaceId,
    enabled: state.ui.enabled,
    setEnabled,
    unsaved: state.ui.unsaved,
    isSaving: state.ui.isSaving,
    saveError: state.ui.saveError,
    saveChanges: () => { void handleSaveChanges(); },
    resetCurrentTheme: handleResetCurrentTheme,
    aiPanelOpen,
    setAiPanelOpen,
    openAiSettings:
      typeof window !== "undefined" && window.cursorDanceAi
        ? () => setAiSettingsOpen(true)
        : undefined,
  };

  return (
    <div
      className="h-dvh bg-slate-100 text-slate-900"
      style={{ fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif' }}
    >
      <div className="flex h-dvh overflow-hidden border border-slate-200 bg-white text-sm shadow-sm">
        <div className="flex min-w-0 flex-1 flex-col">
          {renderHeader ? (
            <>
              {renderHeader(headerProps)}
              <DesktopWorkbenchToolbar {...headerProps} />
            </>
          ) : (
            <WorkbenchHeader {...headerProps} />
          )}
          <div className="flex min-h-0 flex-1">
            <ThemeLibrarySidebar
              themes={themes}
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
              dirtyThemes={state.ui.dirtyThemes}
              saveChanges={saveChanges}
              discardThemeChanges={discardThemeChanges}
            />

            <main className={cn("min-w-0 flex-1 overflow-hidden bg-slate-50 px-2.5 py-2.5", isWorkbench && "overflow-hidden")}>
              {isWorkbench ? (
                <div
                  className={cn(
                    "grid h-full min-h-0 w-full gap-1"
                  )}
                  style={{
                    gridTemplateColumns,
                  }}
                >
                  <div className="min-w-0 min-h-0">
                    <div className="flex h-full min-h-0 flex-col gap-2.5">
                      <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-sm">
                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                          {actionItems.map((action) => (
                            <ActionTab key={action.id} item={action} active={action.id === selected.actionId} onClick={() => setActionId(action.id)} />
                          ))}
                        </div>

                        {currentConflicts.length ? (
                          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            {currentConflicts[0]}
                          </div>
                        ) : null}
                      </div>

                      <div className="field-row-container min-h-0 overflow-y-auto pr-1">
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
                    </div>
                  </div>

                  <ColumnResizeHandle
                    label="调整配置列宽度"
                    onResize={(event) => startResizeColumns(event, "config")}
                  />

                  <div className="flex min-w-0 h-full min-h-0">
                    <WorkbenchPreviewRail
                      actionId={selected.actionId}
                      config={previewActionConfig}
                      actionConfigsMap={previewActionConfigsMap}
                      disabled={contextAction === "disable"}
                      previewMode={isPreviewingAiProposal}
                      updateActionConfig={updateActionConfig}
                      atmosphere={workbenchAtmosphere}
                    />
                  </div>

                  {aiPanelOpen ? (
                    <>
                      <ColumnResizeHandle
                        label="调整实时预览和 AI 助手宽度"
                        onResize={(event) => startResizeColumns(event, "ai")}
                      />

                      <div className="relative flex min-w-0 h-full min-h-0">
                        <Suspense fallback={<DeferredPanelFallback label="正在加载 AI 助手…" />}>
                          <AiSchemePanel
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
              ) : null}

              {state.workspaceId === "states" ? (
                <div className="h-full overflow-y-auto pr-1">
                  <Suspense fallback={<DeferredPanelFallback label="正在加载光标皮肤…" />}>
                    <StatesPanel
                      stateId={selected.cursorStateId}
                      setStateId={setCursorStateId}
                      cursorSkin={draft.cursorSkin}
                      recentCursorAssets={recentCursorAssets}
                      updateCursorSkinState={updateCursorSkinState}
                      clearCursorSkinState={clearCursorSkinState}
                      copyDefaultCursorSkinState={copyDefaultCursorSkinState}
                      resetCursorSkin={resetCursorSkin}
                      updateCursorStateAsset={updateCursorStateAsset}
                      updateCursorStateAssetForState={updateCursorStateAssetForState}
                      rememberRecentCursorAsset={rememberRecentCursorAsset}
                    />
                  </Suspense>
                </div>
              ) : null}

              {state.workspaceId === "sites" ? (
                <div className="h-full overflow-y-auto pr-1">
                  <Suspense fallback={<DeferredPanelFallback label="正在加载应用规则…" />}>
                    {isDesktop() ? (
                      <AppRulesPanel
                        appRules={state.appRules}
                        themes={themes}
                        activeApp={activeWindowSnapshot}
                        openAccessibilitySettings={openAccessibilitySettings}
                        addAppRule={addAppRule}
                        updateAppRule={updateAppRule}
                        deleteAppRule={deleteAppRule}
                        reorderAppRules={reorderAppRules}
                        toggleAppRule={toggleAppRule}
                        clearAllAppRules={clearAllAppRules}
                      />
                    ) : (
                      <SiteRulesPanel
                        siteRules={state.siteRules}
                        themes={themes}
                        activeHost={state.site.host}
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

              {state.workspaceId === "diagnostics" ? (
                <div className="h-full overflow-y-auto pr-1">
                  <Suspense fallback={<DeferredPanelFallback label="正在加载诊断面板…" />}>
                    <DiagnosticsPanel selectedThemeId={selected.themeId} />
                  </Suspense>
                </div>
              ) : null}

              {state.workspaceId === "keyboard" ? (
                <Suspense fallback={<DeferredPanelFallback label="正在加载键盘动效…" />}>
                  <KeyboardPanel
                    config={keyFeedbackConfig}
                    themeName={activeTheme?.name}
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
    </div>
  );
}
