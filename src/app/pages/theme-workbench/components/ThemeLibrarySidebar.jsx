import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileJson, PanelLeftClose, PanelLeftOpen, Plus, Upload } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { cn } from "@/components/ui/utils.js";
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog.jsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";
import { DataPill, SmallSelect, ThemeCard } from "./WorkbenchControls.jsx";

function ThemeComposerModal({
  open,
  mode,
  setMode,
  themes,
  themeId,
  createTheme,
  importThemeFromText,
  closeComposer,
  notify,
}) {
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createBaseThemeId, setCreateBaseThemeId] = useState(themeId);
  const [createError, setCreateError] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const fileInputRef = useRef(null);

  const baseThemeOptions = useMemo(
    () => [
      { value: "blank", label: "空白主题" },
      ...themes.map((theme) => ({ value: theme.id, label: theme.name })),
    ],
    [themes]
  );

  function handleCreate() {
    try {
      createTheme({
        name: createName,
        description: createDescription,
        basedOnThemeId: createBaseThemeId,
      });
      setCreateError("");
      setCreateName("");
      setCreateDescription("");
      setCreateBaseThemeId(themeId);
      closeComposer();
      notify?.({ tone: "success", title: "已创建主题", description: createName.trim() || "新主题已进入工作台。" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "新建主题失败。";
      setCreateError(message);
      notify?.({ tone: "error", title: "新建主题失败", description: message });
    }
  }

  async function handleImportChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      importThemeFromText(text, file.name);
      setImportError("");
      setImportSuccess(`已导入 ${file.name}`);
      closeComposer();
      notify?.({ tone: "success", title: "已导入主题", description: file.name });
    } catch (error) {
      setImportSuccess("");
      const message = error instanceof Error ? error.message : "导入主题失败。";
      setImportError(message);
      notify?.({ tone: "error", title: "导入主题失败", description: message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) closeComposer();
    }}>
      <DialogContent titleId="theme-composer-title" title="主题管理">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div id="theme-composer-title" className="text-base font-semibold text-slate-900">主题管理</div>
            <DialogDescription className="mt-1 text-sm text-slate-500">新建一个可编辑主题，或导入现有 JSON 主题包。</DialogDescription>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <Tabs value={mode} className="mb-4">
            <TabsList value={mode} className="w-full justify-start bg-white" onValueChange={setMode}>
              <TabsTrigger value="create">新建主题</TabsTrigger>
              <TabsTrigger value="import">导入 JSON</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "create" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="theme-create-name" className="text-xs font-medium uppercase text-slate-500">主题名称</label>
                <Input
                  id="theme-create-name"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="例如：Warm Click Studio"
                  className="bg-white"
                  autoFocus
                  aria-describedby={createError ? "theme-create-error" : undefined}
                  aria-invalid={Boolean(createError)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase text-slate-500">起始模板</label>
                <SmallSelect value={createBaseThemeId} options={baseThemeOptions} onChange={setCreateBaseThemeId} label="选择起始模板" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="theme-create-description" className="text-xs font-medium uppercase text-slate-500">主题说明</label>
                <textarea
                  id="theme-create-description"
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  placeholder="一句话说明这个主题更适合什么场景。"
                  rows={4}
                  className="w-full rounded-2xl border border-black/5 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                />
              </div>

              {createError ? <div id="theme-create-error" className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{createError}</div> : null}

              <div className="flex items-center justify-between gap-3">
                <DataPill tone="amber">新主题会先进入工作台，保存后写入扩展配置</DataPill>
                <Button className="rounded-full px-4" onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  创建主题
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-5 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-black/5">
                    <FileJson className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">导入本地 JSON 主题包</div>
                    <div className="mt-1 text-sm text-pretty text-slate-500">
                      支持直接导入单个主题对象，也支持带 `themePack` / `theme` 包裹的 JSON 文件。
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <Button variant="outline" className="rounded-full px-4" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" />
                        选择 JSON 文件
                      </Button>
                      <DataPill>导入后会自动选中</DataPill>
                    </div>
                  </div>
                </div>
              </div>

              <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportChange} />

              {importSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{importSuccess}</span>
                  </div>
                </div>
              ) : null}

              {importError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{importError}</div> : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ThemeLibrarySidebar({
  themes,
  themeId,
  setThemeId,
  createTheme,
  duplicateTheme,
  deleteTheme,
  exportTheme,
  importThemeFromText,
  notify,
}) {
  const [query, setQuery] = useState("");
  const [composerMode, setComposerMode] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingDeleteTheme, setPendingDeleteTheme] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

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
    const result = runThemeAction(() => exportTheme(targetThemeId));
    if (!result) return;
    notify?.({ tone: "success", title: "已导出主题", description: result.fileName });
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

  return (
    <aside className={cn("flex shrink-0 flex-col border-r border-slate-200 bg-slate-100 transition-[width] duration-200", collapsed ? "w-[76px]" : "w-[304px]")}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={cn("px-3 py-2.5", collapsed && "flex justify-center")}>
          <div className={cn(collapsed ? "flex flex-col items-center gap-2" : "grid grid-cols-[36px_36px_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-1 shadow-sm")}>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl"
              aria-label={collapsed ? "展开主题库" : "收起主题库"}
              title={collapsed ? "展开主题库" : "收起主题库"}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            <Button
              variant={composerMode === "import" ? "default" : "ghost"}
              size="icon"
              className="size-9 rounded-xl"
              aria-label="导入主题包"
              onClick={() => setComposerMode((current) => (current === "import" ? "" : "import"))}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              variant={composerMode === "create" ? "default" : "outline"}
              size={collapsed ? "icon" : undefined}
              className={cn(collapsed ? "size-9 rounded-xl" : "h-9 justify-center rounded-xl px-3 text-xs shadow-sm")}
              aria-label="新建主题"
              onClick={() => setComposerMode((current) => (current === "create" ? "" : "create"))}
            >
              <Plus className={cn("h-4 w-4", !collapsed && "mr-2")} />
              {collapsed ? null : "新建"}
            </Button>
          </div>
        </div>

        <div className={cn("px-3 pb-2.5", collapsed && "hidden")}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索主题包"
          />
        </div>

        {actionError ? (
          <div className="px-3 pb-2.5">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{actionError}</div>
          </div>
        ) : null}

        <div className={cn("min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 pt-2", collapsed && "space-y-3")}>
          {filteredThemes.length ? (
            filteredThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                selected={theme.id === themeId}
                canDelete={theme.kind !== "内置" && themes.length > 1}
                onClick={() => setThemeId(theme.id)}
                onDuplicate={() => handleDuplicateTheme(theme.id)}
                onExport={() => handleExportTheme(theme.id)}
                onDelete={() => setPendingDeleteTheme(theme)}
                collapsed={collapsed}
              />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">
              <div className="font-medium text-slate-900">没有找到匹配的主题</div>
              <div className="mt-1 text-pretty text-slate-500">换个关键词，或者直接创建一个新主题继续编辑。</div>
              <Button variant="outline" className="mt-4" onClick={() => setComposerMode("create")}>
                <Plus className="mr-2 h-4 w-4" />
                新建一个主题
              </Button>
            </div>
          )}
        </div>
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

      <AlertDialog open={Boolean(pendingDeleteTheme)} onOpenChange={(open) => {
        if (!open) setPendingDeleteTheme(null);
      }}>
        <AlertDialogContent>
          <AlertDialogTitle className="text-base font-semibold text-slate-950">删除主题？</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm leading-6 text-slate-600 text-pretty">
            确定删除主题“{pendingDeleteTheme?.name}”吗？此操作会在下次保存时写入扩展配置。
          </AlertDialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialogCancel className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="inline-flex h-9 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
              onClick={handleDeleteTheme}
            >
              删除主题
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
