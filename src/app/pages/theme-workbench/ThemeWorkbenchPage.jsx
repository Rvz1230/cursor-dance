import { formatActionLabel } from "./model/workbenchSchema.js";
import { useState } from "react";
import { useThemeWorkbenchState } from "./hooks/useThemeWorkbenchState.js";
import { BindingsPanel } from "./components/BindingsPanel.jsx";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel.jsx";
import { SitesPanel } from "./components/SitesPanel.jsx";
import { StatesPanel } from "./components/StatesPanel.jsx";
import { WorkbenchHeader } from "./components/WorkbenchHeader.jsx";
import { AiSchemePanel } from "./components/AiSchemePanel.jsx";
import { ActionTab } from "./components/WorkbenchControls.jsx";
import { WorkbenchPanel } from "./components/WorkbenchPanel.jsx";
import { WorkbenchPreviewRail } from "./components/WorkbenchPreviewRail.jsx";
import { ThemeLibrarySidebar } from "./components/ThemeLibrarySidebar.jsx";
import { cn } from "@/components/ui/utils.js";
import { ToastProvider, useToast } from "@/components/ui/toast.jsx";

export default function ThemeWorkbenchPage() {
  return (
    <ToastProvider>
      <ThemeWorkbenchPageContent />
    </ToastProvider>
  );
}

function ThemeWorkbenchPageContent() {
  const toast = useToast();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
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
    resetCurrentTheme,
    setSiteFilter,
    updateActionConfig,
    updateCursorMode,
    updateCursorStateAction,
    updateCursorStateAsset,
    updateCursorStateAssetForState,
    recentCursorAssets,
    rememberRecentCursorAsset,
    copyDefaultCursorStateAsset,
    resetCurrentCursorState,
    resetAllCursorStates,
    setSiteMode,
    setSiteThemeId,
    clearAllSiteRules,
    clearFilteredSiteRules,
  } = useThemeWorkbenchState();
  const currentWorkspace = workspaceItems.find((item) => item.id === state.workspaceId);

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
    updateActionConfig(patch);
    if (patch && Object.prototype.hasOwnProperty.call(patch, "textColor")) {
      toast({ tone: "info", title: "已更新飘字颜色", description: patch.textColor });
    }
  }

  return (
    <div
      className="min-h-dvh bg-slate-100 p-3 text-slate-900"
      style={{ fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif' }}
    >
      <div className="mx-auto flex h-[calc(100dvh-1.5rem)] max-w-[1600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex min-w-0 flex-1 flex-col">
          <WorkbenchHeader
            workspaceItems={workspaceItems}
            workspaceId={state.workspaceId}
            setWorkspaceId={setWorkspaceId}
            enabled={state.ui.enabled}
            setEnabled={setEnabled}
            unsaved={state.ui.unsaved}
            isSaving={state.ui.isSaving}
            saveError={state.ui.saveError}
            saveChanges={handleSaveChanges}
            resetCurrentTheme={handleResetCurrentTheme}
            aiPanelOpen={aiPanelOpen}
            setAiPanelOpen={setAiPanelOpen}
          />

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
              notify={toast}
            />

            <main className={cn("min-w-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-3", isWorkbench && "xl:overflow-hidden")}>
              {isWorkbench ? (
                <div
                  className={cn(
                    "flex min-h-0 flex-col gap-3 xl:grid xl:h-full",
                    aiPanelOpen
                      ? "xl:grid-cols-[minmax(460px,1fr)_400px] 2xl:grid-cols-[minmax(560px,1fr)_440px]"
                      : "xl:grid-cols-[520px_minmax(0,1fr)] 2xl:grid-cols-[560px_minmax(0,1fr)]"
                  )}
                >
                  <div className="min-w-0 xl:min-h-0">
                    <div className="flex flex-col gap-3 xl:h-full xl:min-h-0">
                      <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
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

                      <div className={cn("xl:min-h-0 xl:overflow-y-auto xl:pr-1", aiPanelOpen && "xl:flex-[1_1_0]")}>
                        <WorkbenchPanel
                          actionId={selected.actionId}
                          config={currentActionConfig}
                          updateActionConfig={handleUpdateActionConfig}
                          conflicts={currentConflicts}
                        />
                      </div>
                      {aiPanelOpen ? (
                        <div className="min-h-[300px] shrink-0 xl:h-[38%]">
                          <WorkbenchPreviewRail
                            actionLabel={formatActionLabel(selected.actionId)}
                            config={currentActionConfig}
                            siteMode={state.siteMode}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {!aiPanelOpen ? (
                    <div className="hidden min-w-0 xl:flex xl:h-full xl:min-h-0">
                      <WorkbenchPreviewRail
                        actionLabel={formatActionLabel(selected.actionId)}
                        config={currentActionConfig}
                        siteMode={state.siteMode}
                      />
                    </div>
                  ) : null}

                  {aiPanelOpen ? (
                    <div className="flex min-w-0 xl:h-full xl:min-h-0">
                      <AiSchemePanel
                        actionId={selected.actionId}
                        actionLabel={formatActionLabel(selected.actionId)}
                        currentConfig={currentActionConfig}
                        applyActionConfig={handleUpdateActionConfig}
                        notify={toast}
                        variant="full"
                      />
                    </div>
                  ) : null}

                  {!aiPanelOpen ? (
                    <div className="flex min-w-0 xl:hidden">
                      <WorkbenchPreviewRail
                        actionLabel={formatActionLabel(selected.actionId)}
                        config={currentActionConfig}
                        siteMode={state.siteMode}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {state.workspaceId === "bindings" ? (
                <BindingsPanel
                  actionConfigs={draft.actionConfigs}
                  actionId={selected.actionId}
                  setActionId={setActionId}
                  currentConflicts={currentConflicts}
                />
              ) : null}

              {state.workspaceId === "states" ? (
                <StatesPanel
                  stateId={selected.cursorStateId}
                  setStateId={setCursorStateId}
                  cursorModes={draft.cursorModes}
                  cursorStateActions={draft.cursorStateActions}
                  cursorStateAssets={draft.cursorStateAssets}
                  recentCursorAssets={recentCursorAssets}
                  actionItems={actionItems}
                  updateCursorMode={updateCursorMode}
                  updateCursorStateAction={updateCursorStateAction}
                  updateCursorStateAsset={updateCursorStateAsset}
                  updateCursorStateAssetForState={updateCursorStateAssetForState}
                  rememberRecentCursorAsset={rememberRecentCursorAsset}
                  copyDefaultCursorStateAsset={copyDefaultCursorStateAsset}
                  resetCurrentCursorState={resetCurrentCursorState}
                  resetAllCursorStates={resetAllCursorStates}
                />
              ) : null}

              {state.workspaceId === "sites" ? (
                <SitesPanel
                  filter={state.ui.siteFilter}
                  setFilter={setSiteFilter}
                  siteMode={state.siteMode}
                  setSiteMode={setSiteMode}
                  siteThemeId={state.siteThemeId}
                  setSiteThemeId={setSiteThemeId}
                  themes={themes}
                  activeThemeName={activeTheme.name}
                  activeHost={state.site.host}
                  isSupportedPage={state.site.isSupportedPage}
                  siteRulesByHost={state.siteRulesByHost}
                  clearAllSiteRules={clearAllSiteRules}
                  clearFilteredSiteRules={clearFilteredSiteRules}
                />
              ) : null}

              {state.workspaceId === "diagnostics" ? (
                <DiagnosticsPanel
                  workspaceLabel={currentWorkspace?.label || "诊断面板"}
                  themeName={activeTheme.name}
                  selectedThemeId={selected.themeId}
                  actionId={selected.actionId}
                  site={state.site}
                  enabled={state.ui.enabled}
                  unsaved={state.ui.unsaved}
                />
              ) : null}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
