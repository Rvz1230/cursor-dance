import { useState } from "react";
import { AppWindow, Check, Crosshair, ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/ui/section-title";
import { SmallSelect } from "@/components/ui/small-select";
import type {
  ActiveWindowSnapshot,
  AppRule,
  AppRuleAction,
  AppRulePattern,
  AppRulePatternType as PatternType,
  AppRuleTarget as PatternTarget,
} from "@/shared/app-rules";
import { activeAppInfoFromSnapshot, matchAppPattern } from "@/shared/app-rules";
import {
  cloneEditableRule,
  RuleActionFields,
  RuleEditorFrame,
  RuleField,
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

const TARGET_HINTS: Record<PatternTarget, string> = {
  process: "应用进程显示名：macOS 用 app 名，Windows 用进程名。",
  title: "当前前台窗口的标题文本，会随打开的文档变化。",
};

const TYPE_HINTS: Record<PatternType, string> = {
  exact: "完整字符串相等，不区分大小写。",
  glob: "支持 *、** 和 ? 通配，不区分大小写。",
};

function emptyRuleDraft(target: PatternTarget = "process"): AppRule {
  return {
    id: "",
    pattern: { type: "exact", value: "", target },
    action: "disable",
  };
}

/** 规则匹配实时测试器：拿当前前台应用当活体样本，边写边告诉用户是否命中。 */
function MatchTester({
  draft,
  activeApp,
}: {
  draft: AppRule;
  activeApp: ActiveWindowSnapshot | null;
}) {
  const info = activeAppInfoFromSnapshot(activeApp);
  if (!info) return null;
  if (!draft.pattern.value.trim()) {
    return (
      <p className="text-2xs leading-relaxed text-slate-400">
        填入匹配值后，这里会显示是否命中当前前台应用。
      </p>
    );
  }
  const matched = matchAppPattern(info, draft.pattern);
  const sample = draft.pattern.target === "title" ? info.title : info.processName;
  return (
    <p
      className={`flex items-start gap-1.5 rounded-xl px-3 py-2 text-2xs leading-relaxed ${
        matched ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-500"
      }`}
    >
      {matched
        ? <Check className="mt-0.5 size-3 shrink-0 text-emerald-500" aria-hidden />
        : <X className="mt-0.5 size-3 shrink-0 text-slate-400" aria-hidden />}
      <span>
        {matched ? "命中" : "未命中"}当前前台
        {draft.pattern.target === "title" ? "窗口标题" : "进程名"}
        <code className="mx-1 rounded bg-white/70 px-1 py-0.5 font-medium">{sample || "(空)"}</code>
      </span>
    </p>
  );
}

function RuleEditor({
  draft,
  themes,
  activeApp,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  draft: AppRule;
  themes: RuleThemeOption[];
  activeApp: ActiveWindowSnapshot | null;
  error?: string;
  onChange: (rule: AppRule) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const target: PatternTarget = draft.pattern.target === "title" ? "title" : "process";
  const patternType: PatternType = draft.pattern.type === "glob" ? "glob" : "exact";
  const placeholder = target === "title"
    ? (patternType === "glob" ? "*Visual Studio Code*" : "package.json — Code")
    : (patternType === "glob" ? "code-*" : "Code");

  const fillFromActiveApp = () => {
    if (!activeApp?.authorized) return;
    const value = target === "title" ? activeApp.title : activeApp.processName;
    if (value) onChange({ ...draft, pattern: { ...draft.pattern, value } });
  };

  return (
    <RuleEditorFrame error={error} onSave={onSave} onCancel={onCancel}>
      <RuleField label="匹配维度" hint={TARGET_HINTS[target]}>
        <SmallSelect
          label="匹配维度"
          value={target}
          options={[
            { value: "process", label: PATTERN_TARGET_LABELS.process },
            { value: "title", label: PATTERN_TARGET_LABELS.title },
          ]}
          onChange={(value) => onChange({
            ...draft,
            pattern: { ...draft.pattern, target: value as PatternTarget },
          })}
        />
      </RuleField>

      <RuleField label="匹配方式" hint={TYPE_HINTS[patternType]}>
        <SmallSelect
          label="匹配方式"
          value={patternType}
          options={[
            { value: "exact", label: PATTERN_TYPE_LABELS.exact },
            { value: "glob", label: PATTERN_TYPE_LABELS.glob },
          ]}
          onChange={(value) => onChange({
            ...draft,
            pattern: { ...draft.pattern, type: value as PatternType },
          })}
        />
      </RuleField>

      <RuleField label="匹配值">
        <div className="flex items-stretch gap-1.5">
          <Input
            value={draft.pattern.value}
            placeholder={placeholder}
            onChange={(event) => onChange({
              ...draft,
              pattern: { ...draft.pattern, value: event.target.value },
            })}
          />
          {activeApp?.authorized ? (
            <Button
              variant="outline"
              className="h-9 shrink-0 px-2.5 text-2xs"
              onClick={fillFromActiveApp}
              title={`使用当前前台${target === "title" ? "窗口标题" : "进程名"}`}
            >
              <Crosshair className="mr-1 size-3" aria-hidden />
              取当前
            </Button>
          ) : null}
        </div>
      </RuleField>

      <MatchTester draft={draft} activeApp={activeApp} />

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
  const [editorError, setEditorError] = useState("");
  const [notice, setNotice] = useState("");

  const activeInfo = activeAppInfoFromSnapshot(activeApp);

  const cancelEdit = () => {
    setEditingRuleId(null);
    setDraftRule(null);
    setIsAdding(false);
    setEditorError("");
  };

  const startAdd = () => {
    setDraftRule(emptyRuleDraft());
    setIsAdding(true);
    setEditingRuleId(null);
    setEditorError("");
    setNotice("");
  };

  const startEdit = (ruleId: string) => {
    const rule = appRules.find((candidate) => candidate.id === ruleId);
    if (!rule) return;
    setDraftRule(cloneEditableRule(rule));
    setEditingRuleId(ruleId);
    setIsAdding(false);
    setEditorError("");
    setNotice("");
  };

  const saveEdit = () => {
    const value = draftRule?.pattern.value.trim();
    if (!draftRule) return;
    // 此前这里空值直接 return，点「保存」毫无反应。现在明确告知原因。
    if (!value) {
      setEditorError("请填写匹配值。");
      return;
    }
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

  /** 一步为当前前台应用创建禁用规则。 */
  const disableCurrentApp = () => {
    if (!activeApp?.authorized) return;
    const processName = activeApp.processName.trim();
    if (!processName) return;
    const existing = appRules.find((rule) => (
      (rule.pattern.target || "process") === "process"
      && rule.pattern.type === "exact"
      && rule.pattern.value.toLowerCase() === processName.toLowerCase()
    ));
    // 此前重复时静默 no-op，用户点了按钮不知道发生了什么。
    if (existing) {
      setNotice(`已存在针对 ${processName} 的规则，可直接编辑它。`);
      return;
    }
    addAppRule({
      pattern: { type: "exact", value: processName, target: "process" },
      action: "disable",
    });
    setNotice(`已为 ${processName} 添加禁用规则。`);
  };

  const isEditing = editingRuleId !== null || isAdding;
  const activeProcess = activeApp?.authorized ? activeApp.processName : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>应用规则</SectionTitle>
        <div className="flex items-center gap-1.5">
          {activeProcess ? (
            <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={disableCurrentApp}>
              禁用 {activeProcess}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={startAdd} aria-label="添加规则">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {activeApp?.authorized ? (
        <div className="space-y-0.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-2xs text-slate-500">
          <div>当前前台 <code className="font-medium text-slate-700">{activeApp.processName}</code></div>
          {activeApp.title ? <div className="truncate">窗口标题 <code className="font-medium text-slate-600">{activeApp.title}</code></div> : null}
        </div>
      ) : null}

      {activeApp && !activeApp.authorized ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-2xs text-amber-800">
          <div className="font-medium">
            {"message" in activeApp ? activeApp.message : "无法获取当前前台应用。"}
          </div>
          {openAccessibilitySettings ? (
            <button
              type="button"
              onClick={openAccessibilitySettings}
              className="mt-1 inline-flex items-center gap-1 text-2xs font-medium text-amber-900 underline underline-offset-2 transition-colors hover:text-amber-700"
            >
              打开系统设置 → 隐私与安全 → 辅助功能
              <ExternalLink className="size-3" />
            </button>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-xl bg-slate-50 px-3 py-2 text-2xs leading-relaxed text-slate-600">
          {notice}
        </p>
      ) : null}

      {isEditing && draftRule ? (
        <RuleEditor
          draft={draftRule}
          themes={themes}
          activeApp={activeApp}
          error={editorError}
          onChange={(next) => {
            setDraftRule(next);
            if (editorError) setEditorError("");
          }}
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
        matchesNow={activeInfo ? (rule) => matchAppPattern(activeInfo, rule.pattern) : undefined}
        emptyState={(
          <EmptyState
            icon={AppWindow}
            title="还没有应用规则"
            description="按进程名或窗口标题为指定应用启用 / 禁用效果，或切换到不同主题。"
            className="bg-white px-4 py-8"
            action={(
              <div className="flex items-center gap-2">
                <Button variant="default" className="h-8 px-3 text-xs" onClick={startAdd}>
                  <Plus className="mr-1.5 size-3.5" />添加规则
                </Button>
                {activeProcess ? (
                  <Button variant="outline" className="h-8 px-3 text-xs" onClick={disableCurrentApp}>
                    禁用 {activeProcess}
                  </Button>
                ) : null}
              </div>
            )}
          />
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
