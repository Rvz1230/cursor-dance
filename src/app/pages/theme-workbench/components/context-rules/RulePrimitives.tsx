import type { ReactNode } from "react";
import { GripVertical, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { DataPill } from "@/components/ui/data-pill";
import { SectionTitle } from "@/components/ui/section-title";

export type EditableRuleAction = "disable" | { enable: boolean; theme?: string };

interface EditableRulePattern {
  type: string;
  value: string;
  target?: string;
  hostType?: string;
}

export interface EditableRule {
  id: string;
  enabled?: boolean;
  pattern: EditableRulePattern;
  action: EditableRuleAction;
}

export interface RuleThemeOption {
  id: string;
  name: string;
}

export function cloneEditableRule<T extends EditableRule>(rule: T): T {
  return {
    ...rule,
    pattern: { ...rule.pattern },
    action: typeof rule.action === "object" ? { ...rule.action } : rule.action,
  };
}

export function RuleActionFields<T extends EditableRule>({
  draft,
  themes,
  onChange,
  disableLabel = "禁用效果",
  enableLabel = "启用效果",
}: {
  draft: T;
  themes: RuleThemeOption[];
  onChange: (draft: T) => void;
  disableLabel?: string;
  enableLabel?: string;
}) {
  const actionType = draft.action === "disable" ? "disable" : "enable";
  const updateAction = (action: EditableRuleAction) => onChange({ ...draft, action } as T);

  return (
    <>
      <div className="space-y-2">
        <label className="block text-2xs font-medium text-slate-500">操作</label>
        <select
          value={actionType}
          onChange={(event) => updateAction(
            event.target.value === "disable" ? "disable" : { enable: true },
          )}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="disable">{disableLabel}</option>
          <option value="enable">{enableLabel}</option>
        </select>
      </div>

      {actionType === "enable" ? (
        <div className="space-y-2">
          <label className="block text-2xs font-medium text-slate-500">主题 (可选)</label>
          <select
            value={draft.action === "disable" ? "" : (draft.action.theme || "")}
            onChange={(event) => {
              const theme = event.target.value || undefined;
              updateAction({ enable: true, ...(theme ? { theme } : {}) });
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">跟随全局主题</option>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.name}</option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}

export function RuleEditorFrame({
  children,
  onSave,
  onCancel,
}: {
  children: ReactNode;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <SectionTitle>规则编辑</SectionTitle>
      {children}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="h-8 px-3 text-xs" onClick={onCancel}>取消</Button>
        <Button variant="default" className="h-8 px-3 text-xs" onClick={onSave}>保存</Button>
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: EditableRuleAction }) {
  if (action === "disable") return <DataPill tone="amber">禁用</DataPill>;
  return (
    <DataPill tone="teal">
      启用{action.theme ? ` · ${action.theme}` : ""}
    </DataPill>
  );
}

export function RuleList<T extends EditableRule>({
  rules,
  themes,
  describePattern,
  emptyState,
  isEditing,
  onToggle,
  onEdit,
  onDelete,
  onReorder,
  onClear,
}: {
  rules: T[];
  themes: RuleThemeOption[];
  describePattern: (rule: T) => string;
  emptyState: ReactNode;
  isEditing: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onClear: () => void;
}) {
  const handleDragStart = (event: React.DragEvent, id: string) => {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (event: React.DragEvent, targetId: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain");
    if (sourceId === targetId) return;
    const fromIndex = rules.findIndex((rule) => rule.id === sourceId);
    const toIndex = rules.findIndex((rule) => rule.id === targetId);
    if (fromIndex >= 0 && toIndex >= 0) onReorder(fromIndex, toIndex);
  };

  if (rules.length === 0 && !isEditing) return <>{emptyState}</>;

  return (
    <>
      <div className="space-y-1.5">
        {rules.map((rule) => {
          const themeId = rule.action === "disable" ? "" : rule.action.theme;
          const themeName = themeId
            ? (themes.find((theme) => theme.id === themeId)?.name || themeId)
            : null;
          return (
            <div
              key={rule.id}
              className={cn(
                "group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors",
                rule.enabled === false
                  ? "border-slate-100 bg-slate-50/50 opacity-60"
                  : "border-slate-200 bg-white shadow-sm",
              )}
              draggable
              onDragStart={(event) => handleDragStart(event, rule.id)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => handleDrop(event, rule.id)}
            >
              <button className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing" aria-label="拖拽排序">
                <GripVertical className="size-3.5" />
              </button>
              <button
                onClick={() => onToggle(rule.id)}
                className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
                aria-label={rule.enabled !== false ? "禁用规则" : "启用规则"}
              >
                {rule.enabled !== false
                  ? <ToggleRight className="size-4 text-emerald-500" />
                  : <ToggleLeft className="size-4" />}
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-2xs font-medium text-slate-400">{describePattern(rule)}</span>
                <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-2xs font-medium text-slate-700">
                  {rule.pattern.value || "(空)"}
                </code>
                <ActionBadge action={rule.action} />
                {themeName ? <span className="truncate text-2xs text-slate-400">{themeName}</span> : null}
              </div>
              <button
                onClick={() => onEdit(rule.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-2xs font-medium text-slate-500 opacity-0 transition-colors hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
              >
                编辑
              </button>
              <button
                onClick={() => onDelete(rule.id)}
                className="shrink-0 rounded-lg p-1 text-slate-300 opacity-0 transition-colors hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                aria-label="删除规则"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      {rules.length > 0 ? (
        <button onClick={onClear} className="text-2xs text-slate-400 transition-colors hover:text-rose-500">
          清除全部规则
        </button>
      ) : null}
    </>
  );
}
