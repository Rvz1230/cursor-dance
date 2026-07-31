import { useState } from "react";
import { AppWindow, Crosshair, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import type {
  ActiveWindowSnapshot,
  AppRule,
  AppRuleAction,
  AppRulePattern,
  AppRulePatternType as PatternType,
  AppRuleTarget as PatternTarget,
} from "@/shared/app-rules";
import {
  cloneEditableRule,
  RuleActionFields,
  RuleEditorFrame,
  RuleList,
  type RuleThemeOption,
} from "./context-rules/RulePrimitives";

const PATTERN_TYPE_LABELS: Record<PatternType, string> = {
  exact: "精确匹配",
  glob: "通配符",
};

const PATTERN_TARGET_LABELS: Record<PatternTarget, string> = {
  process: "进程名",
  title: "窗口标题",
};

function emptyRuleDraft(target: PatternTarget = "process"): AppRule {
  return {
    id: "",
    pattern: { type: "exact", value: "", target },
    action: "disable",
  };
}

function RuleEditor({
  draft,
  themes,
  activeApp,
  onChange,
  onSave,
  onCancel,
}: {
  draft: AppRule;
  themes: RuleThemeOption[];
  activeApp: ActiveWindowSnapshot | null;
  onChange: (rule: AppRule) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const target: PatternTarget = draft.pattern.target === "title" ? "title" : "process";
  const patternType: PatternType = draft.pattern.type === "glob" ? "glob" : "exact";
  const placeholder = target === "title"
    ? (patternType === "glob" ? "*Visual Studio Code*" : "package.json — Code")
    : (patternType === "glob" ? "code-*" : "Code");

  const fillFromActiveApp = (field: PatternTarget) => {
    if (!activeApp?.authorized) return;
    const value = field === "title" ? activeApp.title : activeApp.processName;
    if (value) onChange({ ...draft, pattern: { ...draft.pattern, target: field, value } });
  };

  return (
    <RuleEditorFrame onSave={onSave} onCancel={onCancel}>
      <div className="space-y-2">
        <label className="block text-2xs font-medium text-slate-500">匹配维度</label>
        <select
          value={target}
          onChange={(event) => onChange({
            ...draft,
            pattern: { ...draft.pattern, target: event.target.value as PatternTarget },
          })}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="process">进程名 — 应用进程显示名（macOS app 名 / Windows 进程名）</option>
          <option value="title">窗口标题 — 当前前台窗口标题</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="block text-2xs font-medium text-slate-500">匹配方式</label>
        <select
          value={patternType}
          onChange={(event) => onChange({
            ...draft,
            pattern: { ...draft.pattern, type: event.target.value as PatternType },
          })}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="exact">精确匹配 — 完整字符串相等（不区分大小写）</option>
          <option value="glob">通配符 — *、**、? 通配（不区分大小写）</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="block text-2xs font-medium text-slate-500">匹配值</label>
        <div className="flex items-stretch gap-1.5">
          <input
            type="text"
            value={draft.pattern.value}
            onChange={(event) => onChange({
              ...draft,
              pattern: { ...draft.pattern, value: event.target.value },
            })}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          {activeApp?.authorized ? (
            <button
              type="button"
              onClick={() => fillFromActiveApp(target)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-2xs font-medium text-slate-600 hover:bg-slate-100"
              title={`使用当前前台${target === "title" ? "窗口标题" : "进程名"}`}
            >
              <Crosshair className="size-3" />
              取当前
            </button>
          ) : null}
        </div>
      </div>
      <RuleActionFields
        draft={draft}
        themes={themes}
        onChange={onChange}
        disableLabel="在该应用中禁用效果"
        enableLabel="在该应用中启用效果"
      />
    </RuleEditorFrame>
  );
}

export interface AppRulesPanelProps {
  appRules: AppRule[];
  themes: RuleThemeOption[];
  activeApp: ActiveWindowSnapshot | null;
  openAccessibilitySettings?: () => void;
  addAppRule: (rule: { pattern: AppRulePattern; action: AppRuleAction }) => void;
  updateAppRule: (id: string, updates: Partial<AppRule>) => void;
  deleteAppRule: (id: string) => void;
  reorderAppRules: (from: number, to: number) => void;
  toggleAppRule: (id: string) => void;
  clearAllAppRules: () => void;
}

export function AppRulesPanel({
  appRules = [],
  themes = [],
  activeApp,
  openAccessibilitySettings,
  addAppRule,
  updateAppRule,
  deleteAppRule,
  reorderAppRules,
  toggleAppRule,
  clearAllAppRules,
}: AppRulesPanelProps) {
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [draftRule, setDraftRule] = useState<AppRule | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const cancelEdit = () => {
    setEditingRuleId(null);
    setDraftRule(null);
    setIsAdding(false);
  };

  const startAdd = () => {
    setDraftRule(emptyRuleDraft());
    setIsAdding(true);
    setEditingRuleId(null);
  };

  const startEdit = (ruleId: string) => {
    const rule = appRules.find((candidate) => candidate.id === ruleId);
    if (!rule) return;
    setDraftRule(cloneEditableRule(rule));
    setEditingRuleId(ruleId);
    setIsAdding(false);
  };

  const saveEdit = () => {
    const value = draftRule?.pattern.value.trim();
    if (!draftRule || !value) return;
    const payload = {
      pattern: {
        type: draftRule.pattern.type,
        value,
        target: draftRule.pattern.target || "process",
      } as AppRulePattern,
      action: draftRule.action,
    };
    if (isAdding) addAppRule(payload);
    else if (editingRuleId) updateAppRule(editingRuleId, payload);
    cancelEdit();
  };

  const quickAdd = () => {
    if (!activeApp?.authorized) return;
    const processName = activeApp.processName.trim();
    if (!processName) return;
    const exists = appRules.some((rule) => (
      (rule.pattern.target || "process") === "process"
      && rule.pattern.type === "exact"
      && rule.pattern.value.toLowerCase() === processName.toLowerCase()
    ));
    if (!exists) {
      addAppRule({
        pattern: { type: "exact", value: processName, target: "process" },
        action: "disable",
      });
    }
  };

  const isEditing = editingRuleId !== null || isAdding;
  const activeProcess = activeApp?.authorized ? activeApp.processName : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>应用规则</SectionTitle>
        <div className="flex items-center gap-1.5">
          {activeProcess ? (
            <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={quickAdd}>
              为 {activeProcess} 添加规则
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={startAdd} aria-label="添加规则">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {activeApp?.authorized ? (
        <div className="space-y-0.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-2xs text-slate-500">
          <div>当前前台 <code className="font-medium text-slate-700">{activeApp.processName}</code></div>
          {activeApp.title ? <div className="truncate">窗口标题 <code className="font-medium text-slate-600">{activeApp.title}</code></div> : null}
        </div>
      ) : null}

      {activeApp && !activeApp.authorized ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-2xs text-amber-800">
          <div className="font-medium">
            {"message" in activeApp ? activeApp.message : "无法获取当前前台应用。"}
          </div>
          {openAccessibilitySettings ? (
            <button
              type="button"
              onClick={openAccessibilitySettings}
              className="mt-1 inline-flex items-center gap-1 text-2xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
            >
              打开系统设置 → 隐私与安全 → 辅助功能
              <ExternalLink className="size-3" />
            </button>
          ) : null}
        </div>
      ) : null}

      {isEditing && draftRule ? (
        <RuleEditor
          draft={draftRule}
          themes={themes}
          activeApp={activeApp}
          onChange={setDraftRule}
          onSave={saveEdit}
          onCancel={cancelEdit}
        />
      ) : null}

      <RuleList
        rules={appRules}
        themes={themes}
        describePattern={(rule) => {
          const target = rule.pattern.target === "title" ? "title" : "process";
          return `${PATTERN_TARGET_LABELS[target]} · ${PATTERN_TYPE_LABELS[rule.pattern.type]}`;
        }}
        emptyState={(
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
            <div className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <AppWindow className="size-5" aria-hidden />
            </div>
            <p className="mt-3 text-xs font-medium text-slate-600">还没有应用规则</p>
            <p className="mx-auto mt-1.5 max-w-sm text-2xs leading-5 text-slate-500">
              按进程名或窗口标题为指定应用启用 / 禁用效果，或切换到不同主题。
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="default" className="h-8 px-3 text-xs" onClick={startAdd}>
                <Plus className="mr-1.5 size-3.5" />添加规则
              </Button>
              {activeProcess ? (
                <Button variant="outline" className="h-8 px-3 text-xs" onClick={quickAdd}>
                  为 {activeProcess} 创建禁用规则
                </Button>
              ) : null}
            </div>
          </div>
        )}
        isEditing={isEditing}
        onToggle={toggleAppRule}
        onEdit={startEdit}
        onDelete={deleteAppRule}
        onReorder={reorderAppRules}
        onClear={clearAllAppRules}
      />
    </div>
  );
}
