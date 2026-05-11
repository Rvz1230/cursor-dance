import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { cn } from "@/components/ui/utils.js";
import { DataPill, Panel, SectionTitle } from "./WorkbenchControls.jsx";

export function SitesPanel({
  filter,
  setFilter,
  siteMode,
  setSiteMode,
  activeThemeName,
  activeHost,
  isSupportedPage,
  siteRulesByHost,
  clearAllSiteRules,
  clearFilteredSiteRules,
}) {
  const rules = useMemo(() => {
    const currentRule = {
      host: activeHost,
      mode: siteMode,
      theme: siteMode === "当前禁用" ? "—" : activeThemeName,
      reason: isSupportedPage ? "当前浏览器标签页" : "当前页不可设置，仍可查看规则",
    };
    const storedRules = Object.entries(siteRulesByHost || {}).map(([host, rule]) => ({
      host,
      mode: rule.mode === "enabled" ? "当前启用" : rule.mode === "disabled" ? "当前禁用" : "跟随全局",
      theme: "跟随当前主题",
      reason: host === activeHost ? "当前浏览器标签页" : "已保存站点规则",
    }));
    const dedupedStoredRules = storedRules.filter((rule) => rule.host !== activeHost);
    return [currentRule, ...dedupedStoredRules];
  }, [activeHost, activeThemeName, isSupportedPage, siteMode, siteRulesByHost]);

  const filteredRules = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return rules;
    return rules.filter((rule) => rule.host.toLowerCase().includes(keyword));
  }, [filter, rules]);

  return (
    <div className="space-y-4">
      <Panel
        title="站点应用策略"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-2xl px-4" onClick={() => clearFilteredSiteRules(filteredRules.map((rule) => rule.host))}>删除筛选规则</Button>
            <Button variant="ghost" className="rounded-2xl px-4" onClick={clearAllSiteRules}>清空全部规则</Button>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <SectionTitle>当前站点</SectionTitle>
            <div className="text-lg font-semibold text-slate-900">{activeHost}</div>
            <div className="mt-2 text-sm text-slate-600">
              {isSupportedPage
                ? "切换后直接写入站点规则。"
                : "当前页不能写入站点规则。"}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <DataPill tone={siteMode === "当前禁用" ? "amber" : "teal"}>{siteMode}</DataPill>
              <DataPill>{siteMode === "当前禁用" ? "当前主题：未生效" : `当前主题：${activeThemeName}`}</DataPill>
            </div>
            <div className="mt-5 space-y-2">
              {["跟随全局", "当前启用", "当前禁用"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSiteMode(item)}
                  disabled={!isSupportedPage}
                  className={cn("flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm", item === siteMode ? "border-emerald-200 bg-white text-emerald-800" : "border-slate-200 bg-white text-slate-600")}
                >
                  <span>{item}</span>
                  {item === siteMode ? <CheckCircle2 className="h-4 w-4" /> : null}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-3">
              <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索域名，例如 demo 或 docs" className="rounded-2xl bg-white" />
              <Button variant="ghost" className="rounded-2xl px-4" onClick={() => setFilter("")}>清空搜索</Button>
            </div>
            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">域名</th>
                    <th className="px-4 py-3 font-medium">模式</th>
                    <th className="px-4 py-3 font-medium">主题</th>
                    <th className="px-4 py-3 font-medium">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map((rule) => (
                    <tr key={rule.host} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">{rule.host}</td>
                      <td className="px-4 py-3"><DataPill tone={rule.mode === "当前禁用" ? "amber" : "teal"}>{rule.mode}</DataPill></td>
                      <td className="px-4 py-3 text-slate-600">{rule.theme}</td>
                      <td className="px-4 py-3 text-slate-500">{rule.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
