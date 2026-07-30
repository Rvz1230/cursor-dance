import { formatActionLabel } from "./model/workbenchSchema";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useThemeWorkbenchState } from "./hooks/useThemeWorkbenchState";
import { BindingsPanel } from "./components/BindingsPanel";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { SiteRulesPanel } from "./components/SiteRulesPanel";
import { AppRulesPanel } from "./components/AppRulesPanel";
import { StatesPanel } from "./components/StatesPanel";
import { KeyboardPanel } from "./components/KeyboardPanel";
import { WorkbenchHeader } from "./components/WorkbenchHeader";
import { AiSchemePanel } from "./components/AiSchemePanel";
import { ActionTab, ColumnResizeHandle, WorkspaceItem } from "./components/WorkbenchControls";
import { WorkbenchPanel } from "./components/WorkbenchPanel";
import { WorkbenchPreviewRail } from "./components/WorkbenchPreviewRail";
import { getRuntimeConfig } from "./lib/runtimeConfig";
import { ThemeLibrarySidebar } from "./components/ThemeLibrarySidebar";
import { WelcomeDialog } from "./components/WelcomeDialog";
import { AiSettingsDialog } from "./components/AiSettingsDialog";
import { cn } from "@/components/ui/utils";
import { Bot, ChevronLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

export default function ThemeWorkbenchPage({ renderHeader }: ThemeWorkbenchPageProps = {}) {
  return (
    <ToastProvider>
      <TooltipProvider>
        <ThemeWorkbenchPageContent renderHeader={renderHeader} />
      </TooltipProvider>
    </ToastProvider>
  );
}

interface WorkbenchHeaderProps {
  workspaceItems: ReturnType<typeof useThemeWorkbenchState>["workspaceItems"];
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  unsaved: boolean;
  isSaving: boolean;
  saveError?: string | null;
  saveChanges: () => void;
  resetCurrentTheme: () => void;
  aiPanelOpen?: boolean;
  setAiPanelOpen?: (value: boolean) => void;
  /** 桌面端：打开 AI 服务设置（API key / baseUrl / model）。扩展端不传。 */
  openAiSettings?: () => void;
}

type WorkbenchHeaderRenderer = (props: WorkbenchHeaderProps) => ReactNode;

function WorkspaceTabsScroller({
  workspaceItems,
  workspaceId,
  setWorkspaceId,
}: Pick<WorkbenchHeaderProps, "workspaceItems" | "workspaceId" | "setWorkspaceId">) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateScrollState = () => {
      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      setScrollState({
        left: element.scrollLeft > 1,
        right: element.scrollLeft < maxScrollLeft - 1,
      });
    };

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);
    return () => {
      element.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [workspaceItems.length]);

  const scrollByPage = (direction: -1 | 1) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(120, element.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      {scrollState.left ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-lg text-slate-500 hover:text-slate-900"
          onClick={() => scrollByPage(-1)}
          aria-label="向左滚动工作区"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
      <div
        ref={scrollRef}
        className="flex min-w-0 items-center gap-1.5 overflow-x-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {workspaceItems.map((item) => (
          <WorkspaceItem
            key={item.id}
            item={item}
            active={workspaceId === item.id}
            onClick={() => setWorkspaceId(item.id)}
            compact
          />
        ))}
      </div>
      {scrollState.right ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-lg text-slate-500 hover:text-slate-900"
          onClick={() => scrollByPage(1)}
          aria-label="向右滚动工作区"
        >
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function DesktopWorkbenchToolbar({
  workspaceItems,
  workspaceId,
  setWorkspaceId,
  enabled,
  setEnabled,
  unsaved,
  isSaving,
  saveError,
  saveChanges,
  resetCurrentTheme,
  aiPanelOpen,
  setAiPanelOpen,
}: WorkbenchHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <WorkspaceTabsScroller
          workspaceItems={workspaceItems}
          workspaceId={workspaceId}
          setWorkspaceId={setWorkspaceId}
        />

        <div className="flex min-w-0 items-center justify-end gap-2">
          {workspaceId === "workbench" ? (
            <Button
              variant={aiPanelOpen ? "default" : "outline"}
              className="h-8 shrink-0 px-3 text-xs"
              onClick={() => setAiPanelOpen?.(!aiPanelOpen)}
            >
              <Bot className="mr-1.5 size-3.5" aria-hidden="true" />
              AI 助手
            </Button>
          ) : null}
          <div className="flex h-8 shrink-0 items-center gap-2 rounded-xl bg-white px-2.5 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200">
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="全局启用开关" />
            <span className="font-medium">全局启用</span>
          </div>
          {saveError ? (
            <span className="max-w-[220px] truncate text-xs text-rose-700" role="status">
              {saveError}
            </span>
          ) : null}
          <Button
            className="h-8 px-3 text-xs"
            onClick={saveChanges}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                保存中...
              </>
            ) : (
              <>
                保存
                {unsaved ? (
                  <span
                    className="ml-1.5 size-1.5 rounded-full bg-amber-400"
                    aria-label="有未保存的更改"
                  />
                ) : null}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={resetCurrentTheme}
          >
            <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
            恢复主题默认
          </Button>
        </div>
      </div>
    </div>
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
                </div>
              ) : null}

              {state.workspaceId === "sites" ? (
                <div className="h-full overflow-y-auto pr-1">
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
                </div>
              ) : null}

              {state.workspaceId === "diagnostics" ? (
                <div className="h-full overflow-y-auto pr-1">
                  <DiagnosticsPanel
                    selectedThemeId={selected.themeId}
                  />
                </div>
              ) : null}

              {state.workspaceId === "keyboard" ? (
                <KeyboardPanel
                  config={keyFeedbackConfig}
                  themeName={activeTheme?.name}
                  onUpdate={(patch) => updateKeyFeedbackConfig(patch)}
                />
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
        <AiSettingsDialog open onClose={() => setAiSettingsOpen(false)} />
      ) : null}
    </div>
  );
}
