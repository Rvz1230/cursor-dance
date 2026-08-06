import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";
import { matchHostPattern } from "@/shared/web-context-rules";
import { workbenchWebPatternToMatch } from "../lib/theme-draft/contextRuleAdapter";
import {
  cloneEditableRule,
  RuleActionFields,
  RuleEditorFrame,
  RuleField,
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

const TYPE_HINTS: Record<SitePatternType, string> = {
  exact: "完整域名相等，例如 example.com。",
  glob: "* 匹配单段，** 跨段，例如 *.example.com。",
  path: "域名 + 路径前缀，例如 example.com/blog。",
};

function matchesHost(pattern: SiteRule["pattern"], host: string): boolean {
  return matchHostPattern(host, workbenchWebPatternToMatch(pattern));
}

/** 站点规则匹配测试器：拿当前站点当活体样本，与生产解析共用同一份 pattern 语义。 */
function MatchTester({ draft, activeHost }: { draft: SiteRule; activeHost?: string }) {
  if (!activeHost) return null;
  if (!draft.pattern.value.trim()) {
    return (
      <p className="text-2xs leading-relaxed text-slate-400">
        填入匹配值后，这里会显示是否命中当前站点。
      </p>
    );
  }
  const matched = matchesHost(draft.pattern, activeHost);
  const hasPath = draft.pattern.type === "path";
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
        {matched ? "命中" : "未命中"}当前站点
        <code className="mx-1 rounded bg-white/70 px-1 py-0.5 font-medium">{activeHost}</code>
        {hasPath ? "（仅比对域名部分，路径需实际访问时才生效）" : null}
      </span>
    </p>
  );
}

function RuleEditor({
  draft,
  themes,
  activeHost,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  draft: SiteRule;
  themes: RuleThemeOption[];
  activeHost?: string;
  error?: string;
  onChange: (rule: SiteRule) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <RuleEditorFrame error={error} onSave={onSave} onCancel={onCancel}>
      <RuleField label="匹配方式" hint={TYPE_HINTS[draft.pattern.type]}>
        <Select
          label="匹配方式"
          value={draft.pattern.type}
          options={[
            { value: "exact", label: PATTERN_TYPE_LABELS.exact },
            { value: "glob", label: PATTERN_TYPE_LABELS.glob },
            { value: "path", label: PATTERN_TYPE_LABELS.path },
          ]}
          onChange={(value) => onChange({
            ...draft,
            pattern: { ...draft.pattern, type: value as SitePatternType },
          })}
        />
      </RuleField>

      <RuleField label="匹配值">
        <Input
          value={draft.pattern.value}
          placeholder={draft.pattern.type === "path" ? "example.com/blog" : "example.com"}
          onChange={(event) => onChange({
            ...draft,
            pattern: { ...draft.pattern, value: event.target.value },
          })}
        />
      </RuleField>

      <MatchTester draft={draft} activeHost={activeHost} />

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
  const [editorError, setEditorError] = useState("");
  const [notice, setNotice] = useState("");

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
    const rule = siteRules.find((candidate) => candidate.id === ruleId);
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
    // 此前空值直接 return，点「保存」毫无反应。
    if (!value) {
      setEditorError("请填写匹配值。");
      return;
    }
    const payload = {
      pattern: { ...draftRule.pattern, value },
      action: draftRule.action,
    };
    if (isAdding) addSiteRule(payload);
    else if (editingRuleId) updateSiteRule(editingRuleId, payload);
    cancelEdit();
  };

  /** 一步为当前站点创建禁用规则。 */
  const disableCurrentSite = () => {
    if (!activeHost || activeHost === "example.com") return;
    const exists = siteRules.some((rule) => (
      rule.pattern.type === "exact"
      && rule.pattern.value.toLowerCase() === activeHost.toLowerCase()
    ));
    // 此前重复时静默 no-op。
    if (exists) {
      setNotice(`已存在针对 ${activeHost} 的规则，可直接编辑它。`);
      return;
    }
    addSiteRule({ pattern: { type: "exact", value: activeHost }, action: "disable" });
    setNotice(`已为 ${activeHost} 添加禁用规则。`);
  };

  const isEditing = editingRuleId !== null || isAdding;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>站点规则</SectionTitle>
        <div className="flex items-center gap-1.5">
          {activeHost && activeHost !== "example.com" ? (
            <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={disableCurrentSite}>
              禁用 {activeHost}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={startAdd} aria-label="添加规则">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {activeHost ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-2xs text-slate-500">
          当前站点 <code className="font-medium text-slate-700">{activeHost}</code>
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
          activeHost={activeHost}
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
        rules={siteRules}
        themes={themes}
        describePattern={(rule) => PATTERN_TYPE_LABELS[rule.pattern.type]}
        matchesNow={activeHost ? (rule) => matchesHost(rule.pattern, activeHost) : undefined}
        emptyState={(
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
            <p className="text-xs font-medium text-slate-600">还没有站点规则</p>
            <p className="mx-auto mt-1.5 max-w-sm text-2xs leading-5 text-slate-500">
              按域名或路径为指定站点启用 / 禁用效果，或切换到不同主题。
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="default" className="h-8 px-3 text-xs" onClick={startAdd}>
                <Plus className="mr-1.5 size-3.5" />添加规则
              </Button>
              {activeHost && activeHost !== "example.com" ? (
                <Button variant="outline" className="h-8 px-3 text-xs" onClick={disableCurrentSite}>
                  禁用 {activeHost}
                </Button>
              ) : null}
            </div>
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
