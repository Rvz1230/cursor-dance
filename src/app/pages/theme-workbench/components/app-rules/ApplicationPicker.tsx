import { Crosshair, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AppRule } from "@/shared/app-rules";
import { ApplicationIcon } from "./AppRuleElements";
import { applicationRuleMatchesCandidate, type ApplicationCandidate } from "./appRulesModel";

type PickerTab = "recent" | "installed" | "pick";

export function ApplicationPicker({
  open,
  onOpenChange,
  trigger,
  recentApplications,
  installedApplications,
  installedLoading,
  appRules,
  authorized,
  onAdd,
  onStartPicking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  recentApplications: ApplicationCandidate[];
  installedApplications: ApplicationCandidate[];
  installedLoading: boolean;
  appRules: AppRule[];
  authorized: boolean;
  onAdd: (application: ApplicationCandidate) => void;
  onStartPicking: () => void;
}) {
  const [tab, setTab] = useState<PickerTab>("recent");
  const [query, setQuery] = useState("");
  const source = tab === "installed" ? installedApplications : recentApplications;
  const visibleApplications = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return source;
    return source.filter((application) => (
      `${application.name} ${application.processName} ${application.bundleId || ""}`
        .toLocaleLowerCase()
        .includes(needle)
    ));
  }, [query, source]);
  const isAdded = (application: ApplicationCandidate) => appRules.some((rule) => (
    applicationRuleMatchesCandidate(rule, application)
  ));

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="flex max-h-[min(500px,calc(100dvh-7rem))] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl p-0">
        <div className="shrink-0 border-b border-slate-100 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索应用名称或 bundle id"
              aria-label="搜索应用名称或 bundle id"
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-2 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-slate-400"
            />
          </div>
          <div className="mt-2.5 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="应用来源">
            {([[
              "recent", "最近使用",
            ], [
              "installed", "已安装",
            ], [
              "pick", "点选",
            ]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`seg-item ${tab === value ? "seg-item-on" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "pick" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel" aria-label="点选模式">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200"><Crosshair className="size-4" /></span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-700">点选屏幕上的任意窗口</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">开始后工作台会退到后台。点击目标应用的窗口，它就会被自动填入——适合不在应用目录里的程序、辅助进程和游戏。</p>
                </div>
              </div>
              <button type="button" onClick={onStartPicking} className="mt-3 h-8 w-full rounded-xl border border-slate-950 bg-slate-950 px-3 text-xs font-medium text-white shadow-sm hover:bg-slate-800">开始点选</button>
            </div>
            <p className="mt-1.5 text-2xs leading-relaxed text-slate-500">按 Esc 可取消点选。</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5" role="tabpanel" aria-label="应用列表">
            <p className="px-2 pb-1 pt-1.5 text-xs text-slate-500">
              {query
                ? `匹配“${query}”的 ${visibleApplications.length} 个应用`
                : tab === "recent"
                  ? "前台监听自动记录，已排除 CursorDance 自身"
                  : "扫描 /Applications、/System/Applications 与 ~/Applications"}
            </p>
            {tab === "recent" && !authorized ? (
              <p className="px-2 py-6 text-center text-xs leading-relaxed text-slate-500">需要辅助功能权限才能记录最近用过的应用。</p>
            ) : installedLoading && tab === "installed" ? (
              <p className="px-2 py-6 text-center text-xs text-slate-500">正在读取已安装应用…</p>
            ) : visibleApplications.length ? visibleApplications.map((application) => {
              const added = isAdded(application);
              return (
                <button key={application.key} type="button" className="pick-row" disabled={added} onClick={() => onAdd(application)}>
                  <ApplicationIcon application={application} />
                  <span className="pick-body">
                    <span className="pick-name">{application.name}</span>
                    <span className="pick-meta">{application.bundleId || application.processName}{tab === "recent" ? " · 最近检测到" : ""}</span>
                  </span>
                  <span className={added ? "pick-added" : "pick-cta"}>{added ? "已添加" : "添加"}</span>
                </button>
              );
            }) : (
              <p className="px-2 py-6 text-center text-xs text-slate-500">{query ? `没有匹配“${query}”的应用` : "这里还没有应用"}</p>
            )}
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-2xs text-slate-500">按 bundle id 记录，改名或换语言都不会失配</span>
          <button type="button" onClick={() => onOpenChange(false)} className="text-xs font-medium text-slate-500 hover:text-slate-900">关闭</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
