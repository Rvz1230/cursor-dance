import { useState, type ReactNode } from "react";
import { Check, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import type { ActiveWindowSnapshot, AppRule } from "@/shared/app-rules";
import { activeAppInfoFromSnapshot, matchAppPattern } from "@/shared/app-rules";
import type { RuleThemeOption } from "../context-rules/RulePrimitives";
import { ApplicationIcon, RuleMenu } from "./AppRuleElements";
import {
  applicationCandidateForRule,
  isApplicationRule,
  isVoidApplicationRule,
  type ApplicationCandidate,
} from "./appRulesModel";

const GLOBAL_THEME_VALUE = "__global__";

export type ApplicationRulesPickerAnchor = "list" | "empty";

export function ApplicationRulesSection({
  appRules,
  themes,
  globalEnabled,
  activeApp,
  applications,
  recentApplications,
  renderPicker,
  openAccessibilitySettings,
  addDefaultDisabled,
  updateRule,
  toggleRule,
  removeRule,
}: {
  appRules: AppRule[];
  themes: RuleThemeOption[];
  globalEnabled: boolean;
  activeApp: ActiveWindowSnapshot | null;
  applications: ApplicationCandidate[];
  recentApplications: ApplicationCandidate[];
  renderPicker: (anchor: ApplicationRulesPickerAnchor, trigger: ReactNode) => ReactNode;
  openAccessibilitySettings?: () => void;
  addDefaultDisabled: (application: ApplicationCandidate) => void;
  updateRule: (id: string, updates: Partial<AppRule>) => void;
  toggleRule: (id: string) => void;
  removeRule: (rule: AppRule, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const activeInfo = activeAppInfoFromSnapshot(activeApp);
  const applicationRules = appRules.filter(isApplicationRule);
  const candidateForRule = (rule: AppRule) => applicationCandidateForRule(rule, applications);
  const isVoidRule = (rule: AppRule) => isVoidApplicationRule(rule, globalEnabled);
  const voidRules = applicationRules.filter(isVoidRule);
  const pausedCount = applicationRules.filter((rule) => rule.enabled === false).length;
  const liveCount = applicationRules.filter((rule) => rule.enabled !== false && !isVoidRule(rule)).length;
  const visibleApplicationRules = applicationRules.filter((rule) => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return true;
    const application = candidateForRule(rule);
    return `${application.name} ${application.bundleId || ""} ${rule.pattern.value}`
      .toLocaleLowerCase()
      .includes(needle);
  });

  return (
    <section className="mb-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-slate-900">
            {globalEnabled ? "例外应用" : "允许的应用"}{applicationRules.length ? " " : ""}
            {applicationRules.length ? (
              <span className="tabular-nums text-slate-500">
                {query ? `${visibleApplicationRules.length} / ${applicationRules.length}` : liveCount}
                {!query && (voidRules.length || pausedCount) ? <span className="font-normal">（另有 {voidRules.length ? `${voidRules.length} 条无效` : ""}{voidRules.length && pausedCount ? "、" : ""}{pausedCount ? `${pausedCount} 条已暂停` : ""}）</span> : null}
              </span>
            ) : null}
          </h2>
          <div className="mt-0.5 text-xs text-slate-500">{globalEnabled ? "一个应用一条记录，互不覆盖，没有优先级" : "只有这些应用会生效，一个应用一条记录"}</div>
        </div>
        {applicationRules.length ? (
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-slate-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选" aria-label="筛选已列出的应用" className="h-7 w-[110px] rounded-xl border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-700 shadow-sm placeholder:text-slate-500" />
            </div>
            {renderPicker("list", <Button variant="outline" className="h-7 px-2.5 text-xs"><Plus className="mr-1 size-3" />添加</Button>)}
          </div>
        ) : null}
      </div>

      {!applicationRules.length ? (
        activeApp && !activeApp.authorized ? (
          <div className="px-4 py-8 text-center">
            <div className="text-xs font-medium text-slate-600">还读不到最近用过的应用</div>
            <div className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">授权辅助功能后，这里会列出刚刚用过的应用供你一键添加；在此之前可以用「高级匹配规则」手写进程名。</div>
            <Button className="mt-2.5 h-7 px-2.5 text-xs" onClick={openAccessibilitySettings}>打开系统设置</Button>
          </div>
        ) : (
          <div className="px-4 py-3">
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-700">从最近用过的应用里选一个</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">不用输入任何东西。点一下就会加进列表，默认「关闭效果」。</p>
                </div>
                {renderPicker("empty", <Button variant="outline" className="h-7 shrink-0 px-2.5 text-xs">查看全部应用</Button>)}
              </div>
              {recentApplications.length ? (
                <div className="app-rules-recent-grid mt-3 grid gap-1.5">
                  {recentApplications.slice(0, 4).map((application, index) => (
                    <button key={application.key} type="button" className="first-pick" onClick={() => addDefaultDisabled(application)}>
                      <ApplicationIcon application={application} />
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-xs font-medium text-slate-800">{application.name}</span>
                        <span className="block truncate text-xs text-slate-500">{index === 0 ? "刚刚 · 刚才在用" : "最近检测到"}</span>
                      </span>
                      <span className="first-add">+ 关闭效果</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )
      ) : !visibleApplicationRules.length ? (
        <div className="px-4 py-8 text-center">
          <div className="text-xs font-medium text-slate-600">没有匹配「{query}」的应用</div>
          <div className="mt-1 text-xs text-slate-500">应用名与 bundle id 都会被搜到</div>
          <Button variant="outline" className="mt-2.5 h-7 px-2.5 text-xs" onClick={() => setQuery("")}>清空筛选</Button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visibleApplicationRules.map((rule, index) => {
            const application = candidateForRule(rule);
            const paused = rule.enabled === false;
            const voidRule = isVoidRule(rule);
            const enabled = rule.action !== "disable";
            const active = Boolean(activeInfo && matchAppPattern(activeInfo, rule.pattern));
            const selectedTheme = rule.action !== "disable" && rule.action.theme
              ? rule.action.theme
              : rule.preferredTheme || GLOBAL_THEME_VALUE;
            const status = paused ? "已暂停" : voidRule ? (globalEnabled ? "与默认相同" : "白名单下无效") : null;
            return (
              <div key={rule.id} className={cn("flex items-center gap-3 px-4 py-2.5", index % 2 === 1 && "bg-slate-50")}>
                <ApplicationIcon application={application} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-900">{application.name}</span>
                    {active ? <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white px-1.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"><span className="size-1.5 rounded-full bg-sky-500" />刚才在用</span> : null}
                  </div>
                  <div className="truncate text-xs text-slate-500">{application.bundleId || rule.pattern.value}</div>
                </div>
                <div className="row-controls">
                  {globalEnabled ? (
                    <div className="seg-group" role="radiogroup" aria-label={`${application.name}的行为`}>
                      <button
                        type="button"
                        className={cn("seg-item", enabled && "seg-item-on")}
                        role="radio"
                        aria-checked={enabled}
                        onClick={() => updateRule(rule.id, {
                          action: {
                            enable: true,
                            ...(rule.preferredTheme ? { theme: rule.preferredTheme } : {}),
                          },
                        })}
                      >启用</button>
                      <button
                        type="button"
                        className={cn("seg-item", !enabled && "seg-item-on")}
                        role="radio"
                        aria-checked={!enabled}
                        onClick={() => updateRule(rule.id, {
                          action: "disable",
                          preferredTheme: rule.action !== "disable" ? rule.action.theme : rule.preferredTheme,
                        })}
                      >关闭</button>
                    </div>
                  ) : status ? <span className="row-void">{status}</span> : <span className="row-allowed"><Check className="size-2.5" />已允许</span>}
                  {status && globalEnabled ? <span className="row-void">{status}</span> : null}
                  {!globalEnabled && voidRule && !paused ? (
                    <button
                      type="button"
                      className="row-fix"
                      onClick={() => updateRule(rule.id, {
                        action: { enable: true, ...(rule.preferredTheme ? { theme: rule.preferredTheme } : {}) },
                      })}
                    >改为允许</button>
                  ) : null}
                  <div className={cn("theme-pick", !enabled && "invisible")}>
                    <Select
                      value={selectedTheme}
                      options={[{ value: GLOBAL_THEME_VALUE, label: "跟随全局" }, ...themes.map((theme) => ({ value: theme.id, label: theme.name }))]}
                      onChange={(value) => updateRule(rule.id, {
                        preferredTheme: value === GLOBAL_THEME_VALUE ? undefined : value,
                        action: { enable: true, ...(value !== GLOBAL_THEME_VALUE ? { theme: value } : {}) },
                      })}
                      label={`${application.name}的主题`}
                      className="h-7 px-2 text-xs"
                    />
                  </div>
                </div>
                <RuleMenu rule={rule} label={application.name} onToggle={() => toggleRule(rule.id)} onDelete={() => removeRule(rule, `「${application.name}」`)} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
