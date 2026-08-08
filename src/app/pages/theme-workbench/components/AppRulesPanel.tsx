import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  GripVertical,
  Info,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import type {
  ActiveWindowSnapshot,
  AppRule,
  AppRuleAction,
  AppRuleTarget,
} from "@/shared/app-rules";
import { activeAppInfoFromSnapshot } from "@/shared/app-rules";
import type { NewAppRule } from "../hooks/workbenchStateTypes";
import {
  cloneEditableRule,
  RuleActionFields,
  RuleField,
  type RuleThemeOption,
} from "./context-rules/RulePrimitives";
import { ApplicationPicker } from "./app-rules/ApplicationPicker";
import { ApplicationRulesSection } from "./app-rules/ApplicationRulesSection";
import {
  ApplicationIcon,
  MatchBadge,
  RuleMenu,
  themeName,
} from "./app-rules/AppRuleElements";
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
  isVoidApplicationRule,
  resolveAppRuleDecision,
  resolveRuleMatchStates,
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

function emptyAdvancedRule(): AppRule {
  return {
    id: "",
    kind: "advanced",
    pattern: { type: "glob", value: "", target: "title" },
    action: "disable",
    enabled: true,
  };
}

function actionFor(kind: WizardAction, themeId: string): AppRuleAction {
  if (kind === "disable") return "disable";
  return { enable: true, ...(kind === "theme" && themeId ? { theme: themeId } : {}) };
}

function AdvancedRuleEditor({
  draft,
  themes,
  activeApp,
  error,
  onChange,
  onComplete,
  onCancel,
}: {
  draft: AppRule;
  themes: RuleThemeOption[];
  activeApp: ActiveWindowSnapshot | null;
  error: string;
  onChange: (draft: AppRule) => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const target: AppRuleTarget = draft.pattern.target === "title" ? "title" : "process";
  const active = activeApp?.authorized ? activeApp : null;
  return (
    <div className="mb-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <RuleField label="匹配目标">
          <Select
            value={target}
            options={[{ value: "process", label: "进程名" }, { value: "title", label: "窗口标题" }]}
            onChange={(value) => onChange({ ...draft, pattern: { ...draft.pattern, target: value } })}
            label="匹配目标"
          />
        </RuleField>
        <RuleField label="匹配方式">
          <Select
            value={draft.pattern.type}
            options={[{ value: "exact", label: "精确匹配" }, { value: "glob", label: "通配符" }]}
            onChange={(value) => onChange({ ...draft, pattern: { ...draft.pattern, type: value } })}
            label="匹配方式"
          />
        </RuleField>
        <RuleField label="匹配值">
          <div className="flex gap-1.5">
            <Input
              value={draft.pattern.value}
              placeholder={target === "title" ? "*演示模式*" : "Code-*"}
              onChange={(event) => onChange({ ...draft, pattern: { ...draft.pattern, value: event.target.value } })}
            />
            {active ? (
              <Button
                variant="outline"
                className="h-9 shrink-0 px-2.5 text-xs"
                onClick={() => onChange({
                  ...draft,
                  pattern: { ...draft.pattern, value: target === "title" ? active.title : active.processName },
                })}
              >
                取刚才
              </Button>
            ) : null}
          </div>
        </RuleField>
        <RuleActionFields draft={draft} themes={themes} onChange={onChange} />
      </div>
      {error ? <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
      <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-2.5">
        <Button variant="ghost" className="h-8 px-3 text-xs" onClick={onCancel}>取消</Button>
        <Button className="h-8 px-3 text-xs" onClick={onComplete}>完成</Button>
      </div>
    </div>
  );
}

export interface AppRulesPanelProps {
  appRules: AppRule[];
  themes: RuleThemeOption[];
  activeThemeId: string;
  globalEnabled: boolean;
  activeApp: ActiveWindowSnapshot | null;
  openAccessibilitySettings?: () => void;
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
  openAccessibilitySettings,
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
  const [advancedOpen, setAdvancedOpen] = useState(() => appRules.some((rule) => !isApplicationRule(rule)));
  const [advancedDraft, setAdvancedDraft] = useState<AppRule | null>(null);
  const [advancedEditingId, setAdvancedEditingId] = useState<string | null>(null);
  const [editorError, setEditorError] = useState("");
  const dragRuleId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wizard) scrollRef.current?.scrollTo({ top: 0 });
  }, [wizard]);

  const activeInfo = activeAppInfoFromSnapshot(activeApp);
  const matchStates = useMemo(
    () => resolveRuleMatchStates(appRules, activeInfo, globalEnabled),
    [activeInfo, appRules, globalEnabled],
  );
  const decision = useMemo(
    () => resolveAppRuleDecision(appRules, activeApp, globalEnabled),
    [activeApp, appRules, globalEnabled],
  );
  const applicationRules = appRules.filter(isApplicationRule);
  const advancedRules = appRules.filter((rule) => !isApplicationRule(rule));
  const candidateForRule = (rule: AppRule) => applicationCandidateForRule(rule, allApplications);
  const isVoidRule = (rule: AppRule) => isVoidApplicationRule(rule, globalEnabled);
  const voidRules = applicationRules.filter(isVoidRule);

  const startWizard = (application = activeApplication || enrichedRecentApplications[0] || emptyApplication()) => {
    setWizard({ step: 1, application, action: null, themeId: themes[0]?.id || "" });
    setAdvancedDraft(null);
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
      openAccessibilitySettings?.();
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

  const startAdvancedAdd = () => {
    setAdvancedOpen(true);
    setAdvancedDraft(emptyAdvancedRule());
    setAdvancedEditingId(null);
    setWizard(null);
    setEditorError("");
  };

  const startAdvancedEdit = (rule: AppRule) => {
    setAdvancedOpen(true);
    setAdvancedDraft(cloneEditableRule(rule));
    setAdvancedEditingId(rule.id);
    setWizard(null);
    setEditorError("");
  };

  const completeAdvanced = () => {
    if (!advancedDraft) return;
    const value = advancedDraft.pattern.value.trim();
    if (!value) {
      setEditorError("请填写匹配值。");
      return;
    }
    const payload = {
      kind: "advanced" as const,
      pattern: { ...advancedDraft.pattern, value },
      action: advancedDraft.action,
    };
    if (advancedEditingId) updateAppRule(advancedEditingId, payload);
    else addAppRule(payload);
    setAdvancedDraft(null);
    setAdvancedEditingId(null);
    setEditorError("");
    notify?.({ title: advancedEditingId ? "已更新匹配规则" : "已添加匹配规则" });
  };

  const moveAdvanced = (ruleId: string, direction: -1 | 1) => {
    const index = advancedRules.findIndex((rule) => rule.id === ruleId);
    const target = advancedRules[index + direction];
    if (!target) return;
    reorderAppRules(appRules.findIndex((rule) => rule.id === ruleId), appRules.findIndex((rule) => rule.id === target.id));
  };

  const reorderAdvancedTo = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = appRules.findIndex((rule) => rule.id === fromId);
    const to = appRules.findIndex((rule) => rule.id === toId);
    if (from >= 0 && to >= 0) reorderAppRules(from, to);
  };

  const axLimited = Boolean(
    activeApp?.authorized
      && activeApp.elementAccessAvailable === false,
  );
  const activeGlobalTheme = themeName(themes, activeThemeId);
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
                <div className="text-xs font-medium text-amber-900">需要辅助功能权限才能识别刚才使用的应用</div>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">授权后即可用「最近使用」和「点选」添加应用；在此之前只能手写匹配规则。</p>
                <button type="button" onClick={openAccessibilitySettings} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-900 underline underline-offset-2 transition-colors hover:text-amber-700">
                  打开系统设置 → 隐私与安全 → 辅助功能<ExternalLink className="size-3" />
                </button>
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
            openAccessibilitySettings={openAccessibilitySettings}
            addDefaultDisabled={addDefaultDisabled}
            updateRule={updateAppRule}
            toggleRule={toggleAppRule}
            removeRule={removeRule}
          />

          <section className="mb-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button type="button" onClick={() => setAdvancedOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50" aria-expanded={advancedOpen}>
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-sm font-medium text-slate-900">高级匹配规则<span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-600">{advancedRules.length}</span></h2>
                <div className="mt-0.5 text-xs text-slate-500">按进程名或窗口标题做模式匹配，<span className="font-medium text-slate-600">这里的规则有顺序</span></div>
              </div>
              <ChevronDown className={cn("size-4 shrink-0 text-slate-500 transition-transform", advancedOpen && "rotate-180")} />
            </button>
            {advancedOpen ? (
              <div className="border-t border-slate-100 px-4 py-3">
                <div className="mb-2.5 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
                  <p className="text-xs leading-relaxed text-slate-500">裁决顺序：<span className="font-semibold text-slate-700">例外应用</span> → <span className="font-semibold text-slate-700">高级规则（自上而下第一条命中）</span> → <span className="font-semibold text-slate-700">默认行为</span>。只有同一个应用需要按窗口标题分情况处理时才需要用到这里。</p>
                </div>
                {advancedDraft ? (
                  <AdvancedRuleEditor draft={advancedDraft} themes={themes} activeApp={activeApp} error={editorError} onChange={setAdvancedDraft} onComplete={completeAdvanced} onCancel={() => { setAdvancedDraft(null); setEditorError(""); }} />
                ) : null}
                <div className="space-y-1.5">
                  {!advancedRules.length ? <p className="px-1 py-2 text-xs text-slate-500">还没有任何匹配规则。绝大多数需求用上面的列表就够了。</p> : advancedRules.map((rule) => {
                    const matchState = rule.enabled === false ? "idle" : (matchStates.get(rule.id) || "idle");
                    const voidRule = isVoidRule(rule);
                    const hit = decision?.ruleId === rule.id;
                    const targetLabel = rule.pattern.target === "title" ? "窗口标题" : "进程名";
                    const typeLabel = rule.pattern.type === "glob" ? "通配符" : "精确";
                    const coveredBy = matchState === "shadowed" && decisionRule
                      ? isApplicationRule(decisionRule)
                        ? `例外应用「${candidateForRule(decisionRule).name}」`
                        : `上方规则「${decisionRule.pattern.value}」`
                      : undefined;
                    return (
                      <div
                        key={rule.id}
                        className={cn("adv-row", hit && "adv-row-hit")}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => { if (dragRuleId.current) reorderAdvancedTo(dragRuleId.current, rule.id); dragRuleId.current = null; }}
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={() => { dragRuleId.current = rule.id; }}
                          onDragEnd={() => { dragRuleId.current = null; }}
                          className="shrink-0 cursor-grab text-slate-300 transition-colors hover:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                          aria-label={`调整「${rule.pattern.value}」的顺序，方向键上下移动`}
                          onKeyDown={(event) => {
                            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                            event.preventDefault();
                            moveAdvanced(rule.id, event.key === "ArrowUp" ? -1 : 1);
                          }}
                        >
                          <GripVertical className="size-3.5" />
                        </button>
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-500">{targetLabel} · {typeLabel}</span>
                          <code className="min-w-0 truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700" title={rule.pattern.value}>{rule.pattern.value}</code>
                          <span className={cn("adv-badge", rule.action === "disable" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800")}>{rule.action === "disable" ? "关闭" : `启用 · ${themeName(themes, rule.action.theme)}`}</span>
                          {rule.enabled === false
                            ? <span className="row-void">已暂停</span>
                            : voidRule
                              ? <span className="row-void">{globalEnabled ? "与默认相同" : "白名单下无效"}</span>
                              : <MatchBadge state={matchState} coveredBy={coveredBy} />}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700" onClick={() => startAdvancedEdit(rule)}>编辑</button>
                          <RuleMenu rule={rule} label={`规则${rule.pattern.value}`} onToggle={() => toggleAppRule(rule.id)} onDelete={() => removeRule(rule, `规则「${rule.pattern.value}」`)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button variant="outline" className="mt-2.5 h-8 px-3 text-xs" onClick={startAdvancedAdd}><Plus className="mr-1.5 size-3.5" />添加匹配规则</Button>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5">
        <div className="mx-auto flex max-w-[920px] flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {activeApplication && decision ? (
              <>
                <ApplicationIcon application={activeApplication} small />
                <span className="shrink-0 text-xs text-slate-500">刚才使用</span>
                <span className="shrink-0 text-xs font-medium text-slate-900">{activeApplication.name}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500" title={activeApplication.title}>{activeApplication.title}</span>
                <ArrowRight className="size-3 shrink-0 text-slate-300" />
                <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold", decision.enabled ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>
                  {decision.enabled ? `效果已启用 · 主题${decision.action && decision.action !== "disable" && decision.action.theme ? themeName(themes, decision.action.theme) : activeGlobalTheme}` : "效果已关闭"}
                  <span className="font-normal">{decisionSource}</span>
                </span>
              </>
            ) : (
              <>
                <span className="grid size-5 place-items-center rounded-full bg-slate-100 text-slate-500"><AlertCircle className="size-3" /></span>
                <span className="text-xs text-slate-500">读不到刚才使用的应用，规则暂不生效</span>
              </>
            )}
          </div>
          <button type="button" onClick={openDiagnostics} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-900">为什么？<ArrowRight className="size-3" /></button>
          {refreshActiveApp && !activeApp?.authorized ? <button type="button" onClick={refreshActiveApp} className="sr-only">重新检测辅助功能权限</button> : null}
        </div>
      </div>
    </div>
  );
}
