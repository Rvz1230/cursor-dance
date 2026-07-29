import { formatActionLabel } from "./model/workbenchSchema";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { mergeActionConfig } from "./lib/aiSchemeAssistant";
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
import { isDesktop } from "@/shared/runtime";
import {
  activeAppInfoFromSnapshot,
  resolveAppRule,
  type ActiveWindowSnapshot,
} from "@/shared/app-rules";

export default function ThemeWorkbenchPage({ renderHeader }: ThemeWorkbenchPageProps = {}) {
  return (
    <ToastProvider>
      <TooltipProvider>
        <ThemeWorkbenchPageContent renderHeader={renderHeader} />
      </TooltipProvider>
    </ToastProvider>
  );
}

export interface WorkbenchHeaderProps {
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

export type WorkbenchHeaderRenderer = (props: WorkbenchHeaderProps) => ReactNode;

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
  const [columnWeights, setColumnWeights] = useState({ config: 1.05, preview: 1.25, ai: 1 });
  const [previewProposal, setPreviewProposal] = useState(null);
  const [aiSnapshot, setAiSnapshot] = useState(null);
  // 任务 4.3：首次启动引导
  // welcomeState: "loading" → "open" → "closed"。loading 期间不渲染 dialog（避免闪现）；
  // 非桌面环境（cursorDanceApp 不存在）跳过整个流程。
  const [welcomeState, setWelcomeState] = useState<"loading" | "open" | "closed">("loading");
  const [accessibilityAuthorized, setAccessibilityAuthorized] = useState<boolean | null>(null);
  const [activeWindowSnapshot, setActiveWindowSnapshot] = useState<ActiveWindowSnapshot | null>(null);
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
  const previewActionConfigsMap = useMemo(() => {
    if (!previewProposal || !draft?.actionConfigs) return draft?.actionConfigs;
    return (previewProposal.targets || []).reduce((configs, target) => {
      if (target?.type !== "action" || !target.actionId || !target.patch || !Object.keys(target.patch).length) {
        return configs;
      }
      return {
        ...configs,
        [target.actionId]: mergeActionConfig(configs[target.actionId], target.patch),
      };
    }, draft.actionConfigs);
  }, [draft?.actionConfigs, previewProposal]);
  const previewActionConfig = previewActionConfigsMap?.[selected.actionId] || currentActionConfig;
  const isPreviewingAiProposal = Boolean(
    previewProposal?.targets?.some(
      (target) => target?.type === "action" && target.actionId === selected.actionId && Object.keys(target.patch || {}).length,
    ),
  );
  const activeAppInfo = activeAppInfoFromSnapshot(activeWindowSnapshot);
  const contextAction = isDesktop()
    ? (activeAppInfo ? resolveAppRule(state.appRules, activeAppInfo) : null)
    : getRuntimeConfig().resolveSiteRule(state.siteRules, state.site.host);

  useEffect(() => {
    setPreviewProposal(null);
  }, [selected.themeId]);

  // 任务 4.3：检测首次启动 + 探测辅助功能授权状态。
  // 两个 IPC 都是只读查询，挂载时跑一次即可；用户翻 enable/disable 不影响这里。
  useEffect(() => {
    if (typeof window === "undefined") {
      setWelcomeState("closed");
      return;
    }
    const bridge = window.cursorDanceApp;
    if (!bridge) {
      // 扩展端 / 静态预览：没有桌面 IPC，永远跳过欢迎流程。
      setWelcomeState("closed");
      return;
    }
    let cancelled = false;
    const unsubscribeActiveWindow = bridge.onActiveWindowChanged((snapshot) => {
      if (cancelled) return;
      setActiveWindowSnapshot(snapshot);
      setAccessibilityAuthorized(snapshot.authorized);
    });
    void Promise.allSettled([
      bridge.getFirstRun(),
      bridge.getActiveWindow(),
    ]).then(([firstRunResult, activeWindowResult]) => {
      if (cancelled) return;
      const isFirstRun = firstRunResult.status === "fulfilled" ? firstRunResult.value === true : false;
      const authorized = activeWindowResult.status === "fulfilled"
        ? activeWindowResult.value.authorized === true
        : false;
      if (activeWindowResult.status === "fulfilled") {
        setActiveWindowSnapshot(activeWindowResult.value);
      }
      setAccessibilityAuthorized(authorized);
      setWelcomeState(isFirstRun ? "open" : "closed");
    });
    return () => {
      cancelled = true;
      unsubscribeActiveWindow();
    };
  }, []);

  function handleCloseWelcome() {
    setWelcomeState("closed");
    if (typeof window !== "undefined") {
      window.cursorDanceApp?.markFirstRunComplete().catch(() => { /* 写盘失败仅影响下次启动会再展示一次，无副作用 */ });
    }
  }

  function handleOpenAccessibilitySettings() {
    if (typeof window === "undefined") return;
    // macOS 13+ 的隐私与安全 → 辅助功能直链。
    const target = "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
    window.cursorDanceApp?.openExternal(target).catch(() => { /* 静默；用户也可手动打开 */ });
  }

  if (!state.ui.isHydrated) {
    return <div className="h-dvh bg-slate-100" />;
  }

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

                      <div className="field-row-container min-h-0 overflow-y-auto pr-1">
                        <WorkbenchPanel
                          actionId={selected.actionId}
                          config={currentActionConfig}
                          resetConfig={draft?.resetActionConfigs?.[selected.actionId]}
                          updateActionConfig={handleUpdateActionConfig}
                          conflicts={currentConflicts}
                          atmosphere={draft?.atmosphere}
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
                      actionLabel={formatActionLabel(selected.actionId)}
                      actionId={selected.actionId}
                      config={previewActionConfig}
                      actionConfigsMap={previewActionConfigsMap}
                      disabled={contextAction === "disable"}
                      previewMode={isPreviewingAiProposal}
                      updateActionConfig={updateActionConfig}
                      atmosphere={draft?.atmosphere}
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
                            applyProposal={handleApplyAiProposal}
                            previewProposal={previewProposal}
                            onPreviewProposal={setPreviewProposal}
                            onClearPreview={() => setPreviewProposal(null)}
                            notify={toast}
                            aiSnapshot={aiSnapshot}
                            onRevertAiChanges={handleRevertAiChanges}
                            onClearAiSnapshot={() => setAiSnapshot(null)}
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
                      openAccessibilitySettings={handleOpenAccessibilitySettings}
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
          onClose={handleCloseWelcome}
          platform={(window.electronAPI?.platform || "darwin") as NodeJS.Platform}
          needsAccessibility={accessibilityAuthorized === false}
          onOpenAccessibilitySettings={handleOpenAccessibilitySettings}
        />
      ) : null}
      {aiSettingsOpen && typeof window !== "undefined" && window.cursorDanceAi ? (
        <AiSettingsDialog open onClose={() => setAiSettingsOpen(false)} />
      ) : null}
    </div>
  );
}
