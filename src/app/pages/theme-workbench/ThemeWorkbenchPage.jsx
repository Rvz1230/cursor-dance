import { formatActionLabel } from "./model/workbenchSchema.js";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useThemeWorkbenchState } from "./hooks/useThemeWorkbenchState.js";
import { BindingsPanel } from "./components/BindingsPanel.jsx";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel.jsx";
import { SiteRulesPanel } from "./components/SiteRulesPanel.jsx";
import { StatesPanel } from "./components/StatesPanel.jsx";
import { WorkbenchHeader } from "./components/WorkbenchHeader.jsx";
import { AiSchemePanel } from "./components/AiSchemePanel.jsx";
import { getAiProposalNextConfigForAction } from "./lib/aiSchemeAssistant.js";
import { ActionTab, ColumnResizeHandle } from "./components/WorkbenchControls.jsx";
import { WorkbenchPanel } from "./components/WorkbenchPanel.jsx";
import { WorkbenchPreviewRail } from "./components/WorkbenchPreviewRail.jsx";
import { getRuntimeConfig } from "./lib/runtimeConfig.js";
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
  const [columnWeights, setColumnWeights] = useState({ config: 1.05, preview: 1.25, ai: 1 });
  const [previewProposal, setPreviewProposal] = useState(null);
  const [aiSnapshot, setAiSnapshot] = useState(null);
  const conversationCache = useRef(new Map());
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
  } = useThemeWorkbenchState();
  const currentWorkspace = workspaceItems.find((item) => item.id === state.workspaceId);
  const previewActionConfig = getAiProposalNextConfigForAction(previewProposal, selected.actionId, currentActionConfig);
  const siteAction = getRuntimeConfig().resolveSiteRule(state.siteRules, state.site.host);

  useEffect(() => {
    setPreviewProposal(null);
  }, [selected.actionId, selected.themeId]);

  function startResizeColumns(event, column) {
    event.preventDefault();
    const startX = event.clientX;
    const startWeights = columnWeights;

    function handlePointerMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX;
      const deltaWeight = deltaX / 180;
      if (column === "config") {
        const nextConfig = Math.min(1.8, Math.max(0.78, startWeights.config + deltaWeight));
        const nextPreview = Math.min(1.9, Math.max(0.78, startWeights.preview - (nextConfig - startWeights.config)));
        setColumnWeights((current) => ({ ...current, config: nextConfig, preview: nextPreview }));
        return;
      }

      const nextAi = Math.min(1.9, Math.max(0.8, startWeights.ai - deltaWeight));
      const nextPreview = Math.min(1.9, Math.max(0.78, startWeights.preview - (nextAi - startWeights.ai)));
      setColumnWeights((current) => ({ ...current, preview: nextPreview, ai: nextAi }));
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
    const snapshot = Object.fromEntries(
      Object.keys(patchesByActionId).map((actionId) => [actionId, { ...draft.actionConfigs[actionId] }])
    );
    setAiSnapshot(snapshot);
    setPreviewProposal(null);
    updateActionConfigs(patchesByActionId);
  }

  function handleRevertAiChanges() {
    if (!aiSnapshot) return;
    updateActionConfigs(aiSnapshot);
    setAiSnapshot(null);
    toast({ tone: "info", title: "已撤销 AI 改动", description: "配置已恢复到应用 AI 方案之前的状态。" });
  }

  return (
    <div
      className="h-dvh bg-slate-100 text-slate-900"
      style={{ fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif' }}
    >
      <div className="flex h-dvh overflow-hidden border border-slate-200 bg-white text-sm shadow-sm">
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
                    gridTemplateColumns: aiPanelOpen
                      ? `minmax(0,${columnWeights.config}fr) 4px minmax(0,${columnWeights.preview}fr) 4px minmax(0,${columnWeights.ai}fr)`
                      : `minmax(0,${columnWeights.config}fr) 4px minmax(0,${columnWeights.preview}fr)`,
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

                  <ColumnResizeHandle
                    label="调整配置列宽度"
                    onResize={(event) => startResizeColumns(event, "config")}
                  />

                  <div className="flex min-w-0 h-full min-h-0">
                    <WorkbenchPreviewRail
                      actionLabel={formatActionLabel(selected.actionId)}
                      actionId={selected.actionId}
                      config={previewActionConfig || currentActionConfig}
                      disabled={siteAction === "disable"}
                      previewMode={Boolean(previewActionConfig)}
                      updateActionConfig={updateActionConfig}
                    />
                  </div>

                  {aiPanelOpen ? (
                    <>
                      <ColumnResizeHandle
                        label="调整实时预览和 AI 助手宽度"
                        onResize={(event) => startResizeColumns(event, "ai")}
                      />

                      <AnimatePresence>
                        <motion.div
                          className="relative flex min-w-0 h-full min-h-0"
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: "auto", opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                        >
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
                            aiSnapshot={aiSnapshot}
                            onRevertAiChanges={handleRevertAiChanges}
                            onClearAiSnapshot={() => setAiSnapshot(null)}
                            conversationCache={conversationCache}
                            variant="full"
                          />
                        </motion.div>
                      </AnimatePresence>
                    </>
                  ) : null}

                </div>
              ) : null}

              {state.workspaceId === "bindings" ? (
                <div className="h-full overflow-y-auto pr-1">
                  <BindingsPanel
                    actionConfigs={draft.actionConfigs}
                    actionId={selected.actionId}
                    setActionId={setActionId}
                    currentConflicts={currentConflicts}
                  />
                </div>
              ) : null}

              {state.workspaceId === "states" ? (
                <div className="h-full overflow-y-auto pr-1">
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
                </div>
              ) : null}

              {state.workspaceId === "sites" ? (
                <div className="h-full overflow-y-auto pr-1">
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
                </div>
              ) : null}

              {state.workspaceId === "diagnostics" ? (
                <div className="h-full overflow-y-auto pr-1">
                  <DiagnosticsPanel
                    selectedThemeId={selected.themeId}
                  />
                </div>
              ) : null}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
