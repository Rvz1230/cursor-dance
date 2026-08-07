import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import type { RuleThemeOption } from "../context-rules/RulePrimitives";
import { ApplicationIcon, themeName } from "./AppRuleElements";
import type { ApplicationCandidate } from "./appRulesModel";

export type WizardAction = "disable" | "follow" | "theme";

export interface AppRuleWizardState {
  step: 1 | 2 | 3;
  application: ApplicationCandidate;
  action: WizardAction | null;
  themeId: string;
  editingRuleId?: string;
}

function sentence(state: AppRuleWizardState, themes: RuleThemeOption[]): string {
  const name = state.application.name.trim() || state.application.processName.trim();
  if (state.action === "disable") return `在「${name}」中，关闭 CursorDance。`;
  if (state.action === "theme") return `在「${name}」中，使用「${themeName(themes, state.themeId)}」场景。`;
  return `在「${name}」中，跟随全局设置。`;
}

export function AppRuleWizard({
  state,
  currentApplication,
  recentApplications,
  themes,
  onChange,
  onCancel,
  onComplete,
}: {
  state: AppRuleWizardState;
  currentApplication: ApplicationCandidate | null;
  recentApplications: ApplicationCandidate[];
  themes: RuleThemeOption[];
  onChange: (state: AppRuleWizardState) => void;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const current = state.application;
  const otherRecent = recentApplications
    .filter((application) => application.key !== current.key)
    .slice(0, 3);
  const canContinue = state.step === 1
    ? Boolean(state.application.processName.trim())
    : state.step === 2
      ? Boolean(state.action && (state.action !== "theme" || state.themeId))
      : true;

  return (
    <section className="mb-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-medium text-slate-900">{state.editingRuleId ? "编辑规则" : "新建规则"}</h2>
        <span className="text-xs text-slate-500">第 {state.step} / 3 步</span>
        <button type="button" onClick={onCancel} className="ml-auto shrink-0 rounded-lg px-1.5 py-0.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">取消</button>
      </div>

      <div className="mt-2.5">
        {state.step === 1 ? (
          <div role="radiogroup" aria-label="选择应用">
            <button
              type="button"
              role="radio"
              aria-checked={state.application.key === current.key}
              onClick={() => onChange({ ...state, application: current })}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors",
                state.application.key === current.key ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300",
              )}
            >
              <ApplicationIcon application={current} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-slate-900">{current.name}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {currentApplication?.key === current.key ? "刚才使用的应用" : "已选择的应用"}
                  {current.title ? ` · ${current.title}` : ""}
                </span>
              </span>
              {state.application.key === current.key ? <Check className="size-3.5 shrink-0 text-slate-900" /> : null}
            </button>

            {otherRecent.length ? (
              <>
                <div className="mt-2 text-xs font-medium text-slate-500">最近检测到</div>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {otherRecent.map((application) => (
                    <button
                      key={application.key}
                      type="button"
                      role="radio"
                      aria-checked={state.application.key === application.key}
                      onClick={() => onChange({ ...state, application })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors",
                        state.application.key === application.key ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300",
                      )}
                    >
                      <ApplicationIcon application={application} small />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{application.name}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <details className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-600">找不到应用？</summary>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">可以手动填写进程名。这条路径是<strong className="font-medium text-slate-700">兜底</strong>，不在默认流程上——绝大多数人只需要点上面那个。</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input
                  value={state.application.name}
                  placeholder="应用名称"
                  aria-label="应用名称"
                  onChange={(event) => onChange({
                    ...state,
                    application: { ...state.application, key: "manual", name: event.target.value },
                  })}
                />
                <Input
                  value={state.application.processName}
                  placeholder="进程名"
                  aria-label="进程名"
                  onChange={(event) => onChange({
                    ...state,
                    application: { ...state.application, key: "manual", processName: event.target.value },
                  })}
                />
              </div>
            </details>
          </div>
        ) : null}

        {state.step === 2 ? (
          <>
            <div role="radiogroup" aria-label="行为" className="space-y-1.5">
              {([
                ["disable", "关闭效果", "在这个应用里完全不出现效果"],
                ["follow", "跟随全局设置", "和其它应用一样，用当前场景"],
                ["theme", "使用指定场景", "只在这个应用里换一套"],
              ] as const).map(([action, label, hint]) => (
                <button
                  key={action}
                  type="button"
                  role="radio"
                  aria-checked={state.action === action}
                  onClick={() => onChange({
                    ...state,
                    action,
                    themeId: action === "theme" ? (state.themeId || themes[0]?.id || "") : state.themeId,
                  })}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
                    state.action === action ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <span className="w-3 shrink-0 text-center text-xs text-slate-900">{state.action === action ? "✓" : ""}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-slate-900">{label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
            {state.action === "theme" ? (
              <div role="radiogroup" aria-label="选择主题" className="mt-2 grid grid-cols-4 gap-1.5">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    role="radio"
                    aria-checked={state.themeId === theme.id}
                    onClick={() => onChange({ ...state, themeId: theme.id })}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                      state.themeId === theme.id ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-300",
                    )}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {state.step === 3 ? (
          <>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs leading-relaxed text-slate-800">{sentence(state, themes)}</p>
            </div>
            <details className="mt-2 rounded-lg border border-slate-200 px-2.5 py-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-600">高级条件</summary>
              <div className="mt-1.5 space-y-1 text-2xs leading-relaxed text-slate-500">
                <div>匹配目标：<span className="font-medium text-slate-700">{state.application.bundleId ? "Bundle ID" : "进程名"}</span></div>
                <div>匹配方式：<span className="font-medium text-slate-700">精确</span></div>
                <div>匹配值：<code className="rounded bg-slate-100 px-1">{state.application.bundleId || state.application.processName}</code></div>
              </div>
            </details>
          </>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
        <Button
          variant="outline"
          className="h-7 px-2.5 text-xs"
          disabled={state.step === 1}
          onClick={() => onChange({ ...state, step: (state.step - 1) as 1 | 2 })}
        >
          上一步
        </Button>
        <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
          {state.step === 1 ? "手动填写进程名在「找不到应用？」里" : state.step === 2 ? (state.action ? "" : "选一个行为") : "「完成」只写进草稿，应用到桌面是另一个动作"}
        </span>
        <Button
          className="h-7 px-3 text-xs"
          disabled={!canContinue}
          onClick={() => {
            if (state.step === 3) onComplete();
            else onChange({ ...state, step: (state.step + 1) as 2 | 3 });
          }}
        >
          {state.step === 3 ? "完成" : "继续"}
        </Button>
      </div>
    </section>
  );
}
