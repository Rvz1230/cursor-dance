import { useEffect, useMemo, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { resolveThemeIcon, toneClasses } from "@/components/ui/theme-identity";
import { readEditorState, writeEditorState } from "../lib/workbenchConfig";
import { ThemeComposerModal } from "./theme-library/ThemeComposerModal";
import { ThemeLibraryDialogs } from "./theme-library/ThemeLibraryDialogs";
import { ThemeLibraryOption } from "./theme-library/ThemeLibraryOption";
import { ThemeLibraryMenu } from "./theme-library/ThemeLibraryMenu";
import type { WorkbenchThemeMeta } from "../hooks/workbenchStateTypes";
import {
  filterThemeLibrary,
  getThemeNavigationIndex,
  getThemeRovingId,
} from "./theme-library/themeLibraryNavigation";

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
  const [focusedThemeId, setFocusedThemeId] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void readEditorState().then((editorState) => {
      if (cancelled || typeof editorState?.libraryCollapsed !== "boolean") return;
      setCollapsed(editorState.libraryCollapsed);
    });
    return () => { cancelled = true; };
  }, []);

  const filteredThemes = useMemo(
    () => filterThemeLibrary<WorkbenchThemeMeta>(themes, query),
    [query, themes],
  );
  const rovingThemeId = getThemeRovingId(filteredThemes, themeId, focusedThemeId);
  const currentThemeName = themes.find((theme) => theme.id === themeId)?.name || "当前主题";

  useEffect(() => {
    if (collapsed) return;
    const selectedItem = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-theme-library-item]") ?? [])
      .find((item) => item.getAttribute("data-theme-library-item") === themeId);
    selectedItem?.scrollIntoView({ block: "nearest" });
  }, [collapsed, themeId]);

  function setCollapsedAndPersist(nextCollapsed) {
    setCollapsed(nextCollapsed);
    void writeEditorState({ libraryCollapsed: nextCollapsed });
  }

  function toggleCollapsed() {
    setCollapsedAndPersist(!collapsed);
  }

  function openSearchFromRail() {
    setCollapsedAndPersist(false);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function clearSearch() {
    setQuery("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function focusThemeAt(index) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-theme-library-item]") ?? []);
    const item = items[index];
    if (!(item instanceof HTMLElement)) return;
    setFocusedThemeId(item.dataset.themeLibraryItem || "");
    item.focus();
    item.scrollIntoView({ block: "nearest" });
  }

  function handleThemeKeyDown(event, index, theme) {
    if (event.target !== event.currentTarget) return;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "ArrowUp" && index === 0) {
        searchRef.current?.focus();
        return;
      }
      focusThemeAt(getThemeNavigationIndex(index, event.key, filteredThemes.length));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleThemeClick(theme.id);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if (event.key === "." || event.key === "ContextMenu") {
      event.preventDefault();
      event.currentTarget.querySelector("button[aria-label$='更多操作']")?.click();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && (event.key === "Backspace" || event.key === "Delete")) {
      event.preventDefault();
      if (theme.kind !== "内置" && themes.length > 1) setPendingDeleteTheme(theme);
    }
  }

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
      if (!result) return;
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

  const libraryMenu = (align: "start" | "end" = "end") => (
    <ThemeLibraryMenu
      align={align}
      themeCount={themes.length}
      currentThemeName={currentThemeName}
      onImport={() => setComposerMode("import")}
      onExportCurrent={() => void handleExportTheme(themeId)}
    />
  );

  return (
    <aside
      aria-label="主题库"
      className={cn(
        "flex shrink-0 flex-col border-r border-slate-200 bg-slate-100 transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-[60px]" : "w-[248px]",
      )}
    >
      {collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2 px-2 py-2.5">
          <Button variant="ghost" size="icon" className="size-9 rounded-xl" aria-label="展开主题库" title="展开主题库" onClick={toggleCollapsed}>
            <PanelLeftOpen className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-9 rounded-xl" aria-label="搜索主题" title="搜索主题" onClick={openSearchFromRail}>
            <Search className="size-4" />
          </Button>
          <div className="my-0.5 h-px w-6 bg-slate-200" />
          <div role="radiogroup" aria-label="主题" className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto">
            {themes.map((theme) => {
              const selected = theme.id === themeId;
              const ThemeIcon = resolveThemeIcon(theme.icon);
              const tones = toneClasses(theme.tone);
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`选择主题 ${theme.name}`}
                  title={theme.name}
                  className={cn(
                    "relative grid size-10 shrink-0 place-items-center rounded-xl border bg-white transition-[transform,border-color,box-shadow] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                    selected ? "border-slate-950 shadow-sm" : "border-slate-200 hover:border-slate-300",
                  )}
                  onClick={() => handleThemeClick(theme.id)}
                >
                  <span className={cn("grid size-7 place-items-center rounded-lg", selected ? "bg-slate-950 text-white" : tones.icon)}>
                    <ThemeIcon className="size-3.5" />
                  </span>
                  {dirtyThemes?.[theme.id] ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-400 ring-2 ring-slate-100" aria-label="有未保存的更改" /> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex shrink-0 flex-col items-center gap-1 border-t border-slate-200 pt-2">
            <Button
              variant={composerMode === "create" ? "default" : "ghost"}
              size="icon"
              className="size-9 rounded-xl"
              aria-label="新建主题"
              title="新建主题"
              onClick={() => setComposerMode("create")}
            >
              <Plus className="size-4" />
            </Button>
            {libraryMenu("start")}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5 px-2.5 py-2.5">
            <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-xl hover:bg-white" aria-label="收起主题库" title="收起主题库" onClick={toggleCollapsed}>
              <PanelLeftClose className="size-4" />
            </Button>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" && filteredThemes.length) {
                    event.preventDefault();
                    focusThemeAt(0);
                  }
                }}
                placeholder="搜索主题"
                aria-label="搜索主题"
                className="h-8 bg-white pl-8 pr-14 text-xs shadow-sm"
              />
              {query ? (
                <>
                  <span className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-2xs tabular-nums text-slate-500">
                    {filteredThemes.length}/{themes.length}
                  </span>
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    aria-label="清空搜索"
                    onClick={clearSearch}
                  >
                    <X className="size-3" />
                  </button>
                </>
              ) : null}
            </div>
            {libraryMenu()}
          </div>

          {actionError ? (
            <div className="px-2.5 pb-2">
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{actionError}</div>
            </div>
          ) : null}

          <div ref={listRef} role="listbox" aria-label="主题库" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 pb-2">
            {filteredThemes.length ? filteredThemes.map((theme, index) => (
              <ThemeLibraryOption
                key={theme.id}
                theme={theme}
                selected={theme.id === themeId}
                roving={theme.id === rovingThemeId}
                canDelete={theme.kind !== "内置" && themes.length > 1}
                isDirty={dirtyThemes?.[theme.id] || false}
                onSelect={() => handleThemeClick(theme.id)}
                onFocus={() => setFocusedThemeId(theme.id)}
                onKeyDown={(event) => handleThemeKeyDown(event, index, theme)}
                onDuplicate={() => handleDuplicateTheme(theme.id)}
                onExport={() => void handleExportTheme(theme.id)}
                onDelete={() => setPendingDeleteTheme(theme)}
                onRename={renameTheme}
                onUpdateIcon={updateThemeIcon}
              />
            )) : themes.length === 0 ? (
              <div className="mt-6 px-2 text-center">
                <div className="text-xs font-medium text-slate-600">还没有主题</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-500">创建一个主题，或从 JSON 导入。</div>
              </div>
            ) : (
              <div className="mt-6 px-1 text-center">
                <div className="text-xs font-medium text-slate-600">没有匹配“{query.trim()}”的主题</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-500">名称、摘要和主题类型都可搜索</div>
                <Button variant="outline" size="sm" className="mt-2.5 h-7 px-2.5" onClick={clearSearch}>清空搜索</Button>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 px-2.5 py-2.5">
            <Button
              variant={composerMode === "create" ? "default" : "outline"}
              className="h-8 w-full justify-center px-3 text-xs"
              aria-label="新建主题"
              title="新建主题"
              onClick={() => setComposerMode("create")}
            >
              <Plus className="mr-1.5 size-3.5" />
              新建主题…
            </Button>
          </div>
        </div>
      )}

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
