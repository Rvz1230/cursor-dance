import { useEffect, useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { ThemeCard } from "@/components/ui/theme-card";
import { readEditorState, writeEditorState } from "../lib/workbenchConfig";
import { ThemeComposerModal } from "./theme-library/ThemeComposerModal";
import { ThemeLibraryDialogs } from "./theme-library/ThemeLibraryDialogs";

export function ThemeLibrarySidebar({
  themes,
  themeId,
  setThemeId,
  createTheme,
  duplicateTheme,
  deleteTheme,
  exportTheme,
  importThemeFromText,
  renameTheme,
  updateThemeIcon,
  notify,
  dirtyThemes,
  saveChanges,
  discardThemeChanges,
}) {
  const [query, setQuery] = useState("");
  const [composerMode, setComposerMode] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingDeleteTheme, setPendingDeleteTheme] = useState(null);
  const [pendingSwitchThemeId, setPendingSwitchThemeId] = useState(null);
  const [isSwitching, setIsSwitching] = useState(false);
  // 默认收起：在 960px 基准窗口里把宽度优先留给高频的配置与预览；用户选择仍会持久化。
  const [collapsed, setCollapsed] = useState(true);

  // 折叠态要持久化——每次打开都被强制展开跟每次都被强制折叠一样烦人。
  useEffect(() => {
    let cancelled = false;
    void readEditorState().then((editorState) => {
      if (cancelled || typeof editorState?.libraryCollapsed !== "boolean") return;
      setCollapsed(editorState.libraryCollapsed);
    });
    return () => { cancelled = true; };
  }, []);

  function toggleCollapsed() {
    setCollapsed((previous) => {
      const next = !previous;
      void writeEditorState({ libraryCollapsed: next });
      return next;
    });
  }

  const filteredThemes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return themes;
    return themes.filter((theme) =>
      [theme.name, theme.summary, theme.kind]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }, [query, themes]);

  function runThemeAction(action) {
    try {
      const result = action();
      setActionError("");
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "主题操作失败，请重试。";
      setActionError(message);
      notify?.({ tone: "error", title: "主题操作失败", description: message });
      return null;
    }
  }

  async function handleExportTheme(targetThemeId) {
    try {
      const result = await exportTheme(targetThemeId);
      setActionError("");
      if (!result) return; // 用户在原生对话框中取消，不算成功也不算错误
      notify?.({ tone: "success", title: "已导出主题", description: result.fileName });
    } catch (error) {
      const message = error instanceof Error ? error.message : "主题操作失败，请重试。";
      setActionError(message);
      notify?.({ tone: "error", title: "主题操作失败", description: message });
    }
  }

  function handleDuplicateTheme(targetThemeId) {
    const duplicatedName = runThemeAction(() => duplicateTheme(targetThemeId));
    if (!duplicatedName) return;
    notify?.({ tone: "success", title: "已复制主题", description: duplicatedName });
  }

  function handleDeleteTheme() {
    if (!pendingDeleteTheme) return;
    const deletedName = runThemeAction(() => deleteTheme(pendingDeleteTheme.id));
    if (!deletedName) return;
    setPendingDeleteTheme(null);
    notify?.({ tone: "success", title: "已移除主题", description: `${deletedName} 将在保存后从配置中删除。` });
  }

  function handleThemeClick(targetThemeId) {
    if (targetThemeId !== themeId && dirtyThemes?.[themeId]) {
      setPendingSwitchThemeId(targetThemeId);
      return;
    }
    setThemeId(targetThemeId);
  }

  async function handleSaveAndSwitch() {
    if (!pendingSwitchThemeId) return;
    setIsSwitching(true);
    try {
      const result = await saveChanges();
      if (result.ok) {
        setThemeId(pendingSwitchThemeId);
        notify?.({ tone: "success", title: "已保存并切换主题" });
      } else {
        notify?.({ tone: "error", title: "保存失败", description: result.error || "请稍后重试" });
      }
    } catch {
      notify?.({ tone: "error", title: "保存失败", description: "请稍后重试" });
    } finally {
      setIsSwitching(false);
      setPendingSwitchThemeId(null);
    }
  }

  function handleDiscardAndSwitch() {
    if (!pendingSwitchThemeId) return;
    discardThemeChanges?.(themeId);
    setThemeId(pendingSwitchThemeId);
    setPendingSwitchThemeId(null);
  }

  function handleCancelSwitch() {
    setPendingSwitchThemeId(null);
  }

  const currentThemeName = themes.find((t) => t.id === themeId)?.name || "当前主题";

  return (
    <aside className={cn("flex shrink-0 flex-col border-r border-slate-200 bg-slate-100 transition-[width] duration-200 ease-out motion-reduce:transition-none", collapsed ? "w-[60px]" : "w-[248px]")}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={cn("py-2.5", collapsed ? "px-2 flex justify-center" : "px-3")}>
          {collapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl"
              aria-label="展开主题库"
              title="展开主题库"
              onClick={toggleCollapsed}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 rounded-xl"
                aria-label="收起主题库"
                title="收起主题库"
                onClick={toggleCollapsed}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索主题"
                  className="h-9 w-full bg-white pl-8"
                />
              </div>
            </div>
          )}
        </div>

        {actionError ? (
          <div className="px-3 pb-2.5">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{actionError}</div>
          </div>
        ) : null}

        <div className={cn("min-h-0 flex-1 overflow-y-auto pb-3 pt-2", collapsed ? "px-2 space-y-3" : "px-3 space-y-2")}>
          {filteredThemes.length ? (
            filteredThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                selected={theme.id === themeId}
                canDelete={theme.kind !== "内置" && themes.length > 1}
                isDirty={dirtyThemes?.[theme.id] || false}
                onClick={() => handleThemeClick(theme.id)}
                onDuplicate={() => handleDuplicateTheme(theme.id)}
                onExport={() => handleExportTheme(theme.id)}
                onDelete={() => setPendingDeleteTheme(theme)}
                onRename={renameTheme}
                onUpdateIcon={updateThemeIcon}
                collapsed={collapsed}
              />
            ))
          ) : themes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">
              <div className="text-xs font-medium text-slate-600">还没有主题</div>
              <div className="mt-1.5 max-w-[220px] text-xs leading-5 text-pretty text-slate-500">
                创建你的第一个主题，从空白开始或导入 JSON。
              </div>
              <Button
                variant="default"
                className="mt-4 h-8 rounded-xl px-3 text-xs"
                onClick={() => setComposerMode("create")}
              >
                <Plus className="mr-2 h-4 w-4" />
                创建新主题
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-600">
              <div className="text-xs font-medium text-slate-600">没有找到匹配的主题</div>
              <div className="mt-1.5 max-w-[220px] text-xs leading-5 text-pretty text-slate-500">换个关键词，或者新建一个主题继续编辑。</div>
              <Button variant="outline" className="mt-4 h-8 rounded-xl px-3 text-xs" onClick={() => setComposerMode("create")}>
                <Plus className="mr-2 h-4 w-4" />
                新建一个主题
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className={cn("shrink-0 border-t border-slate-200", collapsed ? "px-2 py-2.5 flex justify-center" : "px-3 py-2.5")}>
        {collapsed ? (
          <Button
            variant={composerMode === "create" ? "default" : "outline"}
            size="icon"
            className="size-9 rounded-xl"
            aria-label="新建主题"
            onClick={() => setComposerMode((current) => (current === "create" ? "" : "create"))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant={composerMode === "create" ? "default" : "outline"}
            className="h-9 w-full rounded-xl text-xs"
            aria-label="新建主题"
            onClick={() => setComposerMode((current) => (current === "create" ? "" : "create"))}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            新建主题…
          </Button>
        )}
      </div>

      <ThemeComposerModal
        open={Boolean(composerMode)}
        mode={composerMode || "create"}
        setMode={setComposerMode}
        themes={themes}
        themeId={themeId}
        createTheme={createTheme}
        importThemeFromText={importThemeFromText}
        notify={notify}
        closeComposer={() => setComposerMode("")}
      />

      <ThemeLibraryDialogs
        pendingDeleteTheme={pendingDeleteTheme}
        setPendingDeleteTheme={setPendingDeleteTheme}
        handleDeleteTheme={handleDeleteTheme}
        pendingSwitchThemeId={pendingSwitchThemeId}
        setPendingSwitchThemeId={setPendingSwitchThemeId}
        currentThemeName={currentThemeName}
        handleCancelSwitch={handleCancelSwitch}
        handleDiscardAndSwitch={handleDiscardAndSwitch}
        handleSaveAndSwitch={handleSaveAndSwitch}
        isSwitching={isSwitching}
      />

    </aside>
  );
}
