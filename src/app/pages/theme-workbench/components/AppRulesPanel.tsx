// 任务 4.2：桌面端应用规则面板
//
// 复用 SiteRulesPanel 的数据流（state.siteRules / addSiteRule / updateSiteRule 等）
// 和拖拽 / 增删 / 启停语义；UI 维度从「URL host/path」切到「进程名 / 窗口标题」+
// exact / glob 两种 pattern.type，新增 pattern.target 选择匹配维度。
//
// 与 src/desktop/renderer/engine/app-matcher.ts 的 AppRule 数据形态保持一致：
//   { id, pattern: { type, value, target }, action: "disable" | { enable, theme? }, enabled }
// store 上 key 名仍叫 siteRules（不破坏扩展端数据契约和现有测试）。

import { useEffect, useState } from "react";
import { GripVertical, Plus, Trash2, ToggleLeft, ToggleRight, Crosshair, AppWindow, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { Panel, SectionTitle, DataPill } from "./WorkbenchControls";

type PatternType = "exact" | "glob";
type PatternTarget = "process" | "title";

interface AppRulePattern {
  type: PatternType;
  value: string;
  target?: PatternTarget;
}

interface AppRuleEnableAction {
  enable: true;
  theme?: string;
}

type AppRuleAction = "disable" | AppRuleEnableAction;

interface AppRule {
  id: string;
  pattern: AppRulePattern;
  action: AppRuleAction;
  enabled?: boolean;
}

interface ThemeOption {
  id: string;
  name: string;
}

interface ActiveAppSnapshot {
  authorized: boolean;
  processName?: string;
  title?: string;
  message?: string;
}

const PATTERN_TYPE_LABELS: Record<PatternType, string> = {
  exact: "精确匹配",
  glob: "通配符",
};

const PATTERN_TARGET_LABELS: Record<PatternTarget, string> = {
  process: "进程名",
  title: "窗口标题",
};

function PatternLabel({ pattern }: { pattern?: AppRulePattern | null }) {
  if (!pattern || !pattern.type) return <span className="text-slate-400">—</span>;
  return (
    <code className="text-2xs font-medium text-slate-700 bg-slate-100 rounded-md px-1.5 py-0.5">
      {pattern.value || "(空)"}
    </code>
  );
}

function ActionBadge({ action }: { action: AppRuleAction }) {
  if (action === "disable") {
    return <DataPill tone="amber">禁用</DataPill>;
  }
  if (action && typeof action === "object" && action.enable) {
    return (
      <DataPill tone="teal">
        启用{action.theme ? ` · ${action.theme}` : ""}
      </DataPill>
    );
  }
  return <DataPill tone="slate">未知</DataPill>;
}

interface RuleRowProps {
  rule: AppRule;
  themes: ThemeOption[];
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
}

function RuleRow({ rule, themes, onToggle, onEdit, onDelete, onDragStart, onDragOver, onDrop }: RuleRowProps) {
  const themeName = rule.action && typeof rule.action === "object" && rule.action.theme
    ? (themes.find((t) => t.id === rule.action.theme)?.name || rule.action.theme)
    : null;
  const targetLabel = PATTERN_TARGET_LABELS[rule.pattern?.target || "process"];
  const typeLabel = PATTERN_TYPE_LABELS[rule.pattern?.type || "exact"];

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors",
        rule.enabled === false
          ? "border-slate-100 bg-slate-50/50 opacity-60"
          : "border-slate-200 bg-white shadow-sm"
      )}
      draggable
      onDragStart={(e) => onDragStart(e, rule.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, rule.id)}
    >
      <button
        className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
        aria-label="拖拽排序"
      >
        <GripVertical className="size-3.5" />
      </button>

      <button
        onClick={() => onToggle(rule.id)}
        className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
        aria-label={rule.enabled !== false ? "禁用规则" : "启用规则"}
      >
        {rule.enabled !== false ? (
          <ToggleRight className="size-4 text-emerald-500" />
        ) : (
          <ToggleLeft className="size-4" />
        )}
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-2xs font-medium text-slate-400 shrink-0">
          {targetLabel} · {typeLabel}
        </span>
        <PatternLabel pattern={rule.pattern} />
        <ActionBadge action={rule.action} />
        {themeName && (
          <span className="text-2xs text-slate-400 truncate">{themeName}</span>
        )}
      </div>

      <button
        onClick={() => onEdit(rule.id)}
        className="shrink-0 rounded-lg px-2 py-1 text-2xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors opacity-0 group-hover:opacity-100"
      >
        编辑
      </button>

      <button
        onClick={() => onDelete(rule.id)}
        className="shrink-0 rounded-lg p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="删除规则"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

interface RuleEditorProps {
  draft: AppRule;
  themes: ThemeOption[];
  activeApp: ActiveAppSnapshot | null;
  onChange: (draft: AppRule) => void;
  onSave: () => void;
  onCancel: () => void;
}

function RuleEditor({ draft, themes, activeApp, onChange, onSave, onCancel }: RuleEditorProps) {
  const actionType: "disable" | "enable" = draft.action === "disable" ? "disable" : "enable";
  const target: PatternTarget = draft.pattern?.target === "title" ? "title" : "process";
  const patternType: PatternType = draft.pattern?.type === "glob" ? "glob" : "exact";

  const placeholder = target === "title"
    ? (patternType === "glob" ? "*Visual Studio Code*" : "package.json — Code")
    : (patternType === "glob" ? "code-*" : "Code");

  function fillFromActiveApp(field: PatternTarget) {
    if (!activeApp || !activeApp.authorized) return;
    const value = field === "title" ? activeApp.title : activeApp.processName;
    if (!value) return;
    onChange({
      ...draft,
      pattern: { ...draft.pattern, target: field, value },
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <SectionTitle>规则编辑</SectionTitle>

      <div className="space-y-2">
        <label className="block text-2xs font-medium text-slate-500">匹配维度</label>
        <select
          value={target}
          onChange={(e) => onChange({
            ...draft,
            pattern: { ...draft.pattern, target: e.target.value as PatternTarget },
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
          onChange={(e) => onChange({
            ...draft,
            pattern: { ...draft.pattern, type: e.target.value as PatternType },
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
            value={draft.pattern?.value || ""}
            onChange={(e) => onChange({ ...draft, pattern: { ...draft.pattern, value: e.target.value } })}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          {activeApp?.authorized && (
            <button
              type="button"
              onClick={() => fillFromActiveApp(target)}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-2xs font-medium text-slate-600 hover:bg-slate-100"
              title={`使用当前前台${target === "title" ? "窗口标题" : "进程名"}`}
            >
              <Crosshair className="size-3" />
              取当前
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-2xs font-medium text-slate-500">操作</label>
        <select
          value={actionType}
          onChange={(e) => {
            const nextType = e.target.value;
            onChange({
              ...draft,
              action: nextType === "disable" ? "disable" : { enable: true },
            });
          }}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="disable">在该应用中禁用效果</option>
          <option value="enable">在该应用中启用效果</option>
        </select>
      </div>

      {actionType === "enable" && (
        <div className="space-y-2">
          <label className="block text-2xs font-medium text-slate-500">主题 (可选)</label>
          <select
            value={(draft.action as AppRuleEnableAction)?.theme || ""}
            onChange={(e) => {
              const theme = e.target.value || undefined;
              onChange({
                ...draft,
                action: { enable: true, ...(theme ? { theme } : {}) },
              });
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">跟随全局主题</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="h-8 px-3 text-xs" onClick={onCancel}>取消</Button>
        <Button variant="default" className="h-8 px-3 text-xs" onClick={onSave}>保存</Button>
      </div>
    </div>
  );
}

function emptyRuleDraft(target: PatternTarget = "process"): AppRule {
  return {
    id: "",
    pattern: { type: "exact", value: "", target },
    action: "disable",
  };
}

export interface AppRulesPanelProps {
  appRules: AppRule[];
  themes: ThemeOption[];
  /**
   * 桌面 IPC 探针：每次面板打开 / 焦点变化时拉取当前前台窗口快照。
   * 实现见 src/desktop/preload/index.ts 的 cursorDanceApp.getActiveWindow。
   * 传 null 退化为「无活跃应用」。
   */
  fetchActiveApp?: () => Promise<ActiveAppSnapshot | null>;
  /**
   * macOS 未授权时点击「打开系统设置」时使用。在 ThemeWorkbenchPage 注入。
   * 传 undefined 时面板隐藏该 CTA（仍显示提示文案）。
   */
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
  fetchActiveApp,
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
  const [activeApp, setActiveApp] = useState<ActiveAppSnapshot | null>(null);

  // 拉一次当前前台应用，给「取当前」按钮和快速添加用。get-windows 同步路径很便宜
  // （任务 3.2 注释），这里不做轮询；用户切应用后重新打开面板即可刷新。
  useEffect(() => {
    if (!fetchActiveApp) return;
    let cancelled = false;
    fetchActiveApp().then((snap) => {
      if (cancelled) return;
      setActiveApp(snap);
    }).catch(() => {
      if (cancelled) return;
      setActiveApp({ authorized: false, message: "无法获取当前前台应用。" });
    });
    return () => { cancelled = true; };
  }, [fetchActiveApp]);

  function handleStartAdd() {
    setDraftRule(emptyRuleDraft());
    setIsAdding(true);
    setEditingRuleId(null);
  }

  function handleStartEdit(ruleId: string) {
    const rule = appRules.find((r) => r.id === ruleId);
    if (!rule) return;
    setDraftRule({
      id: rule.id,
      pattern: { ...rule.pattern },
      action: typeof rule.action === "object" && rule.action !== null
        ? { ...rule.action }
        : rule.action,
    });
    setEditingRuleId(ruleId);
    setIsAdding(false);
  }

  function handleCancelEdit() {
    setEditingRuleId(null);
    setDraftRule(null);
    setIsAdding(false);
  }

  function handleSaveEdit() {
    if (!draftRule || !draftRule.pattern?.value?.trim()) return;
    const payload = {
      pattern: {
        type: draftRule.pattern.type,
        value: draftRule.pattern.value.trim(),
        target: draftRule.pattern.target || "process",
      } as AppRulePattern,
      action: draftRule.action,
    };
    if (isAdding) {
      addAppRule(payload);
    } else if (editingRuleId) {
      updateAppRule(editingRuleId, payload);
    }
    handleCancelEdit();
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    if (sourceId === targetId) return;
    const fromIndex = appRules.findIndex((r) => r.id === sourceId);
    const toIndex = appRules.findIndex((r) => r.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    reorderAppRules(fromIndex, toIndex);
  }

  function handleQuickAdd() {
    if (!activeApp || !activeApp.authorized) return;
    const processName = activeApp.processName?.trim();
    if (!processName) return;
    const exists = appRules.some(
      (r) =>
        (r.pattern?.target || "process") === "process"
        && r.pattern?.type === "exact"
        && r.pattern?.value?.toLowerCase() === processName.toLowerCase(),
    );
    if (exists) return;
    addAppRule({
      pattern: { type: "exact", value: processName, target: "process" },
      action: "disable",
    });
  }

  const isEditing = editingRuleId !== null || isAdding;
  const activeProcess = activeApp?.authorized ? activeApp.processName : null;
  const showQuickAdd = Boolean(activeProcess);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>应用规则</SectionTitle>
        <div className="flex items-center gap-1.5">
          {showQuickAdd && (
            <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={handleQuickAdd}>
              为 {activeProcess} 添加规则
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleStartAdd} aria-label="添加规则">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {activeApp && activeApp.authorized && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-2xs text-slate-500 space-y-0.5">
          <div>当前前台 <code className="font-medium text-slate-700">{activeApp.processName}</code></div>
          {activeApp.title && (
            <div className="truncate">窗口标题 <code className="font-medium text-slate-600">{activeApp.title}</code></div>
          )}
        </div>
      )}

      {activeApp && !activeApp.authorized && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-2xs text-amber-800">
          <div className="font-medium">{activeApp.message || "无法获取当前前台应用。"}</div>
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
      )}

      {isEditing && draftRule && (
        <RuleEditor
          draft={draftRule}
          themes={themes}
          activeApp={activeApp}
          onChange={setDraftRule}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      )}

      {appRules.length === 0 && !isEditing ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
          <div className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <AppWindow className="size-5" aria-hidden />
          </div>
          <p className="mt-3 text-xs font-medium text-slate-600">还没有应用规则</p>
          <p className="mx-auto mt-1.5 max-w-sm text-2xs leading-5 text-slate-500">
            按进程名或窗口标题为指定应用启用 / 禁用效果，或切换到不同主题。
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="default"
              className="h-8 px-3 text-xs"
              onClick={handleStartAdd}
            >
              <Plus className="mr-1.5 size-3.5" />
              添加规则
            </Button>
            {showQuickAdd ? (
              <Button
                variant="outline"
                className="h-8 px-3 text-xs"
                onClick={handleQuickAdd}
              >
                为 {activeProcess} 创建禁用规则
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {appRules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              themes={themes}
              onToggle={toggleAppRule}
              onEdit={handleStartEdit}
              onDelete={deleteAppRule}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      {appRules.length > 0 && (
        <button
          onClick={clearAllAppRules}
          className="text-2xs text-slate-400 hover:text-rose-500 transition-colors"
        >
          清除全部规则
        </button>
      )}
    </div>
  );
}
