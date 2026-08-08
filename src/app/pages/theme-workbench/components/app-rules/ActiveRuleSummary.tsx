import { AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/components/ui/utils";
import type { ActiveWindowSnapshot } from "@/shared/app-rules";
import type { RuleThemeOption } from "../context-rules/RulePrimitives";
import { ApplicationIcon, themeName } from "./AppRuleElements";
import type { AppRuleDecision, ApplicationCandidate } from "./appRulesModel";

export function ActiveRuleSummary({
  application,
  activeApp,
  decision,
  decisionSource,
  themes,
  activeThemeId,
  openDiagnostics,
  refreshActiveApp,
}: {
  application: ApplicationCandidate | null;
  activeApp: ActiveWindowSnapshot | null;
  decision: AppRuleDecision | null;
  decisionSource: string;
  themes: RuleThemeOption[];
  activeThemeId: string;
  openDiagnostics?: () => void;
  refreshActiveApp?: () => void;
}) {
  const activeThemeName = themeName(themes, activeThemeId);

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5">
      <div className="mx-auto flex max-w-[920px] flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {application && decision ? (
            <>
              <ApplicationIcon application={application} small />
              <span className="shrink-0 text-xs text-slate-500">刚才使用</span>
              <span className="shrink-0 text-xs font-medium text-slate-900">{application.name}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-500" title={application.title}>{application.title}</span>
              <ArrowRight className="size-3 shrink-0 text-slate-300" />
              <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold", decision.enabled ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>
                {decision.enabled ? `效果已启用 · 主题${decision.action && decision.action !== "disable" && decision.action.theme ? themeName(themes, decision.action.theme) : activeThemeName}` : "效果已关闭"}
                <span className="font-normal">{decisionSource}</span>
              </span>
            </>
          ) : (
            <>
              <span className="grid size-5 place-items-center rounded-full bg-slate-100 text-slate-500"><AlertCircle className="size-3" /></span>
              <span className="text-xs text-slate-500">读不到刚才使用的应用，规则暂不生效</span>
            </>
          )}
        </div>
        <button type="button" onClick={openDiagnostics} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-900">为什么？<ArrowRight className="size-3" /></button>
        {refreshActiveApp && !activeApp?.authorized ? <button type="button" onClick={refreshActiveApp} className="sr-only">重新检测前台应用</button> : null}
      </div>
    </div>
  );
}
