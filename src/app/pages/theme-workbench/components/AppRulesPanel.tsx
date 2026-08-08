import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Info,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import type {
  ActiveWindowSnapshot,
  AppRule,
  AppRuleAction,
} from "@/shared/app-rules";
import type { NewAppRule } from "../hooks/workbenchStateTypes";
import type { RuleThemeOption } from "./context-rules/RulePrimitives";
import { ActiveRuleSummary } from "./app-rules/ActiveRuleSummary";
import { AdvancedRulesSection } from "./app-rules/AdvancedRulesSection";
import { ApplicationPicker } from "./app-rules/ApplicationPicker";
import { ApplicationRulesSection } from "./app-rules/ApplicationRulesSection";
import { themeName } from "./app-rules/AppRuleElements";
import {
  AppRuleWizard,
  type AppRuleWizardState,
  type WizardAction,
} from "./app-rules/AppRuleWizard";
import {
  applicationCandidateForRule,
  applicationFromSnapshot,
  applicationPattern,
  applicationRuleMatchesCandidate,
  isApplicationRule,
  isRuleRedundantWithGlobal,
  resolveAppRuleDecision,
  type ApplicationCandidate,
} from "./app-rules/appRulesModel";
import { useApplicationCatalog } from "./app-rules/useApplicationCatalog";
import "./app-rules/app-rules.css";

type Notify = (input: {
  title: ReactNode;
  description?: string;
  tone?: "success" | "error" | "warning" | "info";
  undo?: { label?: string; run: () => void };
}) => unknown;

function emptyApplication(): ApplicationCandidate {
  return { key: "manual", name: "", processName: "", title: "" };
}

function actionFor(kind: WizardAction, themeId: string): AppRuleAction {
  if (kind === "disable") return "disable";
  return { enable: true, ...(kind === "theme" && themeId ? { theme: themeId } : {}) };
}

export interface AppRulesPanelProps {
  appRules: AppRule[];
  themes: RuleThemeOption[];
  activeThemeId: string;
  globalEnabled: boolean;
  activeApp: ActiveWindowSnapshot | null;
  supportsWindowTitleRules: boolean;
  refreshActiveApp?: () => void;
  openDiagnostics?: () => void;
  notify?: Notify;
  setGlobalEnabled: (enabled: boolean) => void;
  addAppRule: (rule: NewAppRule) => void;
  updateAppRule: (id: string, updates: Partial<AppRule>) => void;
  deleteAppRule: (id: string) => void;
  reorderAppRules: (from: number, to: number) => void;
  toggleAppRule: (id: string) => void;
}

export function AppRulesPanel({
  appRules,
  themes,
  activeThemeId,
  globalEnabled,
  activeApp,
  supportsWindowTitleRules,
  refreshActiveApp,
  openDiagnostics,
  notify,
  setGlobalEnabled,
  addAppRule,
  updateAppRule,
  deleteAppRule,
  reorderAppRules,
  toggleAppRule,
}: AppRulesPanelProps) {
  const {
    activeApplication,
    allApplications,
    enrichedRecentApplications,
    installedApplications,
    installedLoading,
  } = useApplicationCatalog(activeApp);
  const [pickerAnchor, setPickerAnchor] = useState<"header" | "list" | "empty" | null>(null);
  const [waitingForPick, setWaitingForPick] = useState(false);
  const [wizard, setWizard] = useState<AppRuleWizardState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wizard) scrollRef.current?.scrollTo({ top: 0 });
  }, [wizard]);

  const decision = useMemo(
    () => resolveAppRuleDecision(appRules, activeApp, globalEnabled),
    [activeApp, appRules, globalEnabled],
  );
  const applicationRules = appRules.filter(isApplicationRule);
  const candidateForRule = (rule: AppRule) => applicationCandidateForRule(rule, allApplications);
  const isVoidRule = (rule: AppRule) => isRuleRedundantWithGlobal(rule, globalEnabled);
  const voidRules = applicationRules.filter(isVoidRule);

  const startWizard = (application = activeApplication || enrichedRecentApplications[0] || emptyApplication()) => {
    setWizard({ step: 1, application, action: null, themeId: themes[0]?.id || "" });
    setPickerAnchor(null);
  };

  const completeWizard = () => {
    if (!wizard?.action) return;
    const pattern = applicationPattern(wizard.application);
    if (!pattern.value) return;
    const payload = {
      kind: "application" as const,
      pattern,
      action: actionFor(wizard.action, wizard.themeId),
      preferredTheme: wizard.action === "theme" ? wizard.themeId : undefined,
    };
    const existing = applicationRules.find((rule) => applicationRuleMatchesCandidate(rule, wizard.application));
    if (wizard.editingRuleId) updateAppRule(wizard.editingRuleId, payload);
    else if (existing) updateAppRule(existing.id, { ...payload, enabled: true });
    else addAppRule(payload);
    const applicationName = wizard.application.name || pattern.value;
    setWizard(null);
    notify?.({ title: `已加入草稿：在「${applicationName}」中，${wizard.action === "disable" ? "关闭 CursorDance" : wizard.action === "theme" ? `使用「${themeName(themes, wizard.themeId)}」场景` : "跟随全局设置"}。` });
  };

  const addDefaultDisabled = (application: ApplicationCandidate) => {
    const existing = applicationRules.find((rule) => applicationRuleMatchesCandidate(rule, application));
    if (existing) updateAppRule(existing.id, {
      action: "disable",
      enabled: true,
      preferredTheme: existing.action !== "disable" ? existing.action.theme : existing.preferredTheme,
    });
    else addAppRule({ kind: "application", pattern: applicationPattern(application), action: "disable" });
    notify?.({ title: `已加入「${application.name}」· 默认关闭效果` });
  };

  const startPicking = async () => {
    if (!activeApp?.authorized) {
      setPickerAnchor(null);
      notify?.({ title: "暂时无法识别目标应用", description: activeApp?.message || "请切换到目标应用后重试。", tone: "warning" });
      return;
    }
    setPickerAnchor(null);
    const pickWindow = window.cursorDanceApp?.pickWindow;
    if (!pickWindow) {
      notify?.({ title: "当前环境不支持点选窗口", tone: "warning" });
      return;
    }
    setWaitingForPick(true);
    try {
      const result = await pickWindow();
      if (result.status === "failed") {
        notify?.({ title: "没有读取到所选窗口", description: result.message, tone: "warning" });
        return;
      }
      if (result.status === "cancelled") return;
      const application = applicationFromSnapshot(result.snapshot);
      if (!application) {
        notify?.({ title: "没有读取到所选窗口", tone: "warning" });
        return;
      }
      setWizard({
        step: 1,
        application,
        action: null,
        themeId: themes[0]?.id || "",
      });
    } catch (error) {
      notify?.({
        title: "点选窗口失败",
        description: error instanceof Error ? error.message : "请重试。",
        tone: "warning",
      });
    } finally {
      setWaitingForPick(false);
    }
  };

  const restoreRules = (removedRules: readonly AppRule[]) => {
    const removedIds = new Set(removedRules.map((rule) => rule.id));
    const targetIds = appRules.map((rule) => rule.id);
    const workingIds = appRules.filter((rule) => !removedIds.has(rule.id)).map((rule) => rule.id);
    for (const rule of removedRules) {
      addAppRule({ ...rule, pattern: { ...rule.pattern } });
      workingIds.push(rule.id);
    }
    targetIds.forEach((id, targetIndex) => {
      const fromIndex = workingIds.indexOf(id);
      if (fromIndex < 0 || fromIndex === targetIndex) return;
      reorderAppRules(fromIndex, targetIndex);
      const [moved] = workingIds.splice(fromIndex, 1);
      workingIds.splice(targetIndex, 0, moved);
    });
  };

  const removeRule = (rule: AppRule, label: string) => {
    deleteAppRule(rule.id);
    notify?.({
      title: `已删除${label}`,
      undo: {
        run: () => restoreRules([rule]),
      },
    });
  };

  const axLimited = Boolean(
    activeApp?.authorized
      && activeApp.elementAccessAvailable === false,
  );
  const decisionRule = decision?.ruleId ? appRules.find((rule) => rule.id === decision.ruleId) : null;
  const decisionSource = decisionRule
    ? isApplicationRule(decisionRule)
      ? `来自例外应用「${candidateForRule(decisionRule).name}」`
      : `来自高级规则「${decisionRule.pattern.value}」`
    : "来自默认行为";

  const picker = (anchor: "header" | "list" | "empty", trigger: ReactNode) => (
    <ApplicationPicker
      open={pickerAnchor === anchor}
      onOpenChange={(open) => setPickerAnchor(open ? anchor : null)}
      trigger={trigger}
      recentApplications={enrichedRecentApplications}
      installedApplications={installedApplications}
      installedLoading={installedLoading}
      appRules={appRules}
      authorized={activeApp?.authorized === true}
      onAdd={startWizard}
      onStartPicking={startPicking}
    />
  );

  return (
    <div className="app-rules-workspace flex h-full min-h-0 flex-col bg-slate-50">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="mx-auto max-w-[920px]">
          {wizard ? (
            <AppRuleWizard
              state={wizard}
              currentApplication={activeApplication}
              recentApplications={enrichedRecentApplications}
              themes={themes}
              onChange={setWizard}
              onCancel={() => setWizard(null)}
              onComplete={completeWizard}
            />
          ) : null}

          <div className="mb-2.5 flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-balance text-base font-semibold text-slate-900">应用规则</h1>
              <p className="mt-1 max-w-2xl text-pretty text-xs leading-relaxed text-slate-500">指定某些应用关闭效果，或在其中换用另一套主题。改动自动保存。</p>
            </div>
            <div className="shrink-0">
              {picker("header",
                <Button className="h-8 px-3 text-xs">
                  <Plus className="mr-1.5 size-3.5" />添加应用<ChevronDown className="ml-1.5 size-3" />
                </Button>,
              )}
            </div>
          </div>

          {waitingForPick ? (
            <div className="mb-2.5 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-sky-900">点选已开始 · 点击目标窗口</div>
                <p className="mt-1 text-xs leading-relaxed text-sky-800">检测到目标应用后会自动回到三步创建流程。</p>
              </div>
            </div>
          ) : null}

          {activeApp && !activeApp.authorized ? (
            <div className="mb-2.5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-amber-900">暂时无法识别刚才使用的应用</div>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">请切换到目标应用后重试，也可以从已安装应用列表选择，或手写进程名规则。</p>
              </div>
            </div>
          ) : null}

          {axLimited && activeApplication ? (
            <div className="mb-2.5 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-sky-900">「{activeApplication.name}」只能按窗口定位，取不到窗口里的元素</div>
                <p className="mt-1 text-xs leading-relaxed text-sky-800">权限没问题，规则也生效了。这个应用不向辅助功能暴露元素级信息，所以效果会<strong className="font-semibold">锚在指针位置</strong>，而不是你敲到的那个按钮上。</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={openDiagnostics} className="inline-flex items-center gap-1 text-xs font-medium text-sky-900 underline underline-offset-2 transition-colors hover:text-sky-700">在诊断面板里看这次回落<ArrowRight className="size-3" /></button>
                  <span className="text-xs text-slate-500">这一档没有修复入口，只能告知</span>
                </div>
              </div>
            </div>
          ) : null}

          <section className="mb-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-medium text-slate-900">默认行为</h2>
              <div className="mt-0.5 text-xs text-slate-500">没有单独设置的应用一律按这里处理</div>
            </div>
            <div className="app-rules-mode-grid grid gap-2 px-4 py-3" role="radiogroup" aria-label="默认行为">
              {([
                [true, "在所有应用中启用", "下方列出的应用按各自设置处理。适合大多数人。"],
                [false, "仅在指定应用中启用", "没列出的应用一律不生效。适合只想在少数几个应用里用。"],
              ] as const).map(([enabled, label, description]) => (
                <button
                  key={String(enabled)}
                  type="button"
                  role="radio"
                  aria-checked={globalEnabled === enabled}
                  tabIndex={globalEnabled === enabled ? 0 : -1}
                  onClick={() => setGlobalEnabled(enabled)}
                  onKeyDown={(event) => {
                    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
                    event.preventDefault();
                    setGlobalEnabled(!globalEnabled);
                  }}
                  className={cn("mode-card", globalEnabled === enabled && "mode-card-on")}
                >
                  <span className={cn("mode-dot", globalEnabled === enabled && "mode-dot-on")} />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-slate-900">{label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {!globalEnabled && voidRules.length ? (
            <div className="mb-2.5 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Info className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-relaxed text-slate-600">白名单模式下未列出的应用本来就不生效，所以设成「关闭」的 {voidRules.length} 行是空配置。</p>
                <button
                  type="button"
                  className="mt-1.5 text-xs font-medium text-slate-900 underline underline-offset-2"
                  onClick={() => {
                    voidRules.forEach((rule) => deleteAppRule(rule.id));
                    notify?.({
                      title: `已移除 ${voidRules.length} 条空配置`,
                      undo: { run: () => restoreRules(voidRules) },
                    });
                  }}
                >
                  移除这些空配置
                </button>
              </div>
            </div>
          ) : null}

          <ApplicationRulesSection
            appRules={appRules}
            themes={themes}
            globalEnabled={globalEnabled}
            activeApp={activeApp}
            applications={allApplications}
            recentApplications={enrichedRecentApplications}
            renderPicker={(anchor, trigger) => picker(anchor, trigger)}
            addDefaultDisabled={addDefaultDisabled}
            updateRule={updateAppRule}
            toggleRule={toggleAppRule}
            removeRule={removeRule}
          />

          <AdvancedRulesSection
            appRules={appRules}
            themes={themes}
            activeApp={activeApp}
            globalEnabled={globalEnabled}
            applications={allApplications}
            decision={decision}
            applicationWizardOpen={Boolean(wizard)}
            closeApplicationWizard={() => setWizard(null)}
            addRule={addAppRule}
            updateRule={updateAppRule}
            reorderRules={reorderAppRules}
            toggleRule={toggleAppRule}
            removeRule={removeRule}
            onRuleSaved={(editing) => notify?.({ title: editing ? "已更新匹配规则" : "已添加匹配规则" })}
            supportsWindowTitleRules={supportsWindowTitleRules}
          />
        </div>
      </div>

      <ActiveRuleSummary
        application={activeApplication}
        activeApp={activeApp}
        decision={decision}
        decisionSource={decisionSource}
        themes={themes}
        activeThemeId={activeThemeId}
        openDiagnostics={openDiagnostics}
        refreshActiveApp={refreshActiveApp}
      />
    </div>
  );
}
