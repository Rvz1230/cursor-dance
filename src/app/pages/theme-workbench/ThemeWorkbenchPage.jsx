import { formatActionLabel } from "./model/workbenchSchema.js";
import { useEffect, useState } from "react";
import { useThemeWorkbenchState } from "./hooks/useThemeWorkbenchState.js";
import { BindingsPanel } from "./components/BindingsPanel.jsx";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel.jsx";
import { SitesPanel } from "./components/SitesPanel.jsx";
import { StatesPanel } from "./components/StatesPanel.jsx";
import { WorkbenchHeader } from "./components/WorkbenchHeader.jsx";
import { AiSchemePanel } from "./components/AiSchemePanel.jsx";
import { getAiProposalNextConfigForAction } from "./lib/aiSchemeAssistant.js";
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
  const [aiPanelWidth, setAiPanelWidth] = useState(420);
  const [previewProposal, setPreviewProposal] = useState(null);
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
    updateActionConfigs,
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
  const previewActionConfig = getAiProposalNextConfigForAction(previewProposal, selected.actionId, currentActionConfig);

  useEffect(() => {
    setPreviewProposal(null);
  }, [selected.actionId, selected.themeId]);

  function startResizeAiPanel(event) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = aiPanelWidth;

    function handlePointerMove(moveEvent) {
      const nextWidth = Math.min(620, Math.max(360, startWidth + moveEvent.clientX - startX));
      setAiPanelWidth(nextWidth);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
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
    setPreviewProposal(null);
    updateActionConfig(patch);
    if (patch && Object.prototype.hasOwnProperty.call(patch, "textColor")) {
      toast({ tone: "info", title: "已更新飘字颜色", description: patch.textColor });
    }
  }

  function handleApplyAiProposal(proposal) {
    const patchesByActionId = Object.fromEntries(
      (proposal?.targets || [])
        .filter((target) => target.type === "action" && target.actionId && Object.keys(target.patch || {}).length)
        .map((target) => [target.actionId, target.patch])
    );
    setPreviewProposal(null);
    updateActionConfigs(patchesByActionId);
  }

  return (
    <div
      className="h-dvh bg-slate-100 text-slate-900"
      style={{ fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif' }}
    >
      <div className="flex h-dvh overflow-hidden border border-slate-200 bg-white text-[13px] shadow-sm">
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

            <main className={cn("min-w-0 flex-1 overflow-y-auto bg-slate-50 px-2.5 py-2.5", isWorkbench && "overflow-auto")}>
              {isWorkbench ? (
                <div
                  className={cn(
                    "grid h-full min-h-[680px] gap-2.5",
                    aiPanelOpen ? "min-w-[1120px]" : "min-w-[920px]"
                  )}
                  style={{
                    gridTemplateColumns: aiPanelOpen
                      ? `minmax(380px, 480px) minmax(420px, 1fr) ${aiPanelWidth}px`
                      : "minmax(460px, 560px) minmax(420px, 1fr)",
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

                      <div className="min-h-0 overflow-y-auto pr-1">
                        <WorkbenchPanel
                          actionId={selected.actionId}
                          config={currentActionConfig}
                          updateActionConfig={handleUpdateActionConfig}
                          conflicts={currentConflicts}
                        />
                      </div>
                    </div>
                  </div>

                  {!aiPanelOpen ? (
                    <div className="flex min-w-0 h-full min-h-0">
                      <WorkbenchPreviewRail
                        actionLabel={formatActionLabel(selected.actionId)}
                        config={previewActionConfig || currentActionConfig}
                        siteMode={state.siteMode}
                        previewMode={Boolean(previewActionConfig)}
                      />
                    </div>
                  ) : (
                    <div className="flex min-w-0 h-full min-h-0">
                      <WorkbenchPreviewRail
                        actionLabel={formatActionLabel(selected.actionId)}
                        config={previewActionConfig || currentActionConfig}
                        siteMode={state.siteMode}
                        previewMode={Boolean(previewActionConfig)}
                      />
                    </div>
                  )}

                  {aiPanelOpen ? (
                    <div className="relative flex min-w-0 h-full min-h-0">
                      <button
                        type="button"
                        className="absolute -left-1.5 top-3 z-10 h-12 w-3 cursor-col-resize rounded-full bg-slate-200/80 transition-colors hover:bg-slate-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                        aria-label="调整 AI 助手宽度"
                        onPointerDown={startResizeAiPanel}
                      />
                      <AiSchemePanel
                        actionId={selected.actionId}
                        actionLabel={formatActionLabel(selected.actionId)}
                        currentConfig={currentActionConfig}
                        applyActionConfig={handleUpdateActionConfig}
                        applyProposal={handleApplyAiProposal}
                        previewProposal={previewProposal}
                        onPreviewProposal={setPreviewProposal}
                        onClearPreview={() => setPreviewProposal(null)}
                        notify={toast}
                        variant="full"
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
