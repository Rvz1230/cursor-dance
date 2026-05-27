import { useState } from "react";
import { GripVertical, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { cn } from "@/components/ui/utils.js";
import { Panel, SectionTitle, DataPill } from "./WorkbenchControls.jsx";

const PATTERN_TYPE_LABELS = {
  exact: "精确域名",
  glob: "通配符",
  path: "路径前缀",
};

function PatternLabel({ pattern }) {
  if (!pattern || !pattern.type) return <span className="text-slate-400">—</span>;
  return (
    <code className="text-[11px] font-medium text-slate-700 bg-slate-100 rounded-md px-1.5 py-0.5">
      {pattern.value || "(空)"}
    </code>
  );
}

function ActionBadge({ action }) {
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

function RuleRow({ rule, themes, onToggle, onEdit, onDelete, onDragStart, onDragOver, onDrop }) {
  const themeName = rule.action && rule.action.theme
    ? (themes.find((t) => t.id === rule.action.theme)?.name || rule.action.theme)
    : null;

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
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider shrink-0">
          {PATTERN_TYPE_LABELS[rule.pattern?.type] || rule.pattern?.type}
        </span>
        <PatternLabel pattern={rule.pattern} />
        <ActionBadge action={rule.action} />
        {themeName && (
          <span className="text-[10px] text-slate-400 truncate">{themeName}</span>
        )}
      </div>

      <button
        onClick={() => onEdit(rule.id)}
        className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors opacity-0 group-hover:opacity-100"
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

function RuleEditor({ draft, themes, onChange, onSave, onCancel }) {
  const actionType = draft.action === "disable" ? "disable" : "enable";

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <SectionTitle>规则编辑</SectionTitle>

      <div className="space-y-2">
        <label className="block text-[11px] font-medium text-slate-500">匹配方式</label>
        <select
          value={draft.pattern?.type || "exact"}
          onChange={(e) => onChange({ ...draft, pattern: { ...draft.pattern, type: e.target.value } })}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="exact">精确域名 — example.com</option>
          <option value="glob">通配符 — *.example.com / **.example.com</option>
          <option value="path">路径前缀 — example.com/blog</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-medium text-slate-500">匹配值</label>
        <input
          type="text"
          value={draft.pattern?.value || ""}
          onChange={(e) => onChange({ ...draft, pattern: { ...draft.pattern, value: e.target.value } })}
          placeholder={draft.pattern?.type === "path" ? "example.com/blog" : "example.com"}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-medium text-slate-500">操作</label>
        <select
          value={actionType}
          onChange={(e) => {
            const nextType = e.target.value;
            onChange({
              ...draft,
              action: nextType === "disable" ? "disable" : { enable: true },
            });
          }}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="disable">禁用效果</option>
          <option value="enable">启用效果</option>
        </select>
      </div>

      {actionType === "enable" && (
        <div className="space-y-2">
          <label className="block text-[11px] font-medium text-slate-500">主题 (可选)</label>
          <select
            value={draft.action?.theme || ""}
            onChange={(e) => {
              const theme = e.target.value || undefined;
              onChange({
                ...draft,
                action: { enable: true, ...(theme ? { theme } : {}) },
              });
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
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

function emptyRuleDraft() {
  return {
    pattern: { type: "exact", value: "" },
    action: "disable",
  };
}

export function SiteRulesPanel({
  siteRules = [],
  themes = [],
  activeHost,
  addSiteRule,
  updateSiteRule,
  deleteSiteRule,
  reorderSiteRules,
  toggleSiteRule,
  clearAllSiteRules,
}) {
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [draftRule, setDraftRule] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  function handleStartAdd() {
    setDraftRule(emptyRuleDraft());
    setIsAdding(true);
    setEditingRuleId(null);
  }

  function handleStartEdit(ruleId) {
    const rule = siteRules.find((r) => r.id === ruleId);
    if (!rule) return;
    setDraftRule({
      pattern: { ...rule.pattern },
      action: typeof rule.action === "object" && rule.action !== null && !Array.isArray(rule.action)
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
      pattern: { ...draftRule.pattern, value: draftRule.pattern.value.trim() },
      action: draftRule.action,
    };
    if (isAdding) {
      addSiteRule(payload);
    } else if (editingRuleId) {
      updateSiteRule(editingRuleId, payload);
    }
    handleCancelEdit();
  }

  function handleDragStart(e, id) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e, targetId) {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    if (sourceId === targetId) return;
    const fromIndex = siteRules.findIndex((r) => r.id === sourceId);
    const toIndex = siteRules.findIndex((r) => r.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    reorderSiteRules(fromIndex, toIndex);
  }

  function handleQuickAdd() {
    if (!activeHost || activeHost === "example.com") return;
    const exists = siteRules.some(
      (r) => r.pattern?.type === "exact" && r.pattern?.value?.toLowerCase() === activeHost.toLowerCase()
    );
    if (exists) return;
    addSiteRule({
      pattern: { type: "exact", value: activeHost },
      action: "disable",
    });
  }

  const isEditing = editingRuleId !== null || isAdding;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>站点规则</SectionTitle>
        <div className="flex items-center gap-1.5">
          {activeHost && activeHost !== "example.com" && (
            <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={handleQuickAdd}>
              为 {activeHost} 添加规则
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleStartAdd} aria-label="添加规则">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {activeHost && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          当前站点 <code className="font-medium text-slate-700">{activeHost}</code>
        </div>
      )}

      {isEditing && (
        <RuleEditor
          draft={draftRule}
          themes={themes}
          onChange={setDraftRule}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      )}

      {siteRules.length === 0 && !isEditing ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
          <p className="text-[13px] text-slate-400">暂无站点规则</p>
          <p className="mt-1 text-[11px] text-slate-300">
            点击上方 + 添加第一条规则，或通过 URL 测试器快速添加当前站点
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {siteRules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              themes={themes}
              onToggle={toggleSiteRule}
              onEdit={handleStartEdit}
              onDelete={deleteSiteRule}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      {siteRules.length > 0 && (
        <button
          onClick={clearAllSiteRules}
          className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
        >
          清除全部规则
        </button>
      )}
    </div>
  );
}
