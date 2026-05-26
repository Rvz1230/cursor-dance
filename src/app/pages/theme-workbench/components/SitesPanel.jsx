import { useMemo } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { cn } from "@/components/ui/utils.js";
import { DataPill, Panel, SectionTitle, SmallSelect } from "./WorkbenchControls.jsx";
import { SITE_MODE_ENABLED, SITE_MODE_DISABLED, SITE_MODE_FOLLOW } from "../lib/extensionConfig.js";

export function SitesPanel({
  filter,
  setFilter,
  siteMode,
  setSiteMode,
  siteThemeId,
  setSiteThemeId,
  themes,
  activeThemeName,
  activeHost,
  isSupportedPage,
  siteRulesByHost,
  clearAllSiteRules,
  clearFilteredSiteRules,
  removeSiteRule,
}) {
  const themeNameById = useMemo(
    () => Object.fromEntries((themes || []).map((theme) => [theme.id, theme.name])),
    [themes]
  );
  const themeOptions = useMemo(
    () => (themes || []).map((theme) => ({ value: theme.id, label: theme.name })),
    [themes]
  );

  const rules = useMemo(() => {
    const storedRules = Object.entries(siteRulesByHost || {}).map(([host, rule]) => ({
      host,
      mode: rule.mode === "enabled" ? SITE_MODE_ENABLED : rule.mode === "disabled" ? SITE_MODE_DISABLED : SITE_MODE_FOLLOW,
      theme:
        rule.mode === "enabled"
          ? (themeNameById[rule.themePackId] || activeThemeName)
          : rule.mode === "disabled"
            ? "—"
            : SITE_MODE_FOLLOW,
      reason: host === activeHost ? "当前浏览器标签页" : "已保存站点规则",
      isCurrentHost: host === activeHost,
    }));

    const hasCurrentHostRule = storedRules.some((rule) => rule.host === activeHost);

    if (!hasCurrentHostRule) {
      return [
        {
          host: activeHost,
          mode: siteMode,
          theme:
            siteMode === SITE_MODE_ENABLED
              ? (themeNameById[siteThemeId] || activeThemeName)
              : siteMode === SITE_MODE_DISABLED
                ? "—"
                : SITE_MODE_FOLLOW,
          reason: isSupportedPage ? "当前浏览器标签页" : "当前页不可设置，仍可查看规则",
          isCurrentHost: true,
        },
        ...storedRules,
      ];
    }

    return storedRules;
  }, [activeHost, activeThemeName, isSupportedPage, siteMode, siteRulesByHost, siteThemeId, themeNameById]);

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
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <SectionTitle>当前站点</SectionTitle>
            <div className="text-lg font-semibold text-slate-900">{activeHost}</div>
            <div className="mt-2 text-sm text-slate-600">
              {isSupportedPage
                ? "切换后直接写入站点规则。"
                : "当前页不能写入站点规则。"}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <DataPill tone={siteMode === SITE_MODE_DISABLED ? "amber" : "teal"}>{siteMode}</DataPill>
              <DataPill>
                {siteMode === SITE_MODE_DISABLED
                  ? "当前主题：未生效"
                  : `当前主题：${themeNameById[siteThemeId] || activeThemeName}`}
              </DataPill>
            </div>
            <div className="mt-5 space-y-2">
              {[SITE_MODE_FOLLOW, SITE_MODE_ENABLED, SITE_MODE_DISABLED].map((item) => (
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
            <div className="mt-5 border-t border-slate-200 pt-4">
              <SectionTitle>站点命中时使用的主题</SectionTitle>
              <div className="mt-3">
                <SmallSelect
                  value={siteThemeId}
                  options={themeOptions}
                  onChange={isSupportedPage ? setSiteThemeId : undefined}
                  label="为当前站点选择主题"
                  disabled={!isSupportedPage}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                选择主题后，会自动把当前站点切到"{SITE_MODE_ENABLED}"，并固定使用这个主题。
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-3">
              <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索域名，例如 demo 或 docs" className="rounded-2xl bg-white" />
              <Button variant="ghost" className="rounded-2xl px-4" onClick={() => setFilter("")}>清空搜索</Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">域名</th>
                    <th className="px-4 py-3 font-medium">模式</th>
                    <th className="px-4 py-3 font-medium">主题</th>
                    <th className="px-4 py-3 font-medium">来源</th>
                    <th className="px-4 py-3 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map((rule) => (
                    <tr key={rule.host} className={cn("border-t border-slate-100", rule.isCurrentHost && "bg-amber-50/50")}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {rule.host}
                        {rule.isCurrentHost ? (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-700">当前</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3"><DataPill tone={rule.mode === SITE_MODE_DISABLED ? "amber" : "teal"}>{rule.mode}</DataPill></td>
                      <td className="px-4 py-3 text-slate-600">{rule.theme}</td>
                      <td className="px-4 py-3 text-slate-500">{rule.reason}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removeSiteRule(rule.host)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          title={`删除 ${rule.host} 的站点规则`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
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
