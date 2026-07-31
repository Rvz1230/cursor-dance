import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import {
  cloneEditableRule,
  RuleActionFields,
  RuleEditorFrame,
  RuleList,
  type EditableRule,
  type EditableRuleAction,
  type RuleThemeOption,
} from "./context-rules/RulePrimitives";

type SitePatternType = "exact" | "glob" | "path";

interface SiteRule extends EditableRule {
  pattern: EditableRule["pattern"] & {
    type: SitePatternType;
    hostType?: "exact" | "glob";
  };
}

interface SiteRulesPanelProps {
  siteRules?: SiteRule[];
  themes?: RuleThemeOption[];
  activeHost?: string;
  addSiteRule: (rule: { pattern: SiteRule["pattern"]; action: EditableRuleAction }) => void;
  updateSiteRule: (id: string, updates: Partial<SiteRule>) => void;
  deleteSiteRule: (id: string) => void;
  reorderSiteRules: (from: number, to: number) => void;
  toggleSiteRule: (id: string) => void;
  clearAllSiteRules: () => void;
}

const PATTERN_TYPE_LABELS: Record<SitePatternType, string> = {
  exact: "精确域名",
  glob: "通配符",
  path: "路径前缀",
};

function emptyRuleDraft(): SiteRule {
  return {
    id: "",
    pattern: { type: "exact", value: "" },
    action: "disable",
  };
}

function RuleEditor({
  draft,
  themes,
  onChange,
  onSave,
  onCancel,
}: {
  draft: SiteRule;
  themes: RuleThemeOption[];
  onChange: (rule: SiteRule) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <RuleEditorFrame onSave={onSave} onCancel={onCancel}>
      <div className="space-y-2">
        <label className="block text-2xs font-medium text-slate-500">匹配方式</label>
        <select
          value={draft.pattern.type}
          onChange={(event) => onChange({
            ...draft,
            pattern: { ...draft.pattern, type: event.target.value as SitePatternType },
          })}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="exact">精确域名 — example.com</option>
          <option value="glob">通配符 — *.example.com / **.example.com</option>
          <option value="path">路径前缀 — example.com/blog</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="block text-2xs font-medium text-slate-500">匹配值</label>
        <input
          type="text"
          value={draft.pattern.value}
          onChange={(event) => onChange({
            ...draft,
            pattern: { ...draft.pattern, value: event.target.value },
          })}
          placeholder={draft.pattern.type === "path" ? "example.com/blog" : "example.com"}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>
      <RuleActionFields draft={draft} themes={themes} onChange={onChange} />
    </RuleEditorFrame>
  );
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
}: SiteRulesPanelProps) {
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [draftRule, setDraftRule] = useState<SiteRule | null>(null);
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
    const rule = siteRules.find((candidate) => candidate.id === ruleId);
    if (!rule) return;
    setDraftRule(cloneEditableRule(rule));
    setEditingRuleId(ruleId);
    setIsAdding(false);
  };

  const saveEdit = () => {
    const value = draftRule?.pattern.value.trim();
    if (!draftRule || !value) return;
    const payload = {
      pattern: { ...draftRule.pattern, value },
      action: draftRule.action,
    };
    if (isAdding) addSiteRule(payload);
    else if (editingRuleId) updateSiteRule(editingRuleId, payload);
    cancelEdit();
  };

  const quickAdd = () => {
    if (!activeHost || activeHost === "example.com") return;
    const exists = siteRules.some((rule) => (
      rule.pattern.type === "exact"
      && rule.pattern.value.toLowerCase() === activeHost.toLowerCase()
    ));
    if (!exists) addSiteRule({ pattern: { type: "exact", value: activeHost }, action: "disable" });
  };

  const isEditing = editingRuleId !== null || isAdding;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>站点规则</SectionTitle>
        <div className="flex items-center gap-1.5">
          {activeHost && activeHost !== "example.com" ? (
            <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={quickAdd}>
              为 {activeHost} 添加规则
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={startAdd} aria-label="添加规则">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {activeHost ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-2xs text-slate-500">
          当前站点 <code className="font-medium text-slate-700">{activeHost}</code>
        </div>
      ) : null}

      {isEditing && draftRule ? (
        <RuleEditor
          draft={draftRule}
          themes={themes}
          onChange={setDraftRule}
          onSave={saveEdit}
          onCancel={cancelEdit}
        />
      ) : null}

      <RuleList
        rules={siteRules}
        themes={themes}
        describePattern={(rule) => PATTERN_TYPE_LABELS[rule.pattern.type]}
        emptyState={(
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
            <p className="text-sm text-slate-400">暂无站点规则</p>
            <p className="mt-1 text-2xs text-slate-300">点击上方 + 添加第一条规则，或快速添加当前站点</p>
          </div>
        )}
        isEditing={isEditing}
        onToggle={toggleSiteRule}
        onEdit={startEdit}
        onDelete={deleteSiteRule}
        onReorder={reorderSiteRules}
        onClear={clearAllSiteRules}
      />
    </div>
  );
}
