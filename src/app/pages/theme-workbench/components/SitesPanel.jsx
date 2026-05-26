import { useMemo, useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { cn } from "@/components/ui/utils.js";
import { DataPill, Panel, SectionTitle, SmallSelect } from "./WorkbenchControls.jsx";
import { SITE_MODE_ENABLED, SITE_MODE_DISABLED, SITE_MODE_FOLLOW } from "../lib/extensionConfig.js";

const SITE_MODE_OPTIONS = [
  { value: "enabled", label: SITE_MODE_ENABLED },
  { value: "disabled", label: SITE_MODE_DISABLED },
];

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
  addSiteRule,
  updateSiteRule,
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

  // ── manual add form state ──
  const [newHost, setNewHost] = useState("");
  const [newMode, setNewMode] = useState("enabled");
  const [newThemeId, setNewThemeId] = useState(themes[0]?.id || "");

  // ── inline edit state ──
  const [editingHost, setEditingHost] = useState(null);
  const [editMode, setEditMode] = useState("enabled");
  const [editThemeId, setEditThemeId] = useState("");

  const rules = useMemo(() => {
    const storedRules = Object.entries(siteRulesByHost || {}).map(([host, rule]) => ({
      host,
      rawMode: rule.mode,
      mode: rule.mode === "enabled" ? SITE_MODE_ENABLED : rule.mode === "disabled" ? SITE_MODE_DISABLED : SITE_MODE_FOLLOW,
      theme:
        rule.mode === "enabled"
          ? (themeNameById[rule.themePackId] || activeThemeName)
          : rule.mode === "disabled"
            ? "—"
            : SITE_MODE_FOLLOW,
      themePackId: rule.themePackId || "",
      reason: host === activeHost ? "当前浏览器标签页" : "已保存站点规则",
      isCurrentHost: host === activeHost,
    }));

    const hasCurrentHostRule = storedRules.some((rule) => rule.host === activeHost);

    if (!hasCurrentHostRule && activeHost) {
      return [
        {
          host: activeHost,
          rawMode: siteMode === SITE_MODE_ENABLED ? "enabled" : siteMode === SITE_MODE_DISABLED ? "disabled" : "inherit",
          mode: siteMode,
          theme:
            siteMode === SITE_MODE_ENABLED
              ? (themeNameById[siteThemeId] || activeThemeName)
              : siteMode === SITE_MODE_DISABLED
                ? "—"
                : SITE_MODE_FOLLOW,
          themePackId: siteThemeId || "",
          reason: isSupportedPage ? "当前浏览器标签页" : "当前页不可设置，仍可查看规则",
          isCurrentHost: true,
          isVirtual: true,
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

  function handleAddSiteRule() {
    const trimmed = newHost.trim().toLowerCase();
    if (!trimmed) return;
    if (siteRulesByHost[trimmed]) {
      return; // already exists — user should edit instead
    }
    addSiteRule(trimmed, newMode, newMode === "enabled" ? (newThemeId || themes[0]?.id || "") : undefined);
    setNewHost("");
    setNewMode("enabled");
    setNewThemeId(themes[0]?.id || "");
  }

  function handleStartEdit(rule) {
    setEditingHost(rule.host);
    setEditMode(rule.rawMode);
    setEditThemeId(rule.themePackId || themes[0]?.id || "");
  }

  function handleCancelEdit() {
    setEditingHost(null);
  }

  function handleSaveEdit() {
    if (!editingHost) return;
    updateSiteRule(editingHost, editMode, editMode === "enabled" ? (editThemeId || themes[0]?.id || "") : undefined);
    setEditingHost(null);
  }

  function handleClearAll() {
    if (window.confirm(`确定要清空全部 ${Object.keys(siteRulesByHost || {}).length} 条站点规则吗？此操作不可撤销。`)) {
      clearAllSiteRules();
    }
  }

  function handleClearFiltered() {
    const hosts = filteredRules.filter((r) => !r.isVirtual).map((r) => r.host);
    if (hosts.length === 0) return;
    if (window.confirm(`确定要删除筛选出的 ${hosts.length} 条站点规则吗？此操作不可撤销。`)) {
      clearFilteredSiteRules(hosts);
    }
  }

  function handleRemoveRule(host) {
    if (window.confirm(`确定要删除 ${host} 的站点规则吗？`)) {
      removeSiteRule(host);
    }
  }

  const addDisabled = !newHost.trim() || Boolean(siteRulesByHost[newHost.trim().toLowerCase()]);
  const addHostExists = Boolean(siteRulesByHost[newHost.trim().toLowerCase()]) && newHost.trim();
  const savedRuleCount = Object.keys(siteRulesByHost || {}).length;

  return (
    <div className="space-y-4">
      <Panel
        title="站点应用策略"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-2xl px-4"
              onClick={handleClearFiltered}
              disabled={filteredRules.filter((r) => !r.isVirtual).length === 0}
            >
              删除筛选规则
            </Button>
            <Button
              variant="ghost"
              className="rounded-2xl px-4"
              onClick={handleClearAll}
              disabled={savedRuleCount === 0}
            >
              清空全部规则
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          {/* ── Left: current site ── */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <SectionTitle>当前站点</SectionTitle>
              <div className="text-lg font-semibold text-slate-900">{activeHost || "未检测到站点"}</div>
              <div className="mt-2 text-sm text-slate-600">
                {isSupportedPage
                  ? "切换后直接写入站点规则。"
                  : "当前标签页不是普通网页，无法自动写入规则。请使用右侧「手动添加规则」。"}
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
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors",
                      !isSupportedPage && "cursor-not-allowed opacity-50",
                      item === siteMode
                        ? "border-emerald-200 bg-white text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    )}
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
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  选择主题后，会自动把当前站点切到"{SITE_MODE_ENABLED}"，并固定使用这个主题。
                </div>
              </div>
            </div>

            {/* ── Manual add ── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionTitle>手动添加规则</SectionTitle>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">域名（例如 youtube.com）</label>
                  <Input
                    value={newHost}
                    onChange={(event) => setNewHost(event.target.value)}
                    placeholder="输入域名，例如 github.com"
                    className="rounded-xl bg-white"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !addDisabled) handleAddSiteRule();
                    }}
                  />
                  {addHostExists ? (
                    <p className="mt-1 text-xs text-amber-600">该域名已有规则，请在表格中编辑。</p>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">策略模式</label>
                  <SmallSelect
                    value={newMode}
                    options={SITE_MODE_OPTIONS}
                    onChange={setNewMode}
                    label="选择策略模式"
                  />
                </div>
                {newMode === "enabled" ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">绑定主题</label>
                    <SmallSelect
                      value={newThemeId}
                      options={themeOptions}
                      onChange={setNewThemeId}
                      label="选择绑定主题"
                    />
                  </div>
                ) : null}
                <Button
                  className="w-full rounded-xl"
                  onClick={handleAddSiteRule}
                  disabled={addDisabled}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  添加规则
                </Button>
              </div>
            </div>
          </div>

          {/* ── Right: table ── */}
          <div>
            <div className="mb-3 flex items-center gap-3">
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="搜索域名，例如 demo 或 docs"
                className="rounded-2xl bg-white"
              />
              <Button variant="ghost" className="rounded-2xl px-4" onClick={() => setFilter("")}>
                清空搜索
              </Button>
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
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                        {filter.trim() ? "没有匹配的站点规则" : "暂无站点规则，使用上方表单添加"}
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((rule) => {
                      const isEditing = editingHost === rule.host;
                      return (
                        <tr
                          key={rule.host}
                          className={cn(
                            "border-t border-slate-100",
                            rule.isCurrentHost && "bg-amber-50/50"
                          )}
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {rule.host}
                            {rule.isCurrentHost ? (
                              <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-700">
                                当前
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <SmallSelect
                                value={editMode}
                                options={SITE_MODE_OPTIONS}
                                onChange={setEditMode}
                                label="编辑模式"
                              />
                            ) : (
                              <DataPill tone={rule.mode === SITE_MODE_DISABLED ? "amber" : "teal"}>
                                {rule.mode}
                              </DataPill>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing && editMode === "enabled" ? (
                              <SmallSelect
                                value={editThemeId}
                                options={themeOptions}
                                onChange={setEditThemeId}
                                label="编辑主题"
                              />
                            ) : (
                              <span className="text-slate-600">{rule.theme}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{rule.reason}</td>
                          <td className="px-4 py-3">
                            {rule.isVirtual ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : isEditing ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={handleSaveEdit}
                                  className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50"
                                  title="保存"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                                  title="取消"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(rule)}
                                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                  title={`编辑 ${rule.host} 的站点规则`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRule(rule.host)}
                                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                  title={`删除 ${rule.host} 的站点规则`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
