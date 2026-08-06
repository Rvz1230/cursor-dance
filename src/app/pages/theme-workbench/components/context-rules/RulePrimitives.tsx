import type { ReactNode } from "react";
import { GripVertical, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { DataPill } from "@/components/ui/data-pill";
import { FieldHint } from "@/components/ui/field-hint";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";

/**
 * 规则编辑器的字段外壳。
 *
 * 说明文字放在 label 旁的 hint / tooltip 里，而不是塞进 `<option>` 文本——
 * 后者是缺少字段描述位时的变通做法，原生 select 既无法样式化也会截断。
 */
export function RuleField({
  label,
  hint,
  tooltip,
  children,
}: {
  label: string;
  hint?: string;
  tooltip?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        {tooltip ? <FieldHint content={tooltip} /> : null}
      </div>
      {children}
      {hint ? <p className="text-2xs leading-relaxed text-slate-400">{hint}</p> : null}
    </div>
  );
}

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
      <RuleField label="操作">
        <Select
          label="操作"
          value={actionType}
          options={[
            { value: "disable", label: disableLabel },
            { value: "enable", label: enableLabel },
          ]}
          onChange={(value) => updateAction(value === "disable" ? "disable" : { enable: true })}
        />
      </RuleField>

      {actionType === "enable" ? (
        <RuleField label="主题" hint="不选则跟随全局主题。">
          <Select
            label="主题"
            value={draft.action === "disable" ? "" : (draft.action.theme || "")}
            options={[
              { value: "", label: "跟随全局主题" },
              ...themes.map((theme) => ({ value: theme.id, label: theme.name })),
            ]}
            onChange={(value) => updateAction({ enable: true, ...(value ? { theme: value } : {}) })}
          />
        </RuleField>
      ) : null}
    </>
  );
}

export function RuleEditorFrame({
  children,
  error,
  onSave,
  onCancel,
}: {
  children: ReactNode;
  /** 保存受阻的原因。此前空值时 saveEdit 直接静默 return，点「保存」什么都不发生。 */
  error?: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <SectionTitle>规则编辑</SectionTitle>
      {children}
      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">
          {error}
        </p>
      ) : null}
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
  matchesNow,
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
  /** 该规则此刻是否命中当前上下文。用于把「顺序即优先级」变得可见。 */
  matchesNow?: (rule: T) => boolean;
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

  // 第一条命中的规则决定结果，所以顺序就是优先级。
  const firstMatchIndex = matchesNow
    ? rules.findIndex((rule) => rule.enabled !== false && matchesNow(rule))
    : -1;

  return (
    <>
      {rules.length > 1 ? (
        <p className="text-2xs leading-relaxed text-slate-400">
          从上到下匹配，命中的第一条生效。拖动左侧手柄可调整优先级。
        </p>
      ) : null}
      <div className="space-y-1.5">
        {rules.map((rule, index) => {
          const themeId = rule.action === "disable" ? "" : rule.action.theme;
          const themeName = themeId
            ? (themes.find((theme) => theme.id === themeId)?.name || themeId)
            : null;
          const isActiveMatch = index === firstMatchIndex;
          const isShadowedMatch = !isActiveMatch
            && firstMatchIndex >= 0
            && rule.enabled !== false
            && Boolean(matchesNow?.(rule));
          return (
            <div
              key={rule.id}
              className={cn(
                "group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors",
                rule.enabled === false
                  ? "border-slate-100 bg-slate-50/50 opacity-60"
                  : isActiveMatch
                    ? "border-slate-950 bg-white shadow-sm"
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
                {isActiveMatch ? <DataPill tone="teal">当前生效</DataPill> : null}
                {isShadowedMatch ? (
                  <span className="shrink-0 text-2xs text-slate-400">已被上方规则覆盖</span>
                ) : null}
              </div>
              <button
                onClick={() => onEdit(rule.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-2xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                编辑
              </button>
              <button
                onClick={() => onDelete(rule.id)}
                className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
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
