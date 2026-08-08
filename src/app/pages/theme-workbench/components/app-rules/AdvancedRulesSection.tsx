import { useEffect, useRef, useState } from "react";
import { ChevronDown, GripVertical, Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import type { ActiveWindowSnapshot, AppRule, AppRuleTarget } from "@/shared/app-rules";
import { activeAppInfoFromSnapshot } from "@/shared/app-rules";
import type { NewAppRule } from "../../hooks/workbenchStateTypes";
import {
  cloneEditableRule,
  RuleActionFields,
  RuleField,
  type RuleThemeOption,
} from "../context-rules/RulePrimitives";
import { MatchBadge, RuleMenu, themeName } from "./AppRuleElements";
import {
  applicationCandidateForRule,
  isApplicationRule,
  isRuleRedundantWithGlobal,
  resolveRuleMatchStates,
  type AppRuleDecision,
  type ApplicationCandidate,
} from "./appRulesModel";

function emptyAdvancedRule(): AppRule {
  return {
    id: "",
    kind: "advanced",
    pattern: { type: "glob", value: "", target: "title" },
    action: "disable",
    enabled: true,
  };
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

export function AdvancedRulesSection({
  appRules,
  themes,
  activeApp,
  globalEnabled,
  applications,
  decision,
  applicationWizardOpen,
  closeApplicationWizard,
  addRule,
  updateRule,
  reorderRules,
  toggleRule,
  removeRule,
  onRuleSaved,
}: {
  appRules: AppRule[];
  themes: RuleThemeOption[];
  activeApp: ActiveWindowSnapshot | null;
  globalEnabled: boolean;
  applications: ApplicationCandidate[];
  decision: AppRuleDecision | null;
  applicationWizardOpen: boolean;
  closeApplicationWizard: () => void;
  addRule: (rule: NewAppRule) => void;
  updateRule: (id: string, updates: Partial<AppRule>) => void;
  reorderRules: (from: number, to: number) => void;
  toggleRule: (id: string) => void;
  removeRule: (rule: AppRule, label: string) => void;
  onRuleSaved: (editing: boolean) => void;
}) {
  const advancedRules = appRules.filter((rule) => !isApplicationRule(rule));
  const [open, setOpen] = useState(() => advancedRules.length > 0);
  const [draft, setDraft] = useState<AppRule | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editorError, setEditorError] = useState("");
  const dragRuleId = useRef<string | null>(null);
  const activeInfo = activeAppInfoFromSnapshot(activeApp);
  const matchStates = resolveRuleMatchStates(appRules, activeInfo, globalEnabled);
  const decisionRule = decision?.ruleId ? appRules.find((rule) => rule.id === decision.ruleId) : null;
  const candidateForRule = (rule: AppRule) => applicationCandidateForRule(rule, applications);

  useEffect(() => {
    if (applicationWizardOpen) setDraft(null);
  }, [applicationWizardOpen]);

  const startAdd = () => {
    setOpen(true);
    setDraft(emptyAdvancedRule());
    setEditingRuleId(null);
    closeApplicationWizard();
    setEditorError("");
  };

  const startEdit = (rule: AppRule) => {
    setOpen(true);
    setDraft(cloneEditableRule(rule));
    setEditingRuleId(rule.id);
    closeApplicationWizard();
    setEditorError("");
  };

  const complete = () => {
    if (!draft) return;
    const value = draft.pattern.value.trim();
    if (!value) {
      setEditorError("请填写匹配值。");
      return;
    }
    const payload = {
      kind: "advanced" as const,
      pattern: { ...draft.pattern, value },
      action: draft.action,
    };
    if (editingRuleId) updateRule(editingRuleId, payload);
    else addRule(payload);
    setDraft(null);
    setEditingRuleId(null);
    setEditorError("");
    onRuleSaved(Boolean(editingRuleId));
  };

  const moveRule = (ruleId: string, direction: -1 | 1) => {
    const index = advancedRules.findIndex((rule) => rule.id === ruleId);
    const target = advancedRules[index + direction];
    if (!target) return;
    reorderRules(appRules.findIndex((rule) => rule.id === ruleId), appRules.findIndex((rule) => rule.id === target.id));
  };

  const reorderRuleTo = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = appRules.findIndex((rule) => rule.id === fromId);
    const to = appRules.findIndex((rule) => rule.id === toId);
    if (from >= 0 && to >= 0) reorderRules(from, to);
  };

  return (
    <section className="mb-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50" aria-expanded={open}>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-medium text-slate-900">高级匹配规则<span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-600">{advancedRules.length}</span></h2>
          <div className="mt-0.5 text-xs text-slate-500">按进程名或窗口标题做模式匹配，<span className="font-medium text-slate-600">这里的规则有顺序</span></div>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="mb-2.5 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
            <p className="text-xs leading-relaxed text-slate-500">裁决顺序：<span className="font-semibold text-slate-700">例外应用</span> → <span className="font-semibold text-slate-700">高级规则（自上而下第一条命中）</span> → <span className="font-semibold text-slate-700">默认行为</span>。只有同一个应用需要按窗口标题分情况处理时才需要用到这里。</p>
          </div>
          {draft && !applicationWizardOpen ? (
            <AdvancedRuleEditor draft={draft} themes={themes} activeApp={activeApp} error={editorError} onChange={setDraft} onComplete={complete} onCancel={() => { setDraft(null); setEditorError(""); }} />
          ) : null}
          <div className="space-y-1.5">
            {!advancedRules.length ? <p className="px-1 py-2 text-xs text-slate-500">还没有任何匹配规则。绝大多数需求用上面的列表就够了。</p> : advancedRules.map((rule) => {
              const matchState = rule.enabled === false ? "idle" : (matchStates.get(rule.id) || "idle");
              const voidRule = isRuleRedundantWithGlobal(rule, globalEnabled);
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
                  onDrop={() => { if (dragRuleId.current) reorderRuleTo(dragRuleId.current, rule.id); dragRuleId.current = null; }}
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
                      moveRule(rule.id, event.key === "ArrowUp" ? -1 : 1);
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
                    <button type="button" className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700" onClick={() => startEdit(rule)}>编辑</button>
                    <RuleMenu rule={rule} label={`规则${rule.pattern.value}`} onToggle={() => toggleRule(rule.id)} onDelete={() => removeRule(rule, `规则「${rule.pattern.value}」`)} />
                  </div>
                </div>
              );
            })}
          </div>
          <Button variant="outline" className="mt-2.5 h-8 px-3 text-xs" onClick={startAdd}><Plus className="mr-1.5 size-3.5" />添加匹配规则</Button>
        </div>
      ) : null}
    </section>
  );
}
