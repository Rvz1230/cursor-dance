import { formatActionLabel } from "./model/workbenchSchema.js";
import { useThemeWorkbenchState } from "./hooks/useThemeWorkbenchState.js";
import { BindingsPanel } from "./components/BindingsPanel.jsx";
import { SitesPanel } from "./components/SitesPanel.jsx";
import { StatesPanel } from "./components/StatesPanel.jsx";
import { WorkbenchHeader } from "./components/WorkbenchHeader.jsx";
import { ActionTab } from "./components/WorkbenchControls.jsx";
import { WorkbenchPanel } from "./components/WorkbenchPanel.jsx";
import { WorkbenchPreviewRail } from "./components/WorkbenchPreviewRail.jsx";
import { ThemeLibrarySidebar } from "./components/ThemeLibrarySidebar.jsx";
import { cn } from "@/components/ui/utils.js";

export default function ThemeWorkbenchPage() {
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
    previewActiveTheme,
    createTheme,
    importThemeFromText,
    resetCurrentTheme,
    setSiteFilter,
    updateActionConfig,
    updateCursorMode,
    updateCursorStateAction,
    updateCursorStateAsset,
    recentCursorAssets,
    rememberRecentCursorAsset,
    copyDefaultCursorStateAsset,
    resetCurrentCursorState,
    resetAllCursorStates,
    setSiteMode,
    clearAllSiteRules,
    clearFilteredSiteRules,
  } = useThemeWorkbenchState();

  return (
    <div
      className="min-h-dvh bg-[#edf1f5] p-4 text-slate-900"
      style={{ fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif' }}
    >
      <div className="mx-auto flex h-[calc(100dvh-2rem)] max-w-[1580px] overflow-hidden rounded-[32px] border border-slate-200/90 bg-[#f8fafc] shadow-sm">
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
            saveChanges={saveChanges}
            previewActiveTheme={previewActiveTheme}
            resetCurrentTheme={resetCurrentTheme}
          />

          <div className="flex min-h-0 flex-1">
            <ThemeLibrarySidebar
              themes={themes}
              themeId={selected.themeId}
              setThemeId={setThemeId}
              createTheme={createTheme}
              importThemeFromText={importThemeFromText}
            />

            <main className={cn("min-w-0 flex-1 overflow-y-auto bg-[#f6f8fb] px-4 py-4", isWorkbench && "xl:overflow-hidden")}>
              {isWorkbench ? (
                <div className="flex min-h-0 flex-col gap-3 xl:grid xl:h-full xl:grid-cols-[minmax(0,1fr)_376px]">
                  <div className="min-w-0 xl:min-h-0">
                    <div className="flex flex-col gap-3 xl:h-full xl:min-h-0">
                      <div className="shrink-0 rounded-[28px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
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

                      <div className="xl:min-h-0 xl:overflow-y-auto xl:pr-1">
                        <WorkbenchPanel
                          actionId={selected.actionId}
                          config={currentActionConfig}
                          updateActionConfig={updateActionConfig}
                          conflicts={currentConflicts}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 xl:min-h-0 xl:sticky xl:top-4 xl:self-start">
                    <WorkbenchPreviewRail
                      actionLabel={formatActionLabel(selected.actionId)}
                      config={currentActionConfig}
                      siteMode={draft.siteMode}
                    />
                  </div>
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
                  siteMode={draft.siteMode}
                  setSiteMode={setSiteMode}
                  activeThemeName={activeTheme.name}
                  activeHost={state.site.host}
                  isSupportedPage={state.site.isSupportedPage}
                  siteRulesByHost={state.siteRulesByHost}
                  clearAllSiteRules={clearAllSiteRules}
                  clearFilteredSiteRules={clearFilteredSiteRules}
                />
              ) : null}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
